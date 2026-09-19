import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
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
 * Antigravity CLI, desktop and IDE keep SQLite conversation databases under
 * `~/.gemini/{antigravity-cli,antigravity,antigravity-ide}/conversations`, with each step's
 * `metadata` as an undocumented protobuf. Model steps carry usage in field 9
 * (model code, input net of cache reads, output including thoughts, cache
 * reads, thought count), `gen_metadata` names the model codes and the sibling
 * `conversation_summaries.db` gives the workspace. Steps are written once and
 * complete, so the cursor is the last `idx` read.
 */
type ProtoField = { number: number; value: number | Uint8Array };

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
const VARINT_BASE = 128;
const WIRE_TYPES = 8;

export function decodeMessage(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let offset = 0;
  const varint = (): number => {
    let result = 0;
    let weight = 1;
    for (;;) {
      if (offset >= bytes.length) {
        throw new Error("truncated protobuf message");
      }
      const byte = bytes[offset++] as number;
      result += (byte % VARINT_BASE) * weight;
      if (byte < VARINT_BASE) {
        return result;
      }
      weight *= VARINT_BASE;
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
    const number = Math.floor(tag / WIRE_TYPES);
    const wireType = tag % WIRE_TYPES;
    if (wireType === 0) {
      fields.push({ number, value: varint() });
    } else if (wireType === 1) {
      fields.push({ number, value: take(8) });
    } else if (wireType === 2) {
      fields.push({ number, value: take(varint()) });
    } else if (wireType === 5) {
      fields.push({ number, value: take(4) });
    } else {
      throw new Error(`unsupported protobuf wire type ${wireType}`);
    }
  }
  return fields;
}

function nested(fields: ProtoField[], number: number): ProtoField[] | null {
  const value = fields.find((field) => field.number === number)?.value;
  return value instanceof Uint8Array ? decodeMessage(value) : null;
}

function integer(fields: ProtoField[], number: number): number | null {
  const value = fields.find((field) => field.number === number)?.value;
  return typeof value === "number" ? value : null;
}

function text(fields: ProtoField[], number: number): string | null {
  const value = fields.find((field) => field.number === number)?.value;
  return value instanceof Uint8Array ? new TextDecoder().decode(value) : null;
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

export function modelNames(rows: GenerationRow[]): Map<number, string> {
  const names = new Map<number, string>();
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
    includeReasoning?: boolean;
  }
): RawEvent | null {
  if (!row.metadata) {
    return null;
  }
  try {
    const fields = decodeMessage(row.metadata);
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
    const thoughts =
      context.includeReasoning === false
        ? null
        : integer(usage, USAGE_THOUGHTS);
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
  } catch {
    return null;
  }
}

export function antigravityConversationsDirs(home = homedir()): string[] {
  return ["antigravity-cli", "antigravity", "antigravity-ide"]
    .map((name) => join(home, ".gemini", name, "conversations"))
    .filter((path) => statSync(path, { throwIfNoEntry: false })?.isDirectory());
}

export function workspaces(
  summariesDb: string,
  log: (message: string) => void
): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(summariesDb)) {
    return out;
  }
  let db: Database | undefined;
  try {
    db = openReadOnly(summariesDb);
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
    db?.close();
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

export async function* collectAntigravity(
  dirs: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const dir of dirs) {
    // The IDE reasoning field is not verified; retain CLI semantics only.
    const includeReasoning = !["antigravity", "antigravity-ide"].includes(
      basename(dirname(dir))
    );
    const cwds = workspaces(
      join(dirname(dir), "conversation_summaries.db"),
      ctx.log
    );
    let paths: string[];
    try {
      paths = readdirSync(dir)
        .filter((name) => name.endsWith(".db"))
        .toSorted()
        .map((name) => join(dir, name));
    } catch (error) {
      ctx.log(`antigravity: cannot read ${dir}: ${String(error)}`);
      continue;
    }
    for (const path of paths) {
      const mtimeMs = lastWriteMs(path);
      const previous = ctx.cursors.get(path);
      if (previous && previous.mtimeMs === mtimeMs) {
        continue;
      }
      const sessionId = basename(path, ".db");
      const announced = new Set(previous?.seenSessions);
      let mark = typeof previous?.mark === "number" ? previous.mark : -1;
      let db: Database | undefined;
      let models: Map<number, string>;
      let steps: StepRow[];
      try {
        db = openReadOnly(path);
        models = modelNames(
          db.query<GenerationRow, []>("SELECT data FROM gen_metadata").all()
        );
        steps = db
          .query<StepRow, [number]>(
            "SELECT idx, metadata FROM steps WHERE idx > ?1 ORDER BY idx ASC"
          )
          .all(mark);
      } catch (error) {
        ctx.log(`antigravity: cannot read ${path}: ${String(error)}`);
        continue;
      } finally {
        db?.close();
      }
      const context = {
        cwd: cwds.get(sessionId),
        includeReasoning,
        models,
        sessionId,
      };
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
  collect: (ctx) => collectAntigravity(antigravityConversationsDirs(), ctx),
  discover: () => Promise.resolve(antigravityConversationsDirs()),
  id: ANTIGRAVITY,
};
