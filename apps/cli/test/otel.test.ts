import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rememberTelemetry } from "../../app/src/app/api/cli/telemetry/canonical";
import { summarize } from "../src/commands/telemetry";
import { stateDir } from "../src/lib/config";
import { createBatcher } from "../src/watcher/batcher";
import {
  createClaudeOtelCollector,
  installClaudeOtel,
} from "../src/watcher/collectors/claude-otel";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { scanOnce, stamp } from "../src/watcher/index";
import { replaySpool } from "../src/watcher/memory";
import { claudeOtelEvents, startOtelReceiver } from "../src/watcher/otel";
import type { TelemetryEvent } from "../src/watcher/schema";
import { createState } from "../src/watcher/state";

const AT = new Date(Date.now() - 5000).toISOString();
const WINDOW = { since: Date.parse(AT) - 1000, until: Date.parse(AT) + 1000 };
const IDENTITY = { userId: "participant", clientVersion: "test" };
const TOKEN = "a".repeat(64);

function attrs(values: Record<string, unknown>) {
  return Object.entries(values).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? { intValue: String(value) }
        : { stringValue: value },
  }));
}

function payload(
  overrides: Record<string, unknown> = {},
  service = "claude-code"
) {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: attrs({
            "service.name": service,
            "user.email": "private@example.test",
            "host.name": "private-host",
          }),
        },
        scopeLogs: [
          {
            scope: { name: "com.anthropic.claude_code" },
            logRecords: [
              {
                timeUnixNano: `${BigInt(Date.parse(AT)) * 1_000_000n}`,
                body: { stringValue: "private response" },
                attributes: attrs({
                  "event.name": "api_request",
                  "event.timestamp": AT,
                  "session.id": "session",
                  request_id: "req_123",
                  model: "claude-sonnet-4-5",
                  input_tokens: 10,
                  output_tokens: 20,
                  cache_read_tokens: 30,
                  cache_creation_tokens: 40,
                  cost_usd: "0.002",
                  "app.version": "2.1.0",
                  prompt: "private prompt",
                  "user.account_uuid": "private-account",
                  cwd: "/private/project",
                  ...overrides,
                }),
              },
            ],
          },
        ],
      },
    ],
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hs-otel-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("native Claude OTLP", () => {
  test("normalizes token semantics and strictly discards private fields", () => {
    const events = claudeOtelEvents(payload());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventId: "claude-code:session:request:req_123",
      occurredAt: AT,
      tokens: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 },
      native: { requestId: "req_123" },
      costUsd: 0.002,
    });
    const first = events[0];
    if (!first) {
      throw new Error("Missing native event");
    }
    expect(stamp(first, IDENTITY).tokens?.total).toBe(100);
    expect(JSON.stringify(events)).not.toContain("private");
    expect(claudeOtelEvents(payload({}, "another-app"))).toEqual([]);
    expect(claudeOtelEvents(payload({}, "claude-code-desktop"))).toHaveLength(
      1
    );
    expect(claudeOtelEvents(payload({ "event.name": "user_prompt" }))).toEqual(
      []
    );
    expect(claudeOtelEvents(payload({ request_id: undefined }))).toEqual([]);
    expect(claudeOtelEvents(payload({ "event.timestamp": "bad" }))).toEqual([]);
    for (const input_tokens of [
      -1,
      1.2,
      "",
      "NaN",
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(claudeOtelEvents(payload({ input_tokens }))).toEqual([]);
    }
  });

  test("HTTP auth, protocol, privacy, event window and retryable disk failure", async () => {
    const path = join(dir, "queue.jsonl");
    let window: typeof WINDOW | null = WINDOW;
    let paused = false;
    let failures = 0;
    const server = startOtelReceiver({
      port: 0,
      token: TOKEN,
      userId: IDENTITY.userId,
      queuePath: path,
      window: () => window,
      paused: () => paused,
      onError: () => failures++,
    });
    const post = (
      body: unknown = payload(),
      headers: Record<string, string> = {}
    ) =>
      fetch(new URL("/v1/logs", server.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${TOKEN}`,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    try {
      expect(
        (await post(payload(), { authorization: "Bearer wrong" })).status
      ).toBe(403);
      expect(
        (await post(payload(), { origin: "https://example.test" })).status
      ).toBe(403);
      expect(
        (await post(payload(), { "content-type": "application/x-protobuf" }))
          .status
      ).toBe(415);
      expect((await post({})).status).toBe(400);
      const oversized = await post({ padding: "x".repeat(1024 * 1024 + 1) });
      expect(oversized.ok).toBe(false);
      expect(existsSync(path)).toBe(false);
      window = null;
      expect((await post()).status).toBe(200);
      expect(existsSync(path)).toBe(false);
      window = WINDOW;
      expect(
        (
          await post(
            payload({ "event.timestamp": new Date(WINDOW.until).toISOString() })
          )
        ).status
      ).toBe(200);
      expect(existsSync(path)).toBe(false);
      paused = true;
      expect((await post()).status).toBe(503);
      paused = false;
      expect((await post()).status).toBe(200);
      const stored = readFileSync(path, "utf8");
      expect(stored).not.toContain("private");
      expect(JSON.parse(stored).userId).toBe(IDENTITY.userId);
      // Retries are allowed into the durable queue; the scanner deduplicates them.
      expect((await post()).status).toBe(200);
      expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(2);
      writeFileSync(path, `${stored}{"userId":"interrupted`);
      expect((await post()).status).toBe(200);
      const repaired = readFileSync(path, "utf8").trim().split("\n");
      expect(repaired).toHaveLength(2);
      expect(
        repaired.map((line) => JSON.parse(line).event.native.requestId)
      ).toEqual(["req_123", "req_123"]);
      rmSync(path);
      mkdirSync(path);
      expect((await post()).status).toBe(503);
      expect(failures).toBe(1);
    } finally {
      await server.stop(true);
    }
  });

  test("settings are additive and idempotent; existing exporters and opt-outs survive", () => {
    const path = join(dir, "settings.json");
    const config = { version: 1 as const, port: 4318, token: TOKEN };
    writeFileSync(
      path,
      JSON.stringify({
        permissions: { allow: ["Read"] },
        env: { EDITOR: "vim" },
      })
    );
    expect(installClaudeOtel(path, config, {})).toBe("installed");
    const installed = readFileSync(path, "utf8");
    expect(JSON.parse(installed)).toMatchObject({
      permissions: { allow: ["Read"] },
      env: {
        EDITOR: "vim",
        OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
        OTEL_LOG_USER_PROMPTS: "0",
      },
    });
    expect(installClaudeOtel(path, config, {})).toBe("unchanged");
    expect(readFileSync(path, "utf8")).toBe(installed);
    expect(
      installClaudeOtel(path, config, {
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://company.test",
      })
    ).toBe("conflict");
    for (const settings of [
      { env: { OTEL_EXPORTER_OTLP_ENDPOINT: "https://company.test" } },
      { env: { CLAUDE_CODE_ENABLE_TELEMETRY: "0" } },
      { otelHeadersHelper: "company-auth" },
    ]) {
      const original = JSON.stringify(settings);
      writeFileSync(path, original);
      expect(installClaudeOtel(path, config, {})).toBe("conflict");
      expect(readFileSync(path, "utf8")).toBe(original);
    }
    writeFileSync(path, "{broken");
    expect(() => installClaudeOtel(path, config, {})).toThrow();
    expect(readFileSync(path, "utf8")).toBe("{broken");
  });

  test("native/transcript aliases count once in either order, scoped to each participant", () => {
    const first = claudeOtelEvents(payload())[0];
    if (!first) {
      throw new Error("Missing native event");
    }
    const native = stamp(first, IDENTITY);
    const transcript = { ...native, eventId: "claude-code:session:msg_123" };
    const otherUser = {
      ...native,
      identity: { ...IDENTITY, userId: "someone-else" },
    };
    for (const events of [
      [native, transcript],
      [transcript, native],
    ] as const) {
      const seen = new Set<string>();
      expect(rememberTelemetry(seen, events[0])).toBe(false);
      expect(rememberTelemetry(seen, events[1])).toBe(true);
      expect(rememberTelemetry(new Set(seen), events[0])).toBe(true);
      expect(summarize([...events, otherUser]).all.events).toBe(2);
      const state = createState({
        me: { name: "Test" },
        uploadEnabled: false,
        window: WINDOW,
      });
      expect(replaySpool(state, [...events, ...events])).toBe(1);
    }
  });
});

