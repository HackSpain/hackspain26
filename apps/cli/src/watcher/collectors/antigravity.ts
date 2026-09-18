import type { Database } from "bun:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRef } from "../project";
import type { RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
import type { Collector, CollectorContext } from "../types";
import { lastWriteMs, openReadOnly } from "./sqlite";

export const ANTIGRAVITY = "antigravity" as const;

/**
 * The Antigravity CLI (`agy`) keeps one SQLite database per conversation
 * under `~/.gemini/antigravity-cli/conversations/<uuid>.db`. Every step is a
 * row of `steps` whose `metadata` blob is a protobuf; model steps carry a
 * usage message in field 9 (model code, input net of cache reads, output
 * including thoughts, cache reads, and the thought count on its own), and
 * `gen_metadata` maps the model code to its name. The sibling
 * `conversation_summaries.db` knows the workspace of each conversation. The
 * databases are in WAL mode and agy leaves them without a `-wal` file.
 * Rows are written once, complete: across 11k real model steps none was
 * seen without its usage, so the cursor is the last `idx` read. Decoded by
 * hand because the schema is undocumented; unknown fields are skipped.
 */
type ProtoField = {
  number: number;
  value: bigint | Uint8Array;
};

const STEP_CREATED = 1;
const STEP_USAGE = 9;
const USAGE_MODEL = 1;
const USAGE_INPUT = 2;
const USAGE_OUTPUT = 3;
const USAGE_CACHE_READ = 5;
const USAGE_THOUGHTS = 10;
const GENERATION = 1;
const GENERATION_USAGE = 4;
const GENERATION_MODEL_NAME = 19;
const TIMESTAMP_SECONDS = 1;
const TIMESTAMP_NANOS = 2;
const NANOS_PER_MS = 1_000_000;
/** Seven payload bits per varint byte; the eighth says another follows. */
const VARINT_BASE = 128;
const WIRE_TYPES = 8n;

export function decodeMessage(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let offset = 0;
  const varint = (): bigint => {
    let result = 0n;
    let weight = 1n;
    for (;;) {
      if (offset >= bytes.length) {
        throw new Error("truncated protobuf message");
      }
      const byte = bytes[offset++] as number;
      result += BigInt(byte % VARINT_BASE) * weight;
      if (byte < VARINT_BASE) {
        return result;
      }
      weight *= BigInt(VARINT_BASE);
    }
  };
  const take = (length: number): Uint8Array => {
    if (offset + length > bytes.length) {
      throw new Error("truncated protobuf message");
    }
    const slice = bytes.subarray(offset, offset + length);
    offset += length;
    return slice;
  };
  while (offset < bytes.length) {
    const tag = varint();
    const number = Number(tag / WIRE_TYPES);
    const wireType = Number(tag % WIRE_TYPES);
    if (wireType === 0) {
      fields.push({ number, value: varint() });
    } else if (wireType === 1) {
      fields.push({ number, value: take(8) });
    } else if (wireType === 2) {
      fields.push({ number, value: take(Number(varint())) });
    } else if (wireType === 5) {
      fields.push({ number, value: take(4) });
    } else {
      throw new Error(`unsupported protobuf wire type ${wireType}`);
    }
  }
  return fields;
}

function nested(fields: ProtoField[], number: number): ProtoField[] | null {
  const field = fields.find(
    (candidate) =>
      candidate.number === number && candidate.value instanceof Uint8Array
  );
  return field ? decodeMessage(field.value as Uint8Array) : null;
}

function integer(fields: ProtoField[], number: number): number | null {
  const field = fields.find(
    (candidate) =>
      candidate.number === number && typeof candidate.value === "bigint"
  );
  return field ? Number(field.value) : null;
}

function text(fields: ProtoField[], number: number): string | null {
  const field = fields.find(
    (candidate) =>
      candidate.number === number && candidate.value instanceof Uint8Array
  );
  return field ? new TextDecoder().decode(field.value as Uint8Array) : null;
}

export type StepRow = {
  idx: number;
  metadata: Uint8Array | null;
};

export type GenerationRow = {
  data: Uint8Array | null;
};

function modelOf(row: GenerationRow): [number, string] | null {
  if (!row.data) {
    return null;
  }
  try {
    const generation = nested(decodeMessage(row.data), GENERATION);
    const usage = generation && nested(generation, GENERATION_USAGE);
    const code = usage && integer(usage, USAGE_MODEL);
    const name = generation && text(generation, GENERATION_MODEL_NAME);
    return code === null || !name ? null : [code, name];
  } catch {
    return null;
  }
}

/**
 * Model code → name, from the `gen_metadata` rows of one conversation, on
 * top of what other conversations already named: a few conversations log
 * usage under a code they never name themselves.
 */
export function modelNames(
  rows: GenerationRow[],
  known = new Map<number, string>()
): Map<number, string> {
  const names = new Map(known);
  for (const row of rows) {
    const model = modelOf(row);
    if (model) {
      names.set(model[0], model[1]);
    }
  }
  return names;
}

export function normalizeAntigravityStep(
  row: StepRow,
  context: {
    sessionId: string;
    models: Map<number, string>;
    cwd?: string;
  }
): RawEvent | null {
  if (!row.metadata) {
    return null;
  }
  let fields: ProtoField[];
  try {
    fields = decodeMessage(row.metadata);
  } catch {
    return null;
  }
  const usage = nested(fields, STEP_USAGE);
  const created = nested(fields, STEP_CREATED);
  if (!(usage && created)) {
    return null;
  }
  const seconds = integer(created, TIMESTAMP_SECONDS);
  if (seconds === null) {
    return null;
  }
  const nanos = integer(created, TIMESTAMP_NANOS) ?? 0;
  const input = integer(usage, USAGE_INPUT) ?? 0;
  const output = integer(usage, USAGE_OUTPUT) ?? 0;
  const cacheRead = integer(usage, USAGE_CACHE_READ) ?? 0;
  if (input + output + cacheRead === 0) {
    return null;
  }
  const code = integer(usage, USAGE_MODEL);
  const model =
    (code === null ? undefined : context.models.get(code)) ?? "unknown";
  const thoughts = integer(usage, USAGE_THOUGHTS);
  return {
    eventId: eventId(ANTIGRAVITY, context.sessionId, row.idx),
    harness: ANTIGRAVITY,
    model: { family: modelFamily(model), provider: "google", raw: model },
    occurredAt: new Date(
      seconds * 1000 + Math.floor(nanos / NANOS_PER_MS)
    ).toISOString(),
    project: projectRef(context.cwd),
    sessionId: context.sessionId,
    tokens: {
      cacheRead,
      cacheWrite: 0,
      input,
      output,
      ...(thoughts === null ? {} : { reasoning: thoughts }),
    },
    type: "usage",
  };
}

export function antigravityConversationsDir(): string {
  return join(homedir(), ".gemini", "antigravity-cli", "conversations");
}

/** Conversation id → working directory, from `conversation_summaries.db`. */
export function workspaces(
  summariesDb: string,
  log: (message: string) => void
): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(summariesDb)) {
    return out;
  }
  let db: Database;
  try {
    db = openReadOnly(summariesDb);
  } catch (error) {
    log(`antigravity: cannot open ${summariesDb}: ${String(error)}`);
    return out;
  }
  try {
    const rows = db
      .query<{ conversation_id: string; workspace_uris: string }, []>(
        "SELECT conversation_id, workspace_uris FROM conversation_summaries"
      )
      .all();
    for (const row of rows) {
      const cwd = firstWorkspace(row.workspace_uris);
      if (cwd) {
        out.set(row.conversation_id, cwd);
      }
    }
  } catch (error) {
    log(`antigravity: cannot read ${summariesDb}: ${String(error)}`);
  } finally {
    db.close();
  }
  return out;
}

