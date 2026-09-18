import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { lastWriteMs, openReadOnly } from "./sqlite";

export const DEVIN = "devin" as const;

/**
 * The Devin CLI keeps every session in `~/.local/share/devin/cli/sessions.db`:
 * `sessions` has the working directory, backend and model, and `message_nodes`
 * has one row per message per conversation chain, with the assistant's metrics
 * inside the `chat_message` JSON. The same assistant message lands in two
 * chains, so rows are deduped on `message_id`.
 */
type Metrics = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  cache_creation_tokens?: number | null;
};

type ChatMessage = {
  role?: string;
  message_id?: string;
  metadata?: { metrics?: Metrics | null } | null;
};

export type SessionRow = {
  id: string;
  working_directory: string | null;
  backend_type: string | null;
  model: string | null;
};

export type MessageRow = {
  row_id: number;
  session_id: string;
  created_at: number;
  chat_message: string;
};

export function normalizeDevin(
  row: MessageRow,
  session: SessionRow | undefined
): RawEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.chat_message);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const message = parsed as ChatMessage;
  const metrics = message.metadata?.metrics;
  if (message.role !== "assistant" || !metrics || !message.message_id) {
    return null;
  }
  const input = metrics.input_tokens ?? 0;
  const output = metrics.output_tokens ?? 0;
  const cacheRead = metrics.cache_read_tokens ?? 0;
  const cacheWrite = metrics.cache_creation_tokens ?? 0;
  if (input + output + cacheRead + cacheWrite === 0) {
    return null;
  }
  const model = session?.model || "unknown";
  return {
    eventId: eventId(DEVIN, row.session_id, message.message_id),
    harness: DEVIN,
    model: {
      family: modelFamily(model),
      provider: session?.backend_type || undefined,
      raw: model,
    },
    occurredAt: new Date(row.created_at * 1000).toISOString(),
    project: projectRef(session?.working_directory || undefined),
    sessionId: row.session_id,
    tokens: { cacheRead, cacheWrite, input, output },
    type: "usage",
  };
}

export function devinDbPath(): string {
  const data =
    process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share");
  return join(data, "devin", "cli", "sessions.db");
}

export async function* collectDevin(
  dbPaths: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const path of dbPaths) {
    const mtimeMs = lastWriteMs(path);
    const previous = ctx.cursors.get(path);
    if (
      (previous && previous.mtimeMs === mtimeMs) ||
      (!previous && mtimeMs < ctx.since)
    ) {
      continue;
    }
    let mark = typeof previous?.mark === "number" ? previous.mark : 0;
    const announced = new Set(previous?.seenSessions);
    let db: Database | undefined;
    let sessions: Map<string, SessionRow>;
    let rows: MessageRow[];
    try {
      db = openReadOnly(path);
      sessions = new Map(
        db
          .query<SessionRow, []>(
            "SELECT id, working_directory, backend_type, model FROM sessions"
          )
          .all()
          .map((session) => [session.id, session])
      );
      rows = db
        .query<MessageRow, [number]>(
          "SELECT row_id, session_id, created_at, chat_message FROM message_nodes WHERE row_id > ?1 ORDER BY row_id ASC"
        )
        .all(mark);
    } catch (error) {
      ctx.log(`devin: cannot read ${path}: ${String(error)}`);
      continue;
    } finally {
      db?.close();
    }
    const emitted = new Set<string>();
    for (const row of rows) {
      mark = Math.max(mark, row.row_id);
      const event = normalizeDevin(row, sessions.get(row.session_id));
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
          eventId: eventId(DEVIN, event.sessionId, "start"),
          harness: DEVIN,
          occurredAt: event.occurredAt,
          project: event.project,
          sessionId: event.sessionId,
          type: "session.start",
        };
      }
      yield event;
    }
    ctx.cursors.set(path, {
      mark,
      mtimeMs,
      offset: 0,
      seenSessions: [...announced],
    });
    await Promise.resolve();
  }
}

export const devinCollector: Collector = {
  collect: (ctx) => collectDevin([devinDbPath()], ctx),
  discover: () =>
    Promise.resolve(existsSync(devinDbPath()) ? [devinDbPath()] : []),
  id: DEVIN,
};
