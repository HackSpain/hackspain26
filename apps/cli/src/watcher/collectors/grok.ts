import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const GROK = "grok" as const;

type InferenceLine = {
  ts: string;
  ver?: string;
  sid: string;
  msg: "shell.turn.inference_done";
  ctx: {
    prompt_tokens: number;
    cached_prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
  };
};

type SessionSummary = {
  info?: { cwd?: string };
  current_model_id?: string;
};

type SessionMetadata = { cwd?: string; model: string };

/**
 * Grok appends one `shell.turn.inference_done` line per model call to
 * `~/.grok/logs/unified.jsonl`; `prompt_tokens` includes the cached part and
 * `completion_tokens` includes reasoning (checked against the per-session
 * `usage.json` totals). The model and working directory live in each
 * session's `summary.json`, and Grok has no environment override for its
 * home. Checked against real logs.
 */
function isInferenceLine(value: unknown): value is InferenceLine {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const line = value as Record<string, unknown>;
  if (
    line.msg !== "shell.turn.inference_done" ||
    typeof line.ts !== "string" ||
    typeof line.sid !== "string" ||
    (line.ver !== undefined && typeof line.ver !== "string") ||
    typeof line.ctx !== "object" ||
    line.ctx === null ||
    Array.isArray(line.ctx)
  ) {
    return false;
  }
  const ctx = line.ctx as Record<string, unknown>;
  const counters = [
    ctx.prompt_tokens,
    ctx.cached_prompt_tokens,
    ctx.completion_tokens,
    ctx.reasoning_tokens,
  ];
  return counters.every(
    (counter) =>
      typeof counter === "number" &&
      Number.isSafeInteger(counter) &&
      counter >= 0
  );
}

export function normalizeGrok(
  value: unknown,
  session?: SessionMetadata
): RawEvent | null {
  if (!isInferenceLine(value)) {
    return null;
  }
  const {
    prompt_tokens: prompt,
    cached_prompt_tokens: cacheRead,
    completion_tokens: output,
    reasoning_tokens: reasoning,
  } = value.ctx;
  if (prompt + cacheRead + output + reasoning === 0 || cacheRead > prompt) {
    return null;
  }
  const occurred = Date.parse(value.ts);
  if (Number.isNaN(occurred)) {
    return null;
  }
  const model = session?.model || "unknown";
  return {
    eventId: eventId(GROK, value.sid, value.ts),
    harness: GROK,
    harnessVersion: value.ver,
    model: { family: modelFamily(model), provider: "xai", raw: model },
    occurredAt: new Date(occurred).toISOString(),
    project: projectRef(session?.cwd),
    sessionId: value.sid,
    tokens: {
      cacheRead,
      cacheWrite: 0,
      input: prompt - cacheRead,
      output,
      reasoning,
    },
    type: "usage",
  };
}

export function grokRoot(): string {
  return join(homedir(), ".grok");
}

function sessionMetadata(root: string): Map<string, SessionMetadata> {
  const metadata = new Map<string, SessionMetadata>();
  if (!existsSync(root)) {
    return metadata;
  }
  for (const project of readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) {
      continue;
    }
    const projectPath = join(root, project.name);
    for (const session of readdirSync(projectPath, { withFileTypes: true })) {
      if (!session.isDirectory()) {
        continue;
      }
      try {
        const summary = JSON.parse(
          readFileSync(join(projectPath, session.name, "summary.json"), "utf8")
        ) as SessionSummary;
        metadata.set(session.name, {
          cwd: summary.info?.cwd,
          model: summary.current_model_id || "unknown",
        });
      } catch {
        metadata.set(session.name, { model: "unknown" });
      }
    }
  }
  return metadata;
}

export async function* collectGrok(
  logPaths: string[],
  sessionsRoot: string,
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  const sessions = sessionMetadata(sessionsRoot);
  for (const path of logPaths) {
    let result: ReturnType<typeof tailJsonl>;
    try {
      result = tailJsonl(path, ctx.cursors);
    } catch (error) {
      ctx.log(`grok: cannot read ${path}: ${String(error)}`);
      continue;
    }
    const seen = new Set(result.cursor.seenSessions);
    for (const line of result.lines) {
      const value = parseJsonLine(line);
      const event = normalizeGrok(value, sessions.get(sessionId(value) ?? ""));
      if (!event || Date.parse(event.occurredAt) < ctx.since) {
        continue;
      }
      if (!seen.has(event.sessionId)) {
        seen.add(event.sessionId);
        yield {
          eventId: eventId(GROK, event.sessionId, "start"),
          harness: GROK,
          harnessVersion: event.harnessVersion,
          occurredAt: event.occurredAt,
          project: event.project,
          sessionId: event.sessionId,
          type: "session.start",
        };
      }
      yield event;
    }
    ctx.cursors.set(path, { ...result.cursor, seenSessions: [...seen] });
  }
  await Promise.resolve();
}

function sessionId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return;
  }
  const sid = (value as Record<string, unknown>).sid;
  return typeof sid === "string" ? sid : undefined;
}

export const grokCollector: Collector = {
  collect: (ctx) => {
    const root = grokRoot();
    return collectGrok(
      [join(root, "logs", "unified.jsonl")],
      join(root, "sessions"),
      ctx
    );
  },
  discover: () => {
    const log = join(grokRoot(), "logs", "unified.jsonl");
    return Promise.resolve(existsSync(log) ? [log] : []);
  },
  id: GROK,
};