function firstWorkspace(uris: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(uris);
  } catch {
    return;
  }
  const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
  return typeof first === "string" && first.startsWith("file://")
    ? fileURLToPath(first)
    : undefined;
}

function listConversations(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => join(dir, name));
}

export async function* collectAntigravity(
  dirs: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const dir of dirs) {
    const cwds = workspaces(
      join(dirname(dir), "conversation_summaries.db"),
      ctx.log
    );
    let known = new Map<number, string>();
    const recent = listConversations(dir)
      .map((path) => ({ mtimeMs: lastWriteMs(path), path }))
      .filter(
        ({ path, mtimeMs }) => mtimeMs >= ctx.since || ctx.cursors.get(path)
      )
      .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
    for (const { path, mtimeMs } of recent) {
      const previous = ctx.cursors.get(path);
      if (previous && previous.mtimeMs === mtimeMs) {
        continue;
      }
      const sessionId = basename(path, ".db");
      const announced = new Set(previous?.seenSessions);
      let mark = typeof previous?.mark === "number" ? previous.mark : -1;
      let db: Database;
      try {
        db = openReadOnly(path);
      } catch (error) {
        ctx.log(`antigravity: cannot open ${path}: ${String(error)}`);
        continue;
      }
      let steps: StepRow[];
      let models: Map<number, string>;
      try {
        models = modelNames(
          db.query<GenerationRow, []>("SELECT data FROM gen_metadata").all(),
          known
        );
        known = models;
        steps = db
          .query<StepRow, [number]>(
            "SELECT idx, metadata FROM steps WHERE idx > ?1 ORDER BY idx ASC"
          )
          .all(mark);
      } catch (error) {
        ctx.log(`antigravity: query failed on ${path}: ${String(error)}`);
        continue;
      } finally {
        db.close();
      }
      const context = { cwd: cwds.get(sessionId), models, sessionId };
      for (const row of steps) {
        mark = Math.max(mark, row.idx);
        const event = normalizeAntigravityStep(row, context);
        if (!event || Date.parse(event.occurredAt) < ctx.since) {
          continue;
        }
        if (!announced.has(sessionId)) {
          announced.add(sessionId);
          yield {
            eventId: eventId(ANTIGRAVITY, sessionId, "start"),
            harness: ANTIGRAVITY,
            occurredAt: event.occurredAt,
            project: event.project,
            sessionId,
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
    }
    await Promise.resolve();
  }
}

export const antigravityCollector: Collector = {
  collect: (ctx) => collectAntigravity([antigravityConversationsDir()], ctx),
  discover: () =>
    Promise.resolve(
      existsSync(antigravityConversationsDir())
        ? [antigravityConversationsDir()]
        : []
    ),
  id: ANTIGRAVITY,
};
