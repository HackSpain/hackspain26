import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import { eventId, modelFamily, type RawEvent } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const CLAUDE_CODE = "claude-code" as const;

type AssistantLine = {
  type: "assistant";
  sessionId: string;
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  requestId?: string;
  apiBlockIndex?: number;
  message: {
    id: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens_details?: { thinking_tokens?: number };
    };
  };
};

function isAssistantLine(value: unknown): value is AssistantLine {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  const message = v.message as Record<string, unknown> | undefined;
  return (
    v.type === "assistant" &&
    typeof v.sessionId === "string" &&
    typeof v.timestamp === "string" &&
    typeof message?.id === "string" &&
    typeof message.usage === "object" &&
    message.usage !== null
  );
}

/**
 * One API response is written as several lines (one per content block) that
 * repeat the same `message.id` and the same usage, so callers must dedupe on
 * the event id. `<synthetic>` is what Claude Code writes for cancelled or
 * failed turns; it carries no real usage.
 */
export function normalizeClaudeCode(value: unknown): RawEvent | null {
  if (!isAssistantLine(value)) {
    return null;
  }
  const model = value.message.model;
  if (!model || model === "<synthetic>") {
    return null;
  }
  const usage = value.message.usage ?? {};
  const occurred = Date.parse(value.timestamp);
  if (Number.isNaN(occurred)) {
    return null;
  }
  const reasoning = usage.output_tokens_details?.thinking_tokens;
  return {
    type: "usage",
    eventId: eventId(CLAUDE_CODE, value.sessionId, value.message.id),
    occurredAt: new Date(occurred).toISOString(),
    harness: CLAUDE_CODE,
    harnessVersion: value.version,
    sessionId: value.sessionId,
    project: projectRef(value.cwd, value.gitBranch),
    model: { raw: model, family: modelFamily(model), provider: "anthropic" },
    tokens: {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
      ...(reasoning === undefined ? {} : { reasoning }),
    },
    native: value.requestId ? { requestId: value.requestId } : undefined,
  };
}

export function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude");
}

function listTranscripts(root: string): string[] {
  const projects = join(root, "projects");
  if (!existsSync(projects)) {
    return [];
  }
  const files: string[] = [];
  for (const dir of readdirSync(projects, { withFileTypes: true })) {
    if (!dir.isDirectory()) {
      continue;
    }
    const full = join(projects, dir.name);
    for (const entry of readdirSync(full)) {
      if (entry.endsWith(".jsonl")) {
        files.push(join(full, entry));
      }
    }
  }
  return files;
}

/**
 * Yield events from every transcript, newest first, using byte-offset
 * cursors so restarts never re-read. Lines are deduped by event id within
 * the run; across runs the cursor guarantees each line is read once.
 */
export async function* collectClaudeCode(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    const files = listTranscripts(root)
      .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
      .filter(
        ({ mtimeMs }) =>
          mtimeMs >= ctx.since || ctx.cursors.get(root) !== undefined
      )
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const { path } of files) {
      let result: ReturnType<typeof tailJsonl>;
      try {
        result = tailJsonl(path, ctx.cursors);
      } catch (err) {
        ctx.log(`claude-code: cannot read ${path}: ${String(err)}`);
        continue;
      }
      const seen = new Set(result.cursor.seenSessions ?? []);
      const emitted = new Set<string>();
      for (const line of result.lines) {
        const event = normalizeClaudeCode(parseJsonLine(line));
        if (!event || emitted.has(event.eventId)) {
          continue;
        }
        if (Date.parse(event.occurredAt) < ctx.since) {
          continue;
        }
        emitted.add(event.eventId);
        if (!seen.has(event.sessionId)) {
          seen.add(event.sessionId);
          yield {
            type: "session.start",
            eventId: eventId(CLAUDE_CODE, event.sessionId, "start"),
            occurredAt: event.occurredAt,
            harness: CLAUDE_CODE,
            harnessVersion: event.harnessVersion,
            sessionId: event.sessionId,
            project: event.project,
          };
        }
        yield event;
      }
      ctx.cursors.set(path, { ...result.cursor, seenSessions: [...seen] });
    }
    await Promise.resolve();
  }
}

export const claudeCodeCollector: Collector = {
  id: CLAUDE_CODE,
  discover: () => {
    const root = claudeConfigDir();
    return Promise.resolve(existsSync(join(root, "projects")) ? [root] : []);
  },
  collect: (ctx) => collectClaudeCode([claudeConfigDir()], ctx),
};