test("native collector prioritizes OTLP, falls back to transcripts, and recovers after restart", async () => {
  const keys = ["XDG_STATE_HOME", "LOCALAPPDATA", "CLAUDE_CONFIG_DIR"] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  process.env.XDG_STATE_HOME = dir;
  process.env.LOCALAPPDATA = dir;
  process.env.CLAUDE_CONFIG_DIR = join(dir, "claude");
  const transcriptDir = join(
    process.env.CLAUDE_CONFIG_DIR,
    "projects",
    "project"
  );
  mkdirSync(transcriptDir, { recursive: true });
  const options = {
    userId: IDENTITY.userId,
    listen: true,
    window: () => WINDOW,
    paused: () => false,
  };
  const native = createClaudeOtelCollector(options);
  let restarted: ReturnType<typeof createClaudeOtelCollector> | undefined;
  try {
    writeFileSync(
      join(transcriptDir, "session.jsonl"),
      `${JSON.stringify({ type: "assistant", sessionId: "session", timestamp: AT, requestId: "req_123", message: { id: "msg_123", model: "claude-sonnet-4-5", usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 } } })}\n`
    );
    const logs: string[] = [];
    await native.collector.prepare?.((message) => logs.push(message));
    const configPath = join(stateDir(), "claude-otel.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const post = () =>
      fetch(`http://127.0.0.1:${config.port}/v1/logs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(payload()),
      });
    expect((await post()).status).toBe(200);
    const cursors = memoryCursorStore();
    const ctx = {
      cursors,
      ...WINDOW,
      log: (message: string) => logs.push(message),
    };
    const delivered: TelemetryEvent[] = [];
    const batcher = createBatcher(
      [
        {
          name: "test",
          write: async (events) => {
            delivered.push(...events);
          },
        },
      ],
      ctx.log
    );
    const recent = new Set<string>();
    expect(
      (await scanOnce([native.collector], ctx, batcher, IDENTITY, recent))
        .events
    ).toBe(2);
    await batcher.flush();
    expect(
      delivered.filter((e) => e.type === "usage").map((e) => e.eventId)
    ).toEqual(["claude-code:session:request:req_123"]);
    native.checkpoint(cursors);
    expect(readFileSync(join(stateDir(), "claude-otel.jsonl"), "utf8")).toBe(
      ""
    );
    restarted = createClaudeOtelCollector(options);
    await restarted.collector.prepare?.(ctx.log);
    expect(logs.at(-1)).toContain("OpenTelemetry setup unavailable");
    await native.stop();
    await restarted.collector.prepare?.(ctx.log);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(config);
    expect((await post()).status).toBe(200);
    expect(
      (
        await scanOnce(
          [restarted.collector],
          ctx,
          batcher,
          IDENTITY,
          new Set(recent)
        )
      ).events
    ).toBe(0);
    // If the OTLP exporter is unavailable, a fresh transcript request is still read.
    writeFileSync(
      join(transcriptDir, "fallback.jsonl"),
      `${JSON.stringify({ type: "assistant", sessionId: "session", timestamp: AT, requestId: "req_fallback", message: { id: "msg_fallback", model: "claude-sonnet-4-5", usage: { input_tokens: 1, output_tokens: 2 } } })}\n`
    );
    expect(
      (await scanOnce([restarted.collector], ctx, batcher, IDENTITY, recent))
        .events
    ).toBe(1);
  } finally {
    await native.stop();
    await restarted?.stop();
    for (const key of keys) {
      if (previous[key] === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = previous[key];
      }
    }
  }
});
