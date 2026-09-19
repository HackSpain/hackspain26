import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { parseJsonLine, tailJsonl } from "./jsonl-tail";

export const COPILOT = "copilot" as const;

type CopilotUsage = {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

type CopilotState = {
  cliVersion?: string;
  cwd?: string;
  gitBranch?: string;
  previous: Record<string, CopilotUsage>;
  sessionId: string;
};

type CopilotLine = {
  data?: Record<string, unknown>;
  id?: unknown;
  timestamp?: unknown;
  type?: unknown;
};

const EVENTS_FILE = "events.jsonl";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function usage(value: unknown): CopilotUsage | undefined {
  const row = record(value);
  if (!row) {
    return;
  }
  return {
    cacheReadTokens: count(row.cacheReadTokens),
    cacheWriteTokens: count(row.cacheWriteTokens),
    inputTokens: count(row.inputTokens),
    outputTokens: count(row.outputTokens),
    reasoningTokens: count(row.reasoningTokens),
  };
}

function delta(
  current: CopilotUsage,
  previous: CopilotUsage | undefined
): CopilotUsage {
  const subtract = (next: number, prior: number | undefined): number =>
    prior === undefined || next < prior ? next : next - prior;
  return {
    cacheReadTokens: subtract(
      current.cacheReadTokens,
      previous?.cacheReadTokens
    ),
    cacheWriteTokens: subtract(
      current.cacheWriteTokens,
      previous?.cacheWriteTokens
    ),
    inputTokens: subtract(current.inputTokens, previous?.inputTokens),
    outputTokens: subtract(current.outputTokens, previous?.outputTokens),
    reasoningTokens: subtract(
      current.reasoningTokens,
      previous?.reasoningTokens
    ),
  };
}

export function copilotHome(): string {
  return process.env.COPILOT_HOME?.trim() || join(homedir(), ".copilot");
}

export function initialCopilotState(path: string): CopilotState {
  return {
    previous: {},
    sessionId: basename(dirname(path)),
  };
}

/**
 * Copilot CLI persists cumulative per-model metrics at clean shutdown. A
 * resumed session can append another cumulative shutdown, so this returns
 * only the increase since the previous one stored in the file cursor.
 */
export function normalizeCopilot(
  value: unknown,
  state: CopilotState
): RawEvent[] {
  const line = record(value) as CopilotLine | undefined;
  if (!line) {
    return [];
  }
  const data = record(line.data);
  if (line.type === "session.start" && data) {
    state.sessionId = text(data.sessionId) ?? state.sessionId;
    state.cliVersion = text(data.copilotVersion) ?? state.cliVersion;
    const context = record(data.context);
    state.cwd = text(context?.cwd) ?? state.cwd;
    state.gitBranch = text(context?.branch) ?? state.gitBranch;
    return [];
  }
  if (line.type !== "session.shutdown" || !data) {
    return [];
  }
  const shutdownId = text(line.id);
  const timestamp = text(line.timestamp);
  const occurred = timestamp ? Date.parse(timestamp) : Number.NaN;
  const metrics = record(data.modelMetrics);
  if (!(shutdownId && metrics) || Number.isNaN(occurred)) {
    return [];
  }

  const events: RawEvent[] = [];
  const models = Object.entries(metrics).toSorted(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [index, [model, metricValue]] of models.entries()) {
    const rawModel = text(model);
    const metric = record(metricValue);
    const current = usage(metric?.usage);
    if (!(rawModel && current)) {
      continue;
    }
    const increment = delta(current, state.previous[rawModel]);
    state.previous[rawModel] = current;
    const cacheRead = increment.cacheReadTokens;
    const cacheWrite = increment.cacheWriteTokens;
    // Copilot's accumulated input includes both cache counters.
    const input = Math.max(0, increment.inputTokens - cacheRead - cacheWrite);
    const output = increment.outputTokens;
    if (input + output + cacheRead + cacheWrite === 0) {
      continue;
    }
    events.push({
      eventId: eventId(COPILOT, state.sessionId, `${shutdownId}:${index}`),
      harness: COPILOT,
      harnessVersion: state.cliVersion,
      model: { family: modelFamily(rawModel), raw: rawModel },
      occurredAt: new Date(occurred).toISOString(),
      project: projectRef(state.cwd, state.gitBranch),
      sessionId: state.sessionId,
      tokens: {
        cacheRead,
        cacheWrite,
        input,
        output,
        ...(increment.reasoningTokens > 0
          ? { reasoning: increment.reasoningTokens }
          : {}),
      },
      type: "usage",
    });
  }
  return events;
}

function eventFiles(root: string): string[] {
  const sessions = join(root, "session-state");
  if (!existsSync(sessions)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(sessions, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const path = join(sessions, entry.name, EVENTS_FILE);
    if (existsSync(path)) {
      files.push(path);
    }
  }
  return files;
}

function stateFromMark(path: string, mark: string | number | undefined) {
  if (typeof mark === "string") {
    try {
      const parsed = JSON.parse(mark) as Partial<CopilotState>;
      if (typeof parsed.sessionId === "string" && record(parsed.previous)) {
        return parsed as CopilotState;
      }
    } catch {
      // Fall back to the session directory; malformed local state is ignored.
    }
  }
  return initialCopilotState(path);
}

export async function* collectCopilot(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    const recent = eventFiles(root)
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
        ctx.log(`copilot: cannot read ${path}: ${String(error)}`);
        continue;
      }
      const state = stateFromMark(path, result.cursor.mark);
      const announced = new Set(result.cursor.seenSessions);
      for (const line of result.lines) {
        for (const event of normalizeCopilot(parseJsonLine(line), state)) {
          if (Date.parse(event.occurredAt) < ctx.since) {
            continue;
          }
          if (!announced.has(event.sessionId)) {
            announced.add(event.sessionId);
            yield {
              eventId: eventId(COPILOT, event.sessionId, "start"),
              harness: COPILOT,
              harnessVersion: event.harnessVersion,
              occurredAt: event.occurredAt,
              project: event.project,
              sessionId: event.sessionId,
              type: "session.start",
            };
          }
          yield event;
        }
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

export const copilotCollector: Collector = {
  collect: (ctx) => collectCopilot([copilotHome()], ctx),
  discover: () =>
    Promise.resolve(
      existsSync(join(copilotHome(), "session-state")) ? [copilotHome()] : []
    ),
  id: COPILOT,
};
