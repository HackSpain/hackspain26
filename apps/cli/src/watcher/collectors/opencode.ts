import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { projectRef } from "../project";
import { eventId, modelFamily, type RawEvent } from "../schema";
import type { Collector, CollectorContext } from "../types";

export const OPENCODE = "opencode" as const;

/**
 * Recent OpenCode versions keep everything in SQLite. Assistant messages carry
 * `tokens`, `modelID`, `providerID`, `cost` and `path.cwd` in their JSON
 * `data` column; rows are updated in place while streaming, so only
 * completed messages (time.completed set) are reported and the watermark is
 * `time_updated`. Read-only; the credential tables are never touched.
 */
type MessageData = {
  role?: string;
  modelID?: string;
  providerID?: string;
  cost?: number;
  path?: { cwd?: string };
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  time?: { created?: number; completed?: number };
};

export type MessageRow = {
  id: string;
  session_id: string;
  time_updated: number;
  data: string;
};

export function normalizeOpenCode(row: MessageRow): RawEvent | null {
  let data: MessageData;
  try {
    data = JSON.parse(row.data) as MessageData;
  } catch {
    return null;
  }
  if (data.role !== "assistant" || !data.tokens || !data.time?.completed) {
    return null;
  }
  const model = data.modelID ?? "unknown";
  return {
    type: "usage",
    eventId: eventId(OPENCODE, row.session_id, row.id),
    occurredAt: new Date(data.time.completed).toISOString(),
    harness: OPENCODE,
    sessionId: row.session_id,
    project: projectRef(data.path?.cwd),
    model: {
      raw: model,
      family: modelFamily(model),
      provider: data.providerID,
    },
    tokens: {
      input: data.tokens.input ?? 0,
      output: data.tokens.output ?? 0,
      cacheRead: data.tokens.cache?.read ?? 0,
      cacheWrite: data.tokens.cache?.write ?? 0,
      ...(data.tokens.reasoning === undefined
        ? {}
        : { reasoning: data.tokens.reasoning }),
    },
    ...(typeof data.cost === "number" && data.cost > 0
      ? { costUsd: data.cost }
      : {}),
  };
}

export function openCodeDbPath(): string {
  const data =
    process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share");
  return join(data, "opencode", "opencode.db");
}

const PAGE = 500;

export async function* collectOpenCode(
  dbPaths: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const path of dbPaths) {
    const previous = ctx.cursors.get(path);
    let since = typeof previous?.mark === "number" ? previous.mark : ctx.since;
    const announced = new Set(previous?.seenSessions ?? []);
    let db: Database;
    try {
      db = new Database(path, { readonly: true });
    } catch (err) {
      ctx.log(`opencode: cannot open ${path}: ${String(err)}`);
      continue;
    }
    try {
      const query = db.query<MessageRow, [number, number]>(
        "SELECT id, session_id, time_updated, data FROM message WHERE time_updated > ?1 ORDER BY time_updated ASC LIMIT ?2"
      );
      for (;;) {
        const rows = query.all(since, PAGE);
        if (rows.length === 0) {
          break;
        }
        for (const row of rows) {
          since = Math.max(since, row.time_updated);
          const event = normalizeOpenCode(row);
          if (!event || Date.parse(event.occurredAt) < ctx.since) {
            continue;
          }
          if (!announced.has(event.sessionId)) {
            announced.add(event.sessionId);
            yield {
              type: "session.start",
              eventId: eventId(OPENCODE, event.sessionId, "start"),
              occurredAt: event.occurredAt,
              harness: OPENCODE,
              sessionId: event.sessionId,
              project: event.project,
            };
          }
          yield event;
        }
        if (rows.length < PAGE) {
          break;
        }
      }
    } catch (err) {
      ctx.log(`opencode: query failed on ${path}: ${String(err)}`);
    } finally {
      db.close();
    }
    ctx.cursors.set(path, {
      offset: 0,
      mtimeMs: Date.now(),
      seenSessions: [...announced],
      mark: since,
    });
    await Promise.resolve();
  }
}

export const openCodeCollector: Collector = {
  id: OPENCODE,
  discover: () =>
    Promise.resolve(existsSync(openCodeDbPath()) ? [openCodeDbPath()] : []),
  collect: (ctx) => collectOpenCode([openCodeDbPath()], ctx),
};
