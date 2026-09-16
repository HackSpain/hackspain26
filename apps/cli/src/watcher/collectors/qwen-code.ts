import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const QWEN_CODE = "qwen-code" as const;

/**
 * Qwen Code (a Gemini CLI fork with its own recorder) appends one JSON
 * record per line to `~/.qwen/projects/<cwd-slug>/chats/<session>.jsonl`.
 * Every record carries `sessionId`, `cwd`, `version` and `gitBranch`;
 * assistant records carry `model` and, when the API reported usage, a
 * `usageMetadata` object in Google GenAI shape (`promptTokenCount`,
 * `candidatesTokenCount`, `cachedContentTokenCount`, `thoughtsTokenCount`).
 * Written from the ChatRecordingService source, not verified against a
 * local install, so everything fails soft.
 */
type QwenLine = {
  uuid: string;
  sessionId: string;
  timestamp: string;
  type: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  model?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
    toolUsePromptTokenCount?: number;
    totalTokenCount?: number;
  } | null;
};

function isQwenLine(value: unknown): value is QwenLine {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.uuid === "string" &&
    typeof v.sessionId === "string" &&
    typeof v.timestamp === "string" &&
    typeof v.type === "string"
  );
}

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/**
 * Assistant records with usage become events. The prompt count includes
 * the cached part, so `input` is what was sent fresh.
 */
export function normalizeQwenCode(value: unknown): RawEvent | null {
  if (
    !isQwenLine(value) ||
    value.type !== "assistant" ||
    !value.usageMetadata
  ) {
    return null;
  }
  const occurred = Date.parse(value.timestamp);
  if (Number.isNaN(occurred)) {
    return null;
  }
  const u = value.usageMetadata;
  const prompt = count(u.promptTokenCount);
  const cached = Math.min(count(u.cachedContentTokenCount), prompt);
  const output = count(u.candidatesTokenCount);
  if (prompt === 0 && output === 0 && count(u.totalTokenCount) === 0) {
    return null;
  }
  const model = value.model ?? "qwen";
  const reasoning = count(u.thoughtsTokenCount);
  return {
    eventId: eventId(QWEN_CODE, value.sessionId, value.uuid),
    harness: QWEN_CODE,
    harnessVersion: value.version === "unknown" ? undefined : value.version,
    model: { family: modelFamily(model), raw: model },
    occurredAt: new Date(occurred).toISOString(),
    project: projectRef(value.cwd, value.gitBranch),
    sessionId: value.sessionId,
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

export function qwenHome(): string {
  return process.env.QWEN_HOME?.trim() || join(homedir(), ".qwen");
}

/** `<home>/projects/<slug>/chats/*.jsonl`. */
export function listQwenChats(root: string): string[] {
  const projects = join(root, "projects");
  if (!existsSync(projects)) {
    return [];
  }
  const out: string[] = [];
  for (const project of readdirSync(projects, { withFileTypes: true })) {
    if (!project.isDirectory()) {
      continue;
    }
    const chats = join(projects, project.name, "chats");
    if (!existsSync(chats)) {
      continue;
    }
    for (const entry of readdirSync(chats)) {
      if (entry.endsWith(".jsonl")) {
        out.push(join(chats, entry));
      }
    }
  }
  return out;
}

export async function* collectQwenCode(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    const files = listQwenChats(root)
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
        ctx.log(`qwen-code: cannot read ${path}: ${String(error)}`);
        continue;
      }
      const announced = new Set(result.cursor.seenSessions);
      const emitted = new Set<string>();
      for (const line of result.lines) {
        const event = normalizeQwenCode(parseJsonLine(line));
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
            eventId: eventId(QWEN_CODE, event.sessionId, "start"),
            harness: QWEN_CODE,
            harnessVersion: event.harnessVersion,
            occurredAt: event.occurredAt,
            project: event.project,
            sessionId: event.sessionId,
            type: "session.start",
          };
        }
        yield event;
      }
      ctx.cursors.set(path, { ...result.cursor, seenSessions: [...announced] });
    }
    await Promise.resolve();
  }
}

export const qwenCodeCollector: Collector = {
  collect: (ctx) => collectQwenCode([qwenHome()], ctx),
  discover: () =>
    Promise.resolve(
      existsSync(join(qwenHome(), "projects")) ? [qwenHome()] : []
    ),
  id: QWEN_CODE,
};
