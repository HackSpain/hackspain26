import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  antigravityCollector,
  collectAntigravity,
  decodeMessage,
  modelNames,
  normalizeAntigravityStep,
  workspaces,
} from "../src/watcher/collectors/antigravity";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };
const FLASH = 1318;
const CONVERSATION = "7faacca2-78dc-4ea2-a34c-eeec8a7f08d2";
const OTHER = "0f3c1c9e-1b2a-4c3d-8e4f-5a6b7c8d9e0f";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-antigravity-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function ctx(overrides: Partial<CollectorContext> = {}): CollectorContext {
  return {
    cursors: memoryCursorStore(),
    log: () => {},
    since: 0,
    ...overrides,
  };
}

async function drain(iter: AsyncIterable<RawEvent>): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  for await (const e of iter) {
    out.push(e);
  }
  return out;
}

function expectCanonical(events: RawEvent[]): void {
  for (const raw of events) {
    expect(validateEvent(stamp(raw, IDENTITY))).toEqual([]);
    expect(raw.project?.name ?? "").not.toContain("/");
  }
}

function varint(value: number): number[] {
  let rest = BigInt(value);
  const out: number[] = [];
  do {
    const low = Number(rest % 128n);
    rest /= 128n;
    out.push(rest > 0n ? low + 128 : low);
  } while (rest > 0n);
  return out;
}

function field(number: number, value: number | string | Uint8Array): number[] {
  if (typeof value === "number") {
    return [...varint(number * 8), ...varint(value)];
  }
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes];
}

function message(...parts: number[][]): Uint8Array {
  return Uint8Array.from(parts.flat());
}

type Usage = {
  code: number;
  input: number;
  output: number;
  cacheRead?: number;
  thoughts?: number;
};

function stepMetadata(at: Date, usage?: Usage): Uint8Array {
  const seconds = Math.floor(at.getTime() / 1000);
  const nanos = (at.getTime() % 1000) * 1_000_000;
  return message(
    field(1, message(field(1, seconds), field(2, nanos))),
    field(3, 2),
    ...(usage
      ? [
          field(
            9,
            message(
              field(1, usage.code),
              field(2, usage.input),
              field(3, usage.output),
              ...(usage.cacheRead === undefined
                ? []
                : [field(5, usage.cacheRead)]),
              ...(usage.thoughts === undefined
                ? []
                : [field(10, usage.thoughts)])
            )
          ),
        ]
      : [])
  );
}

function generation(code: number, name?: string): Uint8Array {
  return message(
    field(
      1,
      message(
        field(4, message(field(1, code))),
        ...(name === undefined ? [] : [field(19, name)])
      )
    )
  );
}

