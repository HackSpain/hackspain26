import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ensureDir,
  readJsonFile,
  stateDir,
  writeFileAtomic,
} from "../../lib/config";
import { startOtelReceiver } from "../otel";
import type { RawEvent } from "../schema";
import { canonicalize, eventId, SCHEMA, validateEvent } from "../schema";
import type { Collector, CollectorContext, CursorStore } from "../types";
import type { CollectionWindow } from "../window";
import { claudeCodeCollector, claudeConfigDir } from "./claude-code";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type ReceiverConfig = { version: 1; port: number; token: string };

function environment(config: ReceiverConfig): Record<string, string> {
  return {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `http://127.0.0.1:${config.port}/v1/logs`,
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: `Authorization=Bearer ${config.token}`,
    OTEL_LOG_USER_PROMPTS: "0",
    OTEL_LOG_ASSISTANT_RESPONSES: "0",
    OTEL_LOG_TOOL_DETAILS: "0",
    OTEL_LOG_TOOL_CONTENT: "0",
    OTEL_LOG_RAW_API_BODIES: "0",
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Never replace another exporter, opt-out, header helper, or malformed settings file. */
export function installClaudeOtel(
  path: string,
  config: ReceiverConfig,
  shellEnv: Record<string, string | undefined> = process.env
): "installed" | "unchanged" | "conflict" {
  const settings: unknown = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : {};
  if (
    !record(settings) ||
    (settings.env !== undefined && !record(settings.env))
  ) {
    throw new Error("Invalid Claude settings");
  }
  const env = (settings.env ?? {}) as Record<string, unknown>;
  const own = environment(config);
  if (settings.otelHeadersHelper !== undefined) {
    return "conflict";
  }
  for (const source of [env, shellEnv]) {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        continue;
      }
      if (
        (key.startsWith("OTEL_") ||
          key === "CLAUDE_CODE_ENABLE_TELEMETRY" ||
          key === "BETA_TRACING_ENDPOINT") &&
        value !== own[key]
      ) {
        return "conflict";
      }
    }
  }
  if (Object.entries(own).every(([key, value]) => env[key] === value)) {
    return "unchanged";
  }
  writeFileAtomic(
    path,
    `${JSON.stringify({ ...settings, env: { ...env, ...own } }, null, 2)}\n`
  );
  return "installed";
}

function* queuedEvents(
  path: string,
  userId: string,
  ctx: CollectorContext
): Iterable<RawEvent> {
  if (!existsSync(path)) {
    return;
  }
  const result = tailJsonl(path, ctx.cursors);
  for (const line of result.lines) {
    const row = parseJsonLine(line);
    if (!record(row) || row.userId !== userId || !record(row.event)) {
      continue;
    }
    const event = row.event as RawEvent;
    if (
      validateEvent({
        ...canonicalize(event),
        schema: SCHEMA,
        observedAt: event.occurredAt,
        identity: { userId, clientVersion: "local" },
      }).length > 0
    ) {
      continue;
    }
    yield {
      eventId: eventId("claude-code", event.sessionId, "start"),
      harness: "claude-code",
      sessionId: event.sessionId,
      occurredAt: event.occurredAt,
      type: "session.start",
    };
    yield event;
  }
  ctx.cursors.set(path, result.cursor);
}

/** Native logs first; transcripts also cover older versions and receiver downtime. */
export function createClaudeOtelCollector(options: {
  userId: string;
  listen: boolean;
  window: () => CollectionWindow | null;
  paused: () => boolean;
}): {
  collector: Collector;
  checkpoint: (cursors: CursorStore) => void;
  stop: () => Promise<void>;
} {
  let receiver: ReturnType<typeof startOtelReceiver> | undefined;
  let lastStatus = "";
  const queuePath = join(stateDir(), "claude-otel.jsonl");
  const collector: Collector = {
    id: "claude-code",
    async prepare(log) {
      if (!options.listen || receiver || !existsSync(claudeConfigDir())) {
        return;
      }
      const status = (message: string) => {
        if (lastStatus !== message) {
          log(message);
          lastStatus = message;
        }
      };
      try {
        ensureDir(stateDir());
        const configPath = join(stateDir(), "claude-otel.json");
        const stored = readJsonFile<ReceiverConfig>(configPath);
        if (
          existsSync(configPath) &&
          !(
            stored?.version === 1 &&
            Number.isInteger(stored.port) &&
            stored.port > 0 &&
            stored.port <= 65_535 &&
            typeof stored.token === "string" &&
            TOKEN_PATTERN.test(stored.token)
          )
        ) {
          throw new Error("Invalid receiver configuration");
        }
        const config: ReceiverConfig = stored ?? {
          version: 1,
          port: 0,
          token: Buffer.from(
            crypto.getRandomValues(new Uint8Array(32))
          ).toString("hex"),
        };
        receiver = startOtelReceiver({
          ...config,
          queuePath,
          userId: options.userId,
          window: options.window,
          paused: options.paused,
          onError: () =>
            status(
              "claude-code: OTLP queue write failed; exporter can retry, transcripts remain enabled"
            ),
        });
        if (receiver.port === undefined) {
          throw new Error("Receiver did not bind a TCP port");
        }
        config.port = receiver.port;
        if (!stored) {
          writeFileAtomic(configPath, `${JSON.stringify(config)}\n`);
        }
        const result = installClaudeOtel(
          join(claudeConfigDir(), "settings.json"),
          config
        );
        if (result === "conflict") {
          await receiver.stop(true);
          receiver = undefined;
          status(
            "claude-code: existing telemetry configuration preserved; using transcripts"
          );
          return;
        }
        status(
          result === "installed"
            ? "claude-code: OpenTelemetry configured; restart Claude Code to activate. Transcripts remain enabled."
            : "claude-code: OpenTelemetry receiver ready; transcripts remain enabled"
        );
      } catch {
        if (receiver) {
          await receiver.stop(true);
          receiver = undefined;
        }
        status(
          "claude-code: OpenTelemetry setup unavailable; using transcripts and retrying next scan"
        );
      }
    },
    async discover() {
      const roots = await claudeCodeCollector.discover();
      return receiver || existsSync(queuePath) ? [...roots, queuePath] : roots;
    },
    async *collect(ctx) {
      try {
        yield* queuedEvents(queuePath, options.userId, ctx);
      } catch {
        ctx.log("claude-code: cannot read OTLP queue; trying transcripts");
      }
      yield* claudeCodeCollector.collect(ctx);
    },
  };
  return {
    collector,
    checkpoint(cursors) {
      const cursor = cursors.get(queuePath);
      if (!cursor || cursor.offset === 0 || !existsSync(queuePath)) {
        return;
      }
      const stat = statSync(queuePath);
      if (stat.size === cursor.offset && stat.ino === cursor.inode) {
        // Only after every sink has accepted the events. Atomic replacement
        // also resets stale on-disk cursors if we crash before saving them.
        writeFileAtomic(queuePath, "");
        cursors.set(queuePath, {
          offset: 0,
          inode: statSync(queuePath).ino,
          mtimeMs: Date.now(),
        });
      }
    },
    stop: async () => {
      await receiver?.stop(true);
    },
  };
}
