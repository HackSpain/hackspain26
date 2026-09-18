import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const PI = "pi" as const;
export const OMP = "omp" as const;
type PiHarness = typeof PI | typeof OMP;
type SessionState = { sessionId?: string; project?: RawEvent["project"] };

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Pi and Oh My Pi persist the same session tree envelope. Only completed
 * assistant messages carry usage; title slots, prompts and tool results
 * are ignored. Header `version` is the file format, not the app version.
 * Sources: badlogic/pi-mono core/session-manager.ts and ai/src/types.ts;
 * can1357/oh-my-pi docs/session.md and catalog/src/types.ts.
 */
export function normalizePi(
  value: unknown,
  state: SessionState,
  harness: PiHarness
): RawEvent | null {
  const entry = record(value);
  if (!entry) {
    return null;
  }
  if (entry.type === "session") {
    state.sessionId = typeof entry.id === "string" ? entry.id : undefined;
    state.project = projectRef(
      typeof entry.cwd === "string" ? entry.cwd : undefined
    );
    return null;
  }
  const message = record(entry.message);
  const usage = record(message?.usage);
  if (
    entry.type !== "message" ||
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.timestamp !== "string" ||
    !state.sessionId ||
    message?.role !== "assistant" ||
    typeof message.model !== "string" ||
    !message.model ||
    !usage
  ) {
    return null;
  }
  const occurred = Date.parse(entry.timestamp);
  const input = count(usage.input);
  const output = count(usage.output);
  const cacheRead = count(usage.cacheRead);
  const cacheWrite = count(usage.cacheWrite);
  if (
    Number.isNaN(occurred) ||
    input === undefined ||
    output === undefined ||
    cacheRead === undefined ||
    cacheWrite === undefined ||
    input + output + cacheRead + cacheWrite === 0
  ) {
    return null;
  }
  // Both SDKs already exclude cache from input and include thinking in output.
  const reasoning = count(
    harness === PI ? usage.reasoning : usage.reasoningTokens
  );
  const cost = record(usage.cost)?.total;
  return {
    costUsd:
      typeof cost === "number" && Number.isFinite(cost) && cost >= 0
        ? cost
        : undefined,
    eventId: eventId(harness, state.sessionId, entry.id),
    harness,
    model: {
      provider:
        typeof message.provider === "string" ? message.provider : undefined,
      raw: message.model,
    },
    occurredAt: new Date(occurred).toISOString(),
    project: state.project,
    sessionId: state.sessionId,
    tokens: {
      cacheRead,
      cacheWrite,
      input,
      output,
      ...(reasoning === undefined || reasoning > output ? {} : { reasoning }),
    },
    type: "usage",
  };
}

/** Walk session buckets and nested subagent sessions, without following symlinks. */
export function listPiSessions(
  root: string,
  log: CollectorContext["log"]
): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const files: string[] = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...listPiSessions(path, log));
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(path);
      }
    }
  } catch (error) {
    log(`pi/omp: cannot list ${root}: ${String(error)}`);
  }
  return files;
}

export async function* collectPi(
  roots: string[],
  ctx: CollectorContext,
  harness: PiHarness
): AsyncIterable<RawEvent> {
  const emitted = new Set<string>();
  for (const root of roots) {
    for (const path of listPiSessions(root, ctx.log)) {
      let result: ReturnType<typeof tailJsonl>;
      try {
        result = tailJsonl(path, ctx.cursors);
      } catch (error) {
        ctx.log(`${harness}: cannot read ${path}: ${String(error)}`);
        continue;
      }
      // The cursor keeps just the session identity and sanitized project, so
      // appended messages can be read after restarting without the header.
      const saved =
        typeof result.cursor.mark === "string"
          ? record(parseJsonLine(result.cursor.mark))
          : undefined;
      const state: SessionState = saved ?? {};
      const announced = new Set(result.cursor.seenSessions);
      for (const line of result.lines) {
        const event = normalizePi(parseJsonLine(line), state, harness);
        if (
          !event ||
          emitted.has(event.eventId) ||
          Date.parse(event.occurredAt) < ctx.since
        ) {
          continue;
        }
        emitted.add(event.eventId);
        if (!announced.has(event.sessionId)) {
          announced.add(event.sessionId);
          yield {
            eventId: eventId(harness, event.sessionId, "start"),
            harness,
            occurredAt: event.occurredAt,
            project: event.project,
            sessionId: event.sessionId,
            type: "session.start",
          };
        }
        yield event;
      }
      ctx.cursors.set(path, {
        ...result.cursor,
        mark: JSON.stringify(state),
        seenSessions: [...announced],
      });
    }
    await Promise.resolve();
  }
}

export function piSessionDir(harness: PiHarness): string {
  // Both tools use PI_CODING_AGENT_DIR; separate watcher overrides avoid
  // attributing one tool's custom directory to both tools.
  const override =
    process.env[
      harness === PI ? "HACKSPAIN_PI_SESSION_DIR" : "HACKSPAIN_OMP_SESSION_DIR"
    ]?.trim();
  if (override) {
    return override.startsWith("~/")
      ? join(homedir(), override.slice(2))
      : override;
  }
  return join(homedir(), harness === PI ? ".pi" : ".omp", "agent", "sessions");
}

function collector(harness: PiHarness): Collector {
  return {
    collect: (ctx) => collectPi([piSessionDir(harness)], ctx, harness),
    discover: () => {
      const root = piSessionDir(harness);
      return Promise.resolve(existsSync(root) ? [root] : []);
    },
    id: harness,
  };
}

export const piCollector = collector(PI);
export const ompCollector = collector(OMP);