function makeConversation(
  path: string,
  steps: (Uint8Array | null)[],
  generations: Uint8Array[]
): void {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.run(
    "CREATE TABLE steps (idx integer, step_type integer NOT NULL DEFAULT 0, status integer NOT NULL DEFAULT 0, metadata blob, PRIMARY KEY (idx))"
  );
  db.run(
    "CREATE TABLE gen_metadata (idx integer, data blob, size integer NOT NULL DEFAULT 0, PRIMARY KEY (idx))"
  );
  for (const [idx, metadata] of steps.entries()) {
    db.run(
      "INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, 3, ?)",
      [idx, metadata ? 15 : 132, metadata]
    );
  }
  for (const [idx, data] of generations.entries()) {
    db.run("INSERT INTO gen_metadata (idx, data) VALUES (?, ?)", [idx, data]);
  }
  // agy leaves a WAL database with no -wal beside it; a plain read-only
  // open of that fails, which is what the collector has to cope with.
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

function appendStep(path: string, idx: number, metadata: Uint8Array): void {
  const db = new Database(path);
  db.run(
    "INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, 15, 3, ?)",
    [idx, metadata]
  );
  db.close();
}

function makeSummaries(path: string, rows: [string, string][]): void {
  const db = new Database(path);
  db.run(
    "CREATE TABLE conversation_summaries (conversation_id text, workspace_uris text NOT NULL, PRIMARY KEY (conversation_id))"
  );
  for (const [id, uris] of rows) {
    db.run(
      "INSERT INTO conversation_summaries (conversation_id, workspace_uris) VALUES (?, ?)",
      [id, uris]
    );
  }
  db.close();
}

describe("antigravity", () => {
  const at = new Date("2026-09-19T10:00:01.500Z");

  test("decode: varints, nested messages and strings, garbage rejected", () => {
    const fields = decodeMessage(
      message(field(1, 300), field(2, "gemini"), field(3, message(field(1, 7))))
    );
    expect(fields.map((f) => f.number)).toEqual([1, 2, 3]);
    expect(fields[0]?.value).toBe(300n);
    expect(new TextDecoder().decode(fields[1]?.value as Uint8Array)).toBe(
      "gemini"
    );
    expect(() => decodeMessage(Uint8Array.from([10, 16, 1]))).toThrow(
      "truncated"
    );
    expect(() => decodeMessage(Uint8Array.from([11]))).toThrow("wire type");
  });

  test("normalize: usage, thoughts, timestamp and model name; steps without usage are skipped", () => {
    const models = modelNames([
      { data: generation(FLASH, "gemini-3.8-flash") },
      { data: generation(1319) },
      { data: Uint8Array.from([255]) },
      { data: null },
    ]);
    expect([...models]).toEqual([[FLASH, "gemini-3.8-flash"]]);
    const context = {
      cwd: "/home/hacker/agentos",
      models,
      sessionId: CONVERSATION,
    };
    const event = normalizeAntigravityStep(
      {
        idx: 4,
        metadata: stepMetadata(at, {
          cacheRead: 120_000,
          code: FLASH,
          input: 19_236,
          output: 481,
          thoughts: 109,
        }),
      },
      context
    );
    expect(event).toEqual({
      eventId: `antigravity:${CONVERSATION}:4`,
      harness: "antigravity",
      model: { family: "gemini", provider: "google", raw: "gemini-3.8-flash" },
      occurredAt: "2026-09-19T10:00:01.500Z",
      project: { dirHash: expect.any(String), name: "agentos" },
      sessionId: CONVERSATION,
      tokens: {
        cacheRead: 120_000,
        cacheWrite: 0,
        input: 19_236,
        output: 481,
        reasoning: 109,
      },
      type: "usage",
    });
    const stamped = stamp(event as RawEvent, IDENTITY);
    expect(validateEvent(stamped)).toEqual([]);
    expect(stamped.model?.name).toBe("gemini-3-8-flash");
    expect(stamped.tokens?.total).toBe(139_717);

    const unnamed = normalizeAntigravityStep(
      {
        idx: 5,
        metadata: stepMetadata(at, { code: 1319, input: 10, output: 1 }),
      },
      context
    );
    expect(unnamed?.model).toEqual({
      family: "other",
      provider: "google",
      raw: "unknown",
    });
    expect(unnamed?.tokens).toEqual({
      cacheRead: 0,
      cacheWrite: 0,
      input: 10,
      output: 1,
    });
    expect(unnamed?.project).toBeDefined();

    expect(
      normalizeAntigravityStep({ idx: 6, metadata: stepMetadata(at) }, context)
    ).toBeNull();
    expect(
      normalizeAntigravityStep(
        {
          idx: 7,
          metadata: stepMetadata(at, { code: FLASH, input: 0, output: 0 }),
        },
        context
      )
    ).toBeNull();
    expect(
      normalizeAntigravityStep({ idx: 8, metadata: null }, context)
    ).toBeNull();
    expect(
      normalizeAntigravityStep(
        { idx: 9, metadata: Uint8Array.from([10, 255]) },
        context
      )
    ).toBeNull();
    expect(
      normalizeAntigravityStep(
        { idx: 10, metadata: message(field(9, message(field(2, 5)))) },
        context
      )
    ).toBeNull();
  });

  test("workspaces: first file:// uri per conversation, others ignored", () => {
    const path = join(dir, "conversation_summaries.db");
    makeSummaries(path, [
      [CONVERSATION, JSON.stringify(["file:///home/hacker/agentos"])],
      [OTHER, "[]"],
      ["broken", "not json"],
      ["remote", JSON.stringify(["vscode-remote://ssh/x"])],
    ]);
    expect([...workspaces(path, () => {})]).toEqual([
      [CONVERSATION, "/home/hacker/agentos"],
    ]);
    expect([...workspaces(join(dir, "missing.db"), () => {})]).toEqual([]);
  });

  test("collect: reads WAL databases without their -wal file, announces once, restart reads only new steps", async () => {
    const conversations = join(dir, "conversations");
    mkdirSync(conversations);
    makeSummaries(join(dir, "conversation_summaries.db"), [
      [CONVERSATION, JSON.stringify(["file:///home/hacker/agentos"])],
    ]);
    const main = join(conversations, `${CONVERSATION}.db`);
    makeConversation(
      main,
      [
        stepMetadata(new Date("2026-09-19T10:00:00Z")),
        stepMetadata(new Date("2026-09-19T10:00:01Z"), {
          cacheRead: 1000,
          code: FLASH,
          input: 500,
          output: 40,
          thoughts: 10,
        }),
        null,
        stepMetadata(new Date("2026-09-19T10:00:05Z"), {
          cacheRead: 1500,
          code: FLASH,
          input: 20,
          output: 60,
        }),
      ],
      [generation(FLASH, "gemini-3.8-flash")]
    );
    const other = join(conversations, `${OTHER}.db`);
    makeConversation(
      other,
      [
        stepMetadata(new Date("2026-09-19T11:00:00Z"), {
          code: 1298,
          input: 5,
          output: 5,
        }),
      ],
      [generation(1298, "gemini-3.7-flash")]
    );
    expect(existsSync(`${main}-wal`)).toBe(false);

    const cursors = memoryCursorStore();
    const first = await drain(
      collectAntigravity([conversations], ctx({ cursors }))
    );
    expect(first.map((e) => [e.type, e.sessionId.slice(0, 8)])).toEqual([
      ["session.start", "0f3c1c9e"],
      ["usage", "0f3c1c9e"],
      ["session.start", "7faacca2"],
      ["usage", "7faacca2"],
      ["usage", "7faacca2"],
    ]);
    expectCanonical(first);
    expect(first[1]).toMatchObject({
      model: { raw: "gemini-3.7-flash" },
      tokens: { input: 5, output: 5 },
    });
    expect(first[1]?.project).toBeUndefined();
    expect(first[2]).toMatchObject({
      eventId: `antigravity:${CONVERSATION}:start`,
      project: { name: "agentos" },
    });
    expect(first[3]).toMatchObject({
      eventId: `antigravity:${CONVERSATION}:1`,
      occurredAt: "2026-09-19T10:00:01.000Z",
      tokens: { cacheRead: 1000, input: 500, output: 40, reasoning: 10 },
    });
    expect(first[4]?.tokens).not.toHaveProperty("reasoning");

    expect(
      await drain(collectAntigravity([conversations], ctx({ cursors })))
    ).toEqual([]);

    appendStep(
      main,
      4,
      stepMetadata(new Date("2026-09-19T10:00:09Z"), {
        code: FLASH,
        input: 7,
        output: 3,
      })
    );
    const third = await drain(
      collectAntigravity([conversations], ctx({ cursors }))
    );
    expect(third).toHaveLength(1);
    expect(third[0]).toMatchObject({
      eventId: `antigravity:${CONVERSATION}:4`,
      project: { name: "agentos" },
      tokens: { input: 7, output: 3 },
      type: "usage",
    });
  });

  test("collect: --since drops older steps but the cursor still moves past them", async () => {
    const conversations = join(dir, "conversations");
    mkdirSync(conversations);
    const main = join(conversations, `${CONVERSATION}.db`);
    makeConversation(
      main,
      [
        stepMetadata(new Date("2026-09-19T10:00:01Z"), {
          code: FLASH,
          input: 1,
          output: 1,
        }),
        stepMetadata(new Date("2026-09-19T10:30:00Z"), {
          code: FLASH,
          input: 2,
          output: 2,
        }),
      ],
      [generation(FLASH, "gemini-3.8-flash")]
    );
    const written = new Date("2026-09-19T10:30:00Z");
    utimesSync(main, written, written);
    const cursors = memoryCursorStore();
    const since = Date.parse("2026-09-19T10:15:00Z");
    const events = await drain(
      collectAntigravity([conversations], ctx({ cursors, since }))
    );
    expect(events.map((e) => e.type)).toEqual(["session.start", "usage"]);
    expect(events[1]?.eventId).toBe(`antigravity:${CONVERSATION}:1`);
    expect(
      await drain(collectAntigravity([conversations], ctx({ cursors, since })))
    ).toEqual([]);
  });

  test("collect: an unreadable database is logged and skipped", async () => {
    const conversations = join(dir, "conversations");
    mkdirSync(conversations);
    const db = new Database(join(conversations, `${OTHER}.db`));
    db.run("CREATE TABLE unrelated (id integer)");
    db.close();
    const logs: string[] = [];
    const events = await drain(
      collectAntigravity([conversations], ctx({ log: (m) => logs.push(m) }))
    );
    expect(events).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("antigravity: query failed");
  });

  test("discover: only when the conversations directory exists", async () => {
    const roots = await antigravityCollector.discover();
    for (const root of roots) {
      expect(existsSync(root)).toBe(true);
      expect(root.endsWith(join("antigravity-cli", "conversations"))).toBe(
        true
      );
    }
  });
});
