import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const CODEX = "codex" as const;

/**
 * Rollout lines are `{ timestamp, type, payload }`. Three types matter:
 * session_meta (session id, cwd, cli version), turn_context (model), and
 * event_msg with payload.type === "token_count" (cumulative totals plus the
 * last request's delta). Written from the documented format; not verified
 * against a local install, so everything here fails soft.
 */
/** codex-rs/protocol TokenUsage. cache_write_input_tokens is newer and defaults to 0. */
type Usage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
};

type RolloutLine = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown> & {
    id?: string;
    session_id?: string;
    cwd?: string;
    cli_version?: string;
    model?: string;
    model_provider?: string;
    git?: { branch?: string };
    type?: string;
    info?: {
      total_token_usage?: Usage;
      last_token_usage?: Usage;
    } | null;
  };
};

export type CodexState = {
  sessionId: string;
  cwd?: string;
  gitBranch?: string;
  cliVersion?: string;
  model?: string;
  provider?: string;
  lineIndex: number;
  lastTotal?: Usage;
};

const JSONL_EXTENSION = /\.jsonl$/;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function sessionIdFromFilename(path: string): string {
  const stem = basename(path).replace(JSONL_EXTENSION, "");
  const uuid = UUID_PATTERN.exec(stem);
  return uuid?.[0] ?? stem;
}

export function initialCodexState(path: string): CodexState {
  return { lineIndex: 0, sessionId: sessionIdFromFilename(path) };
}

function delta(total: Usage, previous: Usage | undefined): Usage {
  const sub = (a?: number, b?: number) => Math.max(0, (a ?? 0) - (b ?? 0));
  return {
    cache_write_input_tokens: sub(
      total.cache_write_input_tokens,
      previous?.cache_write_input_tokens
    ),
    cached_input_tokens: sub(
      total.cached_input_tokens,
      previous?.cached_input_tokens
    ),
    input_tokens: sub(total.input_tokens, previous?.input_tokens),
    output_tokens: sub(total.output_tokens, previous?.output_tokens),
    reasoning_output_tokens: sub(
      total.reasoning_output_tokens,
      previous?.reasoning_output_tokens
    ),
  };
}

/**
 * Feed one parsed line; mutates `state` and returns a usage event when the
 * line is a token_count. OpenAI counts cached tokens inside input_tokens, so
 * input is reported net of cache reads to match the other harnesses.
 */
export function normalizeCodex(
  value: unknown,
  state: CodexState
): RawEvent | null {
  state.lineIndex++;
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const line = value as RolloutLine;
  const payload = line.payload ?? {};
  if (line.type === "session_meta") {
    const id = payload.session_id ?? payload.id;
    if (typeof id === "string" && id) {
      state.sessionId = id;
    }
    state.cwd = typeof payload.cwd === "string" ? payload.cwd : state.cwd;
    state.cliVersion = payload.cli_version ?? state.cliVersion;
    state.gitBranch = payload.git?.branch ?? state.gitBranch;
    state.provider = payload.model_provider ?? state.provider;
    return null;
  }
  if (line.type === "turn_context") {
    state.model = payload.model ?? state.model;
    state.cwd = typeof payload.cwd === "string" ? payload.cwd : state.cwd;
    return null;
  }
  if (line.type !== "event_msg" || payload.type !== "token_count") {
    return null;
  }
  const { info } = payload;
  if (!info) {
    return null;
  }
  const total = info.total_token_usage;
  const usage =
    info.last_token_usage ??
    (total ? delta(total, state.lastTotal) : undefined);
  if (total) {
    state.lastTotal = total;
  }
  if (!usage) {
    return null;
  }
  const occurred = line.timestamp ? Date.parse(line.timestamp) : Number.NaN;
  if (Number.isNaN(occurred)) {
    return null;
  }
  const cached = usage.cached_input_tokens ?? 0;
  const cacheWrite = usage.cache_write_input_tokens ?? 0;
  const input = Math.max(0, (usage.input_tokens ?? 0) - cached);
  const output = usage.output_tokens ?? 0;
  if (input + cached + cacheWrite + output === 0) {
    return null;
  }
  const model = state.model ?? "unknown";
  return {
    eventId: eventId(CODEX, state.sessionId, state.lineIndex),
    harness: CODEX,
    harnessVersion: state.cliVersion,
    model: {
      family: modelFamily(model),
      provider: state.provider ?? "openai",
      raw: model,
    },
    occurredAt: new Date(occurred).toISOString(),
    project: projectRef(state.cwd, state.gitBranch),
    sessionId: state.sessionId,
    tokens: {
      cacheRead: cached,
      cacheWrite,
      input,
      output,
      ...(usage.reasoning_output_tokens === undefined
        ? {}
        : { reasoning: usage.reasoning_output_tokens }),
    },
    type: "usage",
  };
}

export function codexHome(): string {
  return process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

function walkRollouts(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRollouts(full, out);
    } else if (
      entry.name.startsWith("rollout-") &&
      entry.name.endsWith(".jsonl")
    ) {
      out.push(full);
    }
  }
}

export async function* collectCodex(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    const files: string[] = [];
    for (const sub of ["sessions", "archived_sessions"]) {
      const dir = join(root, sub);
      if (existsSync(dir)) {
        walkRollouts(dir, files);
      }
    }
    const recent = files
      .map((path) => ({ mtimeMs: statSync(path).mtimeMs, path }))
      .filter(
        ({ path, mtimeMs }) => mtimeMs >= ctx.since || ctx.cursors.get(path)
      )
      .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
    for (const { path } of recent) {
      let result: ReturnType<typeof tailJsonl>;
      try {
        result = tailJsonl(path, ctx.cursors);
      } catch (error) {
        ctx.log(`codex: cannot read ${path}: ${String(error)}`);
        continue;
      }
      const state: CodexState =
        typeof result.cursor.mark === "string"
          ? (JSON.parse(result.cursor.mark) as CodexState)
          : initialCodexState(path);
      const announced = new Set(result.cursor.seenSessions);
      for (const line of result.lines) {
        const event = normalizeCodex(parseJsonLine(line), state);
        if (!event || Date.parse(event.occurredAt) < ctx.since) {
          continue;
        }
        if (!announced.has(event.sessionId)) {
          announced.add(event.sessionId);
          yield {
            eventId: eventId(CODEX, event.sessionId, "start"),
            harness: CODEX,
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
        mark: JSON.stringify(state),
        seenSessions: [...announced],
      });
    }
    await Promise.resolve();
  }
}

export const codexCollector: Collector = {
  collect: (ctx) => collectCodex([codexHome()], ctx),
  discover: () =>
    Promise.resolve(
      existsSync(join(codexHome(), "sessions")) ? [codexHome()] : []
    ),
  id: CODEX,
};
