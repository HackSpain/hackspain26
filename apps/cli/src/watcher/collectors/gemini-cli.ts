import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily, outputWithReasoning } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const GEMINI_CLI = "gemini-cli" as const;

/**
 * Gemini CLI records every conversation as JSONL under
 * `~/.gemini/tmp/<project>/chats/session-<time>-<id>.jsonl` (subagents one
 * level deeper). The first line is session metadata; then one record per
 * message. A model turn is written once without `tokens` and appended again
 * with the same `id` once the API's usage metadata arrives, so only records
 * that carry `tokens` count and the id is the dedupe key. Written from the
 * ChatRecordingService source, not verified against a local install, so
 * everything fails soft.
 */
type MetadataLine = {
  sessionId: string;
  projectHash?: string;
  startTime?: string;
  kind?: string;
  directories?: string[];
};

type MessageLine = {
  id: string;
  timestamp: string;
  type: string;
  model?: string;
  tokens?: {
    input?: number;
    output?: number;
    cached?: number;
    thoughts?: number;
    tool?: number;
    total?: number;
  } | null;
};

const JSONL_EXTENSION = /\.jsonl$/;
const SESSION_FILE_NAME = /^session-.*-([A-Za-z0-9_-]{8})$/;

/** Per-file state kept in the cursor mark: who the session is. */
export type GeminiState = {
  sessionId?: string;
  cwd?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMetadata(value: unknown): value is MetadataLine {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    value.id === undefined
  );
}

function isMessage(value: unknown): value is MessageLine {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.type === "string"
  );
}

/** Fallback session id from `session-<time>-<shortId>.jsonl` or `<id>.jsonl`. */
export function sessionIdFromName(path: string): string {
  const name = basename(path).replace(JSONL_EXTENSION, "");
  const match = SESSION_FILE_NAME.exec(name);
  return match?.[1] ?? name;
}

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/**
 * Normalise one record. Metadata lines update `state` and yield nothing;
 * model turns with usage become events. Gemini's prompt count includes the
 * cached part, so `input` is what was actually sent fresh.
 */
export function normalizeGeminiCli(
  value: unknown,
  state: GeminiState,
  fallbackSessionId: string
): RawEvent | null {
  if (isMetadata(value)) {
    state.sessionId = value.sessionId;
    const dir = value.directories?.find((d) => typeof d === "string");
    if (dir) {
      state.cwd = dir;
    }
    return null;
  }
  if (!isMessage(value) || value.type !== "gemini" || !value.tokens) {
    return null;
  }
  const occurred = Date.parse(value.timestamp);
  if (Number.isNaN(occurred)) {
    return null;
  }
  const t = value.tokens;
  const prompt = count(t.input);
  const cached = Math.min(count(t.cached), prompt);
  const reasoning = count(t.thoughts);
  // The Gemini API counts thoughts apart from the candidates.
  const output = outputWithReasoning({
    output: count(t.output),
    prompt,
    reasoning,
    separateByDefault: true,
    total: count(t.total),
  });
  if (prompt === 0 && output === 0 && count(t.total) === 0) {
    return null;
  }
  const model = value.model ?? "gemini";
  const sessionId = state.sessionId ?? fallbackSessionId;
  return {
    eventId: eventId(GEMINI_CLI, sessionId, value.id),
    harness: GEMINI_CLI,
    model: { family: modelFamily(model), provider: "google", raw: model },
    occurredAt: new Date(occurred).toISOString(),
    project: projectRef(state.cwd),
    sessionId,
    tokens: {
      cacheRead: cached,
      cacheWrite: 0,
      input: prompt - cached,
      output,
      ...(reasoning ? { reasoning } : {}),
    },
    type: "usage",
  };
}

export function geminiHome(): string {
  const home = process.env.GEMINI_CLI_HOME?.trim() || homedir();
  return join(home, ".gemini");
}

/** `<home>/tmp/<project>/chats/*.jsonl` plus subagent files one level down. */
export function listGeminiChats(root: string): string[] {
  const tmp = join(root, "tmp");
  if (!existsSync(tmp)) {
    return [];
  }
  const out: string[] = [];
  for (const project of readdirSync(tmp, { withFileTypes: true })) {
    if (!project.isDirectory()) {
      continue;
    }
    const chats = join(tmp, project.name, "chats");
    if (!existsSync(chats)) {
      continue;
    }
    for (const entry of readdirSync(chats, { withFileTypes: true })) {
      const full = join(chats, entry.name);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        out.push(full);
      } else if (entry.isDirectory()) {
        for (const sub of readdirSync(full)) {
          if (sub.endsWith(".jsonl")) {
            out.push(join(full, sub));
          }
        }
      }
    }
  }
  return out;
}

export async function* collectGeminiCli(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    const files = listGeminiChats(root)
      .map((path) => ({ mtimeMs: statSync(path).mtimeMs, path }))
      .filter(
        ({ path, mtimeMs }) => mtimeMs >= ctx.since || ctx.cursors.get(path)
      )
      .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
    for (const { path } of files) {
      let result: ReturnType<typeof tailJsonl>;
      try {
        result = tailJsonl(path, ctx.cursors);
      } catch (error) {
        ctx.log(`gemini-cli: cannot read ${path}: ${String(error)}`);
        continue;
      }
      const state: GeminiState =
        typeof result.cursor.mark === "string"
          ? (JSON.parse(result.cursor.mark) as GeminiState)
          : {};
      const fallback = sessionIdFromName(path);
      const announced = new Set(result.cursor.seenSessions);
      const emitted = new Set<string>();
      for (const line of result.lines) {
        const event = normalizeGeminiCli(parseJsonLine(line), state, fallback);
        if (!event || emitted.has(event.eventId)) {
          continue;
        }
        if (Date.parse(event.occurredAt) < ctx.since) {
          continue;
        }
        emitted.add(event.eventId);
        if (!announced.has(event.sessionId)) {
          announced.add(event.sessionId);
          yield {
            eventId: eventId(GEMINI_CLI, event.sessionId, "start"),
            harness: GEMINI_CLI,
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

export const geminiCliCollector: Collector = {
  collect: (ctx) => collectGeminiCli([geminiHome()], ctx),
  discover: () =>
    Promise.resolve(
      existsSync(join(geminiHome(), "tmp")) ? [geminiHome()] : []
    ),
  id: GEMINI_CLI,
};
