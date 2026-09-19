import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectDevin,
  devinCollector,
  devinDbPath,
  normalizeDevin,
} from "../src/watcher/collectors/devin";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };
const SESSION = {
  backend_type: "windsurf",
  id: "fine-tarn",
  model: "gpt-5-6-sol-medium",
  working_directory: "/home/hacker/agentos",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-devin-"));
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

function assistant(
  messageId: string,
  metrics: Record<string, number | null>
): string {
  return JSON.stringify({
    content: "[redacted]",
    message_id: messageId,
    metadata: { metrics: { ttft_ms: 30, ...metrics } },
    role: "assistant",
  });
}

const AT = 1_789_812_000;

function makeDb(path: string, rows: [string, number, string][]): void {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.run(
    "CREATE TABLE sessions (id TEXT PRIMARY KEY, working_directory TEXT NOT NULL, backend_type TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL)"
  );
  db.run(
    "CREATE TABLE message_nodes (row_id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, node_id INTEGER NOT NULL, created_at INTEGER NOT NULL, chat_message TEXT NOT NULL)"
  );
  db.run(
    "INSERT INTO sessions (id, working_directory, backend_type, model, created_at) VALUES (?, ?, ?, ?, ?)",
    [
      SESSION.id,
      SESSION.working_directory,
      SESSION.backend_type,
      SESSION.model,
      AT,
    ]
  );
  for (const [node, [sessionId, createdAt, chatMessage]] of rows.entries()) {
    db.run(
      "INSERT INTO message_nodes (session_id, node_id, created_at, chat_message) VALUES (?, ?, ?, ?)",
      [sessionId, node, createdAt, chatMessage]
    );
  }
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

describe("devin", () => {
  test("normalize: assistant metrics only, nulls as zero, session gives model, backend and cwd", () => {
    const row = {
      chat_message: assistant("m1", {
        cache_creation_tokens: null,
        cache_read_tokens: 19_162,
        input_tokens: 3,
        output_tokens: 269,
      }),
      created_at: AT,
      row_id: 7,
      session_id: SESSION.id,
    };
    const event = normalizeDevin(row, SESSION);
    expect(event).toEqual({
      eventId: "devin:fine-tarn:m1",
      harness: "devin",
      model: { family: "gpt", provider: "windsurf", raw: "gpt-5-6-sol-medium" },
      occurredAt: "2026-09-19T10:00:00.000Z",
      project: { dirHash: expect.any(String), name: "agentos" },
      sessionId: SESSION.id,
      tokens: { cacheRead: 19_162, cacheWrite: 0, input: 3, output: 269 },
      type: "usage",
    });
    const stamped = stamp(event as RawEvent, IDENTITY);
    expect(validateEvent(stamped)).toEqual([]);
    expect(stamped.tokens?.total).toBe(19_434);

    const orphan = normalizeDevin(row, undefined);
    expect(orphan?.model).toEqual({ family: "other", raw: "unknown" });
    expect(orphan?.project).toBeUndefined();
    expect(validateEvent(stamp(orphan as RawEvent, IDENTITY))).toEqual([]);

    const user = JSON.stringify({ message_id: "u1", role: "user" });
    expect(normalizeDevin({ ...row, chat_message: user }, SESSION)).toBeNull();
    const tool = JSON.stringify({
      message_id: "t1",
      metadata: { metrics: null },
      role: "tool",
    });
    expect(normalizeDevin({ ...row, chat_message: tool }, SESSION)).toBeNull();
    expect(
      normalizeDevin(
        {
          ...row,
          chat_message: assistant("m2", { input_tokens: 0, output_tokens: 0 }),
        },
        SESSION
      )
    ).toBeNull();
    expect(normalizeDevin({ ...row, chat_message: "{" }, SESSION)).toBeNull();
    expect(
      normalizeDevin({ ...row, chat_message: "null" }, SESSION)
    ).toBeNull();
    expect(normalizeDevin({ ...row, chat_message: "[]" }, SESSION)).toBeNull();
  });

  test("collect: dedupes the two chains, announces once, restart reads only new rows", async () => {
    const path = join(dir, "sessions.db");
    const first = assistant("m1", {
      cache_read_tokens: 512,
      input_tokens: 17_615,
      output_tokens: 48,
    });
    const second = assistant("m2", {
      cache_creation_tokens: 200,
      cache_read_tokens: 19_162,
      input_tokens: 3,
      output_tokens: 269,
    });
    makeDb(path, [
      [SESSION.id, AT, JSON.stringify({ message_id: "s1", role: "system" })],
      [SESSION.id, AT, first],
      [SESSION.id, AT, first],
      [SESSION.id, AT + 30, second],
      [SESSION.id, AT + 30, second],
    ]);
    const cursors = memoryCursorStore();
    const events = await drain(collectDevin([path], ctx({ cursors })));
    expect(events.map((e) => e.eventId)).toEqual([
      "devin:fine-tarn:start",
      "devin:fine-tarn:m1",
      "devin:fine-tarn:m2",
    ]);
    expectCanonical(events);
    expect(events[0]?.project).toEqual({
      dirHash: expect.any(String),
      name: "agentos",
    });
    expect(events[2]?.tokens).toEqual({
      cacheRead: 19_162,
      cacheWrite: 200,
      input: 3,
      output: 269,
    });
    expect(await drain(collectDevin([path], ctx({ cursors })))).toEqual([]);

    const db = new Database(path);
    db.run(
      "INSERT INTO message_nodes (session_id, node_id, created_at, chat_message) VALUES (?, ?, ?, ?)",
      [
        SESSION.id,
        9,
        AT + 60,
        assistant("m3", { input_tokens: 5, output_tokens: 7 }),
      ]
    );
    db.close();
    const third = await drain(collectDevin([path], ctx({ cursors })));
    expect(third.map((e) => e.eventId)).toEqual(["devin:fine-tarn:m3"]);
    expect(third[0]?.occurredAt).toBe("2026-09-19T10:01:00.000Z");
  });

  test("collect: --since drops older messages but the cursor still moves past them", async () => {
    const path = join(dir, "sessions.db");
    makeDb(path, [
      [SESSION.id, AT, assistant("m1", { input_tokens: 1, output_tokens: 1 })],
      [
        SESSION.id,
        AT + 3600,
        assistant("m2", { input_tokens: 2, output_tokens: 2 }),
      ],
    ]);
    const written = new Date((AT + 3600) * 1000);
    utimesSync(path, written, written);
    const cursors = memoryCursorStore();
    const since = (AT + 1800) * 1000;
    const events = await drain(collectDevin([path], ctx({ cursors, since })));
    expect(events.map((e) => e.eventId)).toEqual([
      "devin:fine-tarn:start",
      "devin:fine-tarn:m2",
    ]);
    expect(await drain(collectDevin([path], ctx({ cursors, since })))).toEqual(
      []
    );
  });

  test("collect: an unreadable database is logged and skipped", async () => {
    const path = join(dir, "sessions.db");
    const db = new Database(path);
    db.run("CREATE TABLE unrelated (id integer)");
    db.close();
    const logs: string[] = [];
    expect(
      await drain(collectDevin([path], ctx({ log: (m) => logs.push(m) })))
    ).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("devin: cannot read");
  });

  test("database discovery follows the override and needs the file", async () => {
    const saved = process.env.HACKSPAIN_DEVIN_DB;
    try {
      process.env.HACKSPAIN_DEVIN_DB = join(dir, "devin", "cli", "sessions.db");
      expect(devinDbPath()).toBe(join(dir, "devin", "cli", "sessions.db"));
      expect(await devinCollector.discover()).toEqual([]);
      mkdirSync(join(dir, "devin", "cli"), { recursive: true });
      makeDb(devinDbPath(), []);
      expect(await devinCollector.discover()).toEqual([devinDbPath()]);
    } finally {
      delete process.env.HACKSPAIN_DEVIN_DB;
      if (saved !== undefined) {
        process.env.HACKSPAIN_DEVIN_DB = saved;
      }
    }
  });
});

test("Devin resolves Windows, Linux and macOS paths without host-specific joins", () => {
  expect(
    devinDbPath(
      "win32",
      {
        APPDATA: "C:\\Users\\sam\\AppData\\Roaming",
        XDG_DATA_HOME: "/ignored",
      },
      "C:\\Users\\sam"
    )
  ).toBe("C:\\Users\\sam\\AppData\\Roaming\\devin\\cli\\sessions.db");
  expect(devinDbPath("win32", {}, "C:\\Users\\sam")).toBe(
    "C:\\Users\\sam\\AppData\\Roaming\\devin\\cli\\sessions.db"
  );
  expect(
    devinDbPath("linux", { XDG_DATA_HOME: "/custom/data" }, "/home/sam")
  ).toBe("/custom/data/devin/cli/sessions.db");
  expect(devinDbPath("darwin", {}, "/Users/sam")).toBe(
    "/Users/sam/.local/share/devin/cli/sessions.db"
  );
  expect(
    devinDbPath(
      "linux",
      { HACKSPAIN_DEVIN_DB: "/mounted/sessions.db" },
      "/home/sam"
    )
  ).toBe("/mounted/sessions.db");
});

test("Devin reads new WAL rows even when database and WAL mtimes are unchanged", async () => {
  const path = join(dir, "sessions.db");
  makeDb(path, [[SESSION.id, AT, assistant("m1", { input_tokens: 1 })]]);
  const previousTime = new Date(AT * 1000);
  utimesSync(path, previousTime, previousTime);
  const cursors = memoryCursorStore();
  await drain(collectDevin([path], ctx({ cursors })));
  const writer = new Database(path);
  try {
    writer.run("PRAGMA journal_mode=WAL");
    writer.run(
      "INSERT INTO message_nodes (session_id, node_id, created_at, chat_message) VALUES (?, ?, ?, ?)",
      [SESSION.id, 10, AT + 1, assistant("wal", { input_tokens: 10 })]
    );
    utimesSync(path, previousTime, previousTime);
    utimesSync(`${path}-wal`, previousTime, previousTime);
    const events = await drain(collectDevin([path], ctx({ cursors })));
    expect(events.map((event) => event.eventId)).toEqual([
      "devin:fine-tarn:wal",
    ]);
  } finally {
    writer.close();
  }
});

test("Devin retries disappearing databases, pages large histories and resets row cursors", async () => {
  const path = join(dir, "sessions.db");
  const logs: string[] = [];
  const context = ctx({ log: (message) => logs.push(message) });
  expect(await drain(collectDevin([path], context))).toEqual([]);
  expect(context.cursors.get(path)).toBeUndefined();
  makeDb(
    path,
    Array.from({ length: 601 }, (_, i) => [
      SESSION.id,
      AT + i,
      assistant(`m${i}`, { input_tokens: 1 }),
    ])
  );
  expect(await drain(collectDevin([path], context))).toHaveLength(602);
  const db = new Database(path);
  db.run("DELETE FROM message_nodes");
  db.run(
    "INSERT INTO message_nodes (row_id, session_id, node_id, created_at, chat_message) VALUES (?, ?, ?, ?, ?)",
    [1, SESSION.id, 1, AT + 700, assistant("reset", { output_tokens: 7 })]
  );
  db.close();
  expect((await drain(collectDevin([path], context))).at(-1)?.eventId).toBe(
    "devin:fine-tarn:reset"
  );
});

test("Devin rejects malformed timestamps and metrics without poisoning later rows", async () => {
  const path = join(dir, "sessions.db");
  makeDb(path, [
    [SESSION.id, 1e100, assistant("bad-time", { input_tokens: 1 })],
    [SESSION.id, AT, assistant("bad-tokens", { input_tokens: -10 })],
    [SESSION.id, AT, assistant("good", { input_tokens: 1 })],
  ]);
  const events = await drain(collectDevin([path], ctx()));
  expect(events.map((event) => event.eventId)).toEqual([
    "devin:fine-tarn:start",
    "devin:fine-tarn:good",
  ]);
});
