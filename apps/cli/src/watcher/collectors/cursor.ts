import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  ensureDir,
  readJsonFile,
  stateDir,
  writeFileAtomic,
} from "../../lib/config";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const CURSOR = "cursor" as const;
const SCRIPT_EXTENSION = /\.[cm]?[jt]s$/;
let cursorHookReady = false;

type CursorHookRecord = {
  cache_read_tokens?: unknown;
  cache_write_tokens?: unknown;
  conversation_id?: unknown;
  cursor_version?: unknown;
  generation_id?: unknown;
  input_tokens?: unknown;
  model?: unknown;
  occurred_at?: unknown;
  output_tokens?: unknown;
  workspace_roots?: unknown;
};

type HooksConfig = {
  hooks?: Record<string, unknown>;
  version?: number;
  [key: string]: unknown;
};

type CursorCollectionWindow = { since: number; until: number };

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function token(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function cursorHome(): string {
  return (
    process.env.HACKSPAIN_CURSOR_HOME?.trim() || join(homedir(), ".cursor")
  );
}

export function cursorEventPath(): string {
  return (
    process.env.HACKSPAIN_CURSOR_EVENT_LOG?.trim() ||
    join(stateDir(), "cursor-events.jsonl")
  );
}

export function cursorWindowPath(): string {
  return join(stateDir(), "cursor-window.json");
}

function readCursorWindow(
  path = cursorWindowPath()
): CursorCollectionWindow | null {
  const value = readJsonFile<{ window?: unknown }>(path)?.window;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const window = value as Partial<CursorCollectionWindow>;
  return typeof window.since === "number" &&
    Number.isFinite(window.since) &&
    typeof window.until === "number" &&
    Number.isFinite(window.until) &&
    window.until > window.since
    ? { since: window.since, until: window.until }
    : null;
}

export function setCursorCollectionWindow(
  window: CursorCollectionWindow | null,
  path = cursorWindowPath()
): void {
  writeFileAtomic(path, `${JSON.stringify({ window })}\n`, 0o600);
}

function quoteCommandArg(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Absolute in releases so GUI-launched Cursor does not depend on shell PATH. */
export function cursorHookCommand(): string {
  const entry = process.argv[1];
  const developmentEntry =
    entry && SCRIPT_EXTENSION.test(entry) && existsSync(entry)
      ? resolve(entry)
      : undefined;
  return [process.execPath, developmentEntry, "_cursor-hook"]
    .filter((part): part is string => Boolean(part))
    .map(quoteCommandArg)
    .join(" ");
}

/**
 * Cursor's afterAgentResponse hook includes the response text and user email.
 * Persist an explicit allowlist instead: no prompt, response, tool data or identity.
 */
export function recordCursorHook(
  value: unknown,
  path = cursorEventPath(),
  now = Date.now(),
  window = readCursorWindow()
): boolean {
  if (!window || now < window.since || now >= window.until) {
    return false;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const input = value as CursorHookRecord;
  const conversationId = nonEmpty(input.conversation_id);
  const generationId = nonEmpty(input.generation_id);
  const model = nonEmpty(input.model);
  if (!(conversationId && generationId && model)) {
    return false;
  }
  const record = {
    cache_read_tokens: token(input.cache_read_tokens),
    cache_write_tokens: token(input.cache_write_tokens),
    conversation_id: conversationId,
    ...(nonEmpty(input.cursor_version)
      ? { cursor_version: nonEmpty(input.cursor_version) }
      : {}),
    generation_id: generationId,
    input_tokens: token(input.input_tokens),
    model,
    occurred_at: new Date(now).toISOString(),
    output_tokens: token(input.output_tokens),
    workspace_roots: Array.isArray(input.workspace_roots)
      ? input.workspace_roots.filter(
          (root): root is string => typeof root === "string" && root.length > 0
        )
      : [],
  };
  ensureDir(dirname(path), 0o700);
  appendFileSync(path, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return true;
}

export function normalizeCursorHook(value: unknown): RawEvent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as CursorHookRecord;
  const sessionId = nonEmpty(row.conversation_id);
  const nativeId = nonEmpty(row.generation_id);
  const model = nonEmpty(row.model);
  const occurredAt = nonEmpty(row.occurred_at);
  if (!(sessionId && nativeId && model && occurredAt)) {
    return null;
  }
  const occurred = Date.parse(occurredAt);
  if (Number.isNaN(occurred)) {
    return null;
  }
  const cacheRead = token(row.cache_read_tokens);
  const cacheWrite = token(row.cache_write_tokens);
  // Cursor reports prompt input inclusive of both cache counters.
  const input = Math.max(0, token(row.input_tokens) - cacheRead - cacheWrite);
  const output = token(row.output_tokens);
  if (input + output + cacheRead + cacheWrite === 0) {
    return null;
  }
  const cwd = Array.isArray(row.workspace_roots)
    ? row.workspace_roots.find(
        (root): root is string => typeof root === "string"
      )
    : undefined;
  return {
    eventId: eventId(CURSOR, sessionId, nativeId),
    harness: CURSOR,
    harnessVersion: nonEmpty(row.cursor_version),
    model: { family: modelFamily(model), raw: model },
    occurredAt: new Date(occurred).toISOString(),
    project: projectRef(cwd),
    sessionId,
    tokens: { cacheRead, cacheWrite, input, output },
    type: "usage",
  };
}

export async function* collectCursor(
  files: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const path of files) {
    if (!existsSync(path)) {
      continue;
    }
    let result: ReturnType<typeof tailJsonl>;
    try {
      result = tailJsonl(path, ctx.cursors);
    } catch (error) {
      ctx.log(`cursor: cannot read ${path}: ${String(error)}`);
      continue;
    }
    const announced = new Set(result.cursor.seenSessions);
    for (const line of result.lines) {
      const event = normalizeCursorHook(parseJsonLine(line));
      if (!event || Date.parse(event.occurredAt) < ctx.since) {
        continue;
      }
      if (!announced.has(event.sessionId)) {
        announced.add(event.sessionId);
        yield {
          eventId: eventId(CURSOR, event.sessionId, "start"),
          harness: CURSOR,
          harnessVersion: event.harnessVersion,
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
      seenSessions: [...announced],
    });
  }
  await Promise.resolve();
}

/** Add HackSpain's recorder while preserving every existing Cursor hook. */
export function installCursorHook(
  root = cursorHome(),
  command = cursorHookCommand()
): "absent" | "installed" | "present" {
  if (!existsSync(root)) {
    return "absent";
  }
  const path = join(root, "hooks.json");
  let config: HooksConfig = { version: 1 };
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("root must be an object");
      }
      config = parsed as HooksConfig;
    } catch (error) {
      throw new Error(
        `cannot update ${path}: invalid JSON (${String(error)})`,
        {
          cause: error,
        }
      );
    }
  }
  if (
    config.hooks !== undefined &&
    (typeof config.hooks !== "object" ||
      config.hooks === null ||
      Array.isArray(config.hooks))
  ) {
    throw new Error(`cannot update ${path}: hooks must be an object`);
  }
  const hooks = (config.hooks ?? {}) as Record<string, unknown>;
  const current = hooks.afterAgentResponse;
  if (current !== undefined && !Array.isArray(current)) {
    throw new Error(
      `cannot update ${path}: afterAgentResponse must be an array`
    );
  }
  const entries = (current ?? []) as unknown[];
  if (
    entries.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        !Array.isArray(entry) &&
        (entry as { command?: unknown }).command === command
    )
  ) {
    return "present";
  }
  const next: HooksConfig = {
    ...config,
    hooks: { ...hooks, afterAgentResponse: [...entries, { command }] },
    version: config.version ?? 1,
  };
  writeFileAtomic(path, `${JSON.stringify(next, null, 2)}\n`, 0o600);
  return "installed";
}

export const cursorCollector: Collector = {
  collect: (ctx) => collectCursor([cursorEventPath()], ctx),
  discover: () =>
    Promise.resolve(
      cursorHookReady && existsSync(cursorHome()) ? [resolve(cursorHome())] : []
    ),
  id: CURSOR,
  prepare: (log) => {
    try {
      const result = installCursorHook();
      cursorHookReady = result !== "absent";
      if (result === "installed") {
        log("cursor: installed the usage recorder in ~/.cursor/hooks.json");
      }
    } catch (error) {
      cursorHookReady = false;
      log(`cursor: ${String(error)}`);
    }
  },
  setWindow: (window) => {
    if (existsSync(cursorHome())) {
      setCursorCollectionWindow(window);
    }
  },
};
