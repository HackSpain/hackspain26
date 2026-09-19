import type { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { openReadOnly } from "./sqlite";

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
  const occurred = new Date(row.created_at * 1000);
  if (
    !Number.isFinite(occurred.getTime()) ||
    typeof message.message_id !== "string" ||
    ![input, output, cacheRead, cacheWrite].every(
      (value) =>
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    )
  ) {
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
    occurredAt: occurred.toISOString(),
    project: projectRef(session?.working_directory || undefined),
    sessionId: row.session_id,
    tokens: { cacheRead, cacheWrite, input, output },
    type: "usage",
  };
}

export function devinDbPath(
  platform = process.platform,
  env = process.env,
  home = homedir()
): string {
  const override = env.HACKSPAIN_DEVIN_DB?.trim();
  if (override) {
    return override;
  }
  if (platform === "win32") {
    return win32.join(
      env.APPDATA?.trim() || win32.join(home, "AppData", "Roaming"),
      "devin",
      "cli",
      "sessions.db"
    );
  }
  const data = env.XDG_DATA_HOME?.trim() || posix.join(home, ".local", "share");
  return posix.join(data, "devin", "cli", "sessions.db");
}

const PAGE = 250;

export async function* collectDevin(
  dbPaths: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const path of dbPaths) {
    const previous = ctx.cursors.get(path);
    let mark = typeof previous?.mark === "number" ? previous.mark : 0;
    const announced = new Set(previous?.seenSessions);
    let db: Database | undefined;
    try {
      const stat = statSync(path);
      db = openReadOnly(path);
      // Query the database, not filesystem timestamps: WAL checkpoints and
      // coarse mtimes can hide new rows. A replaced/reset DB starts over.
      const maximum =
        db
          .query<{ id: number | null }, []>(
            "SELECT MAX(row_id) AS id FROM message_nodes"
          )
          .get()?.id ?? 0;
      if (
        (previous?.inode !== undefined && previous.inode !== stat.ino) ||
        maximum < mark
      ) {
        mark = 0;
        announced.clear();
      }
      const sessionQuery = db.query<SessionRow, [string]>(
        "SELECT id, working_directory, backend_type, model FROM sessions WHERE id = ?1"
      );
      const query = db.query<MessageRow, [number, number, number]>(
        "SELECT row_id, session_id, created_at, chat_message FROM message_nodes WHERE row_id > ?1 AND row_id <= ?2 ORDER BY row_id ASC LIMIT ?3"
      );
      const sessions = new Map<string, SessionRow | undefined>();
      const emitted = new Set<string>();
      for (;;) {
        const rows = query.all(mark, maximum, PAGE);
        for (const row of rows) {
          mark = row.row_id;
          if (!sessions.has(row.session_id)) {
            sessions.set(
              row.session_id,
              sessionQuery.get(row.session_id) ?? undefined
            );
          }
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
        if (rows.length < PAGE) {
          break;
        }
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
      }
      ctx.cursors.set(path, {
        inode: stat.ino,
        mark,
        mtimeMs: stat.mtimeMs,
        offset: 0,
        seenSessions: [...announced],
      });
    } catch (error) {
      ctx.log(`devin: cannot read ${path}: ${String(error)}`);
    } finally {
      db?.close();
    }
  }
}

export const devinCollector: Collector = {
  collect: (ctx) => collectDevin([devinDbPath()], ctx),
  discover: () =>
    Promise.resolve(existsSync(devinDbPath()) ? [devinDbPath()] : []),
  id: DEVIN,
};
