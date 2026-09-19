import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "../src/lib/api";
import { EXIT } from "../src/lib/errors";
import type { Me } from "../src/lib/me";
import { createBatcher } from "../src/watcher/batcher";
import { collectClaudeCode } from "../src/watcher/collectors/claude-code";
import { collectCline } from "../src/watcher/collectors/cline";
import { collectCodex } from "../src/watcher/collectors/codex";
import { collectGeminiCli } from "../src/watcher/collectors/gemini-cli";
import { collectOpenCode } from "../src/watcher/collectors/opencode";
import { collectQwenCode } from "../src/watcher/collectors/qwen-code";
import {
  memoryCursorStore,
  openCursorStore,
} from "../src/watcher/cursor-store";
import { runWatch, scanOnce, stamp } from "../src/watcher/index";
import { ephemeralMemory } from "../src/watcher/memory";
import type { RawEvent, TelemetryEvent } from "../src/watcher/schema";
import { HARNESSES } from "../src/watcher/schema";
import { readSpool, spoolSink } from "../src/watcher/sinks/spool";
import type { Collector, CollectorContext } from "../src/watcher/types";

const START = Date.parse("2026-09-18T16:45:00Z");
const END = Date.parse("2026-09-20T16:00:00Z");
const AT = new Date(START + 1000).toISOString();
const IDENTITY = { userId: "user", clientVersion: "test" };
const FIXTURES = join(import.meta.dir, "fixtures");
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hs-history-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function context(): CollectorContext {
  return {
    cursors: memoryCursorStore(),
    since: START,
    until: END,
    log: () => {},
  };
}

async function drain(source: AsyncIterable<RawEvent>) {
  const events: RawEvent[] = [];
  for await (const event of source) {
    events.push(event);
  }
  return events;
}

function oldMtime(path: string): void {
  utimesSync(path, new Date(START - 86_400_000), new Date(START - 86_400_000));
}

function dateLogs(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      dateLogs(path);
    } else if (entry.name.endsWith(".jsonl")) {
      const rows = readFileSync(path, "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const value = JSON.parse(line);
          if (value.timestamp) {
            value.timestamp = AT;
          }
          return JSON.stringify(value);
        });
      writeFileSync(path, `${rows.join("\n")}\n`);
      oldMtime(path);
    }
  }
}

describe("historical JSONL files", () => {
  test.each([
    ["claude-code", collectClaudeCode],
    ["codex", collectCodex],
    ["gemini-cli", collectGeminiCli],
    ["qwen-code", collectQwenCode],
  ] as const)("%s trusts recorded event time even when file mtime is old", async (name, collect) => {
    const root = join(dir, name);
    if (name === "claude-code") {
      const nested = join(root, "projects", "project", "session", "subagents");
      mkdirSync(nested, { recursive: true });
      cpSync(
        join(FIXTURES, name, "session.jsonl"),
        join(nested, "agent.jsonl")
      );
    } else if (name === "codex") {
      cpSync(join(FIXTURES, name), join(root, "archived_sessions"), {
        recursive: true,
      });
    } else {
      cpSync(join(FIXTURES, name), root, { recursive: true });
    }
    dateLogs(root);
    const ctx = context();
    const events = await drain(collect([root], ctx));
    expect(
      events.filter((event) => event.type === "usage").length
    ).toBeGreaterThan(0);
    expect(events.every((event) => event.occurredAt === AT)).toBe(true);
    expect(await drain(collect([root], ctx))).toEqual([]);
  });
});

test.each([
  "opencode",
  "kilo-code",
] as const)("%s recovers over 500 rows sharing an update timestamp and late boundary inserts", async (harness) => {
  const path = join(dir, "usage.db");
  const db = new Database(path);
  db.run(
    "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_updated INTEGER, data TEXT)"
  );
  const insert = db.query("INSERT INTO message VALUES (?, 'session', 1, ?)");
  const data = JSON.stringify({
    role: "assistant",
    modelID: "claude-sonnet-4-5",
    tokens: { input: 1, output: 2 },
    time: { completed: START },
  });
  db.transaction(() => {
    for (let i = 0; i < 601; i++) {
      insert.run(`msg-${String(i).padStart(4, "0")}`, data);
    }
    insert.run(
      "malformed",
      JSON.stringify({
        role: "assistant",
        tokens: {},
        time: { completed: "invalid" },
      })
    );
  })();
  const collector: Collector = {
    id: harness,
    discover: async () => [path],
    collect: (ctx) => collectOpenCode([path], ctx, harness),
  };
  const ctx = context();
  const events: TelemetryEvent[] = [];
  const batcher = createBatcher(
    [
      {
        name: "test",
        write: async (batch) => {
          events.push(...batch);
        },
      },
    ],
    ctx.log
  );
  const recent = new Set<string>();
  try {
    await scanOnce([collector], ctx, batcher, IDENTITY, recent);
    await batcher.flush();
    expect(events.filter((event) => event.type === "usage")).toHaveLength(601);
    insert.run("aaa-added-later", data);
    await scanOnce([collector], ctx, batcher, IDENTITY, recent);
    await batcher.flush();
    expect(events.filter((event) => event.type === "usage")).toHaveLength(602);
  } finally {
    db.close();
  }
});

test("Cline includes the exact start boundary and later completed requests behind an unfinished one", async () => {
  const task = join(dir, "task");
  mkdirSync(task);
  const file = join(task, "ui_messages.json");
  const message = (ts: number, usage: unknown) => ({
    type: "say",
    say: "api_req_started",
    ts,
    text: JSON.stringify(usage),
  });
  writeFileSync(
    file,
    JSON.stringify([
      message(START, {}),
      message(START + 1, { tokensIn: 3, tokensOut: 4 }),
    ])
  );
  oldMtime(file);
  const ctx = context();
  const first = await drain(collectCline([dir], ctx));
  expect(
    first
      .filter((event) => event.type === "usage")
      .map((event) => event.occurredAt)
  ).toEqual([new Date(START + 1).toISOString()]);
  expect(ctx.cursors.get(file)?.mark).toBe(START - 1);
  writeFileSync(
    file,
    JSON.stringify([
      message(START, { tokensIn: 1, tokensOut: 2 }),
      message(START + 1, { tokensIn: 3, tokensOut: 4 }),
    ])
  );
  const later = await drain(collectCline([dir], ctx));
  expect(
    later
      .filter((event) => event.type === "usage")
      .map((event) => event.occurredAt)
  ).toContain(new Date(START).toISOString());
});

test.each([
  "none",
  "collector",
  "discovery",
] as const)("late HTTP catch-up replays saved cursors/spool and reports failures: %s", async (failure) => {
  const keys = ["XDG_STATE_HOME", "LOCALAPPDATA"] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  for (const key of keys) {
    process.env[key] = dir;
  }
  const received: TelemetryEvent[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      expect(request.headers.get("authorization")).toBe(
        "Bearer synthetic-test-token"
      );
      const events = (await request.text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      received.push(...events);
      return Response.json({
        ok: true,
        value: {
          accepted: events.length,
          rejected: 0,
          rejections: [],
          stored: true,
        },
      });
    },
  });
  try {
    const raw = (
      harness: RawEvent["harness"],
      id: string,
      at = START
    ): RawEvent => ({
      eventId: `${harness}:session:${id}`,
      harness,
      sessionId: "session",
      type: "usage",
      occurredAt: new Date(at).toISOString(),
      model: { raw: "claude-sonnet-4-5" },
      tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
    });
    const cursors = openCursorStore();
    cursors.coverFrom(START);
    for (const harness of HARNESSES) {
      cursors.set(harness, { offset: 999, mtimeMs: Date.now() });
    }
    cursors.save();
    await spoolSink().write([
      ...HARNESSES.map((harness) =>
        stamp(raw(harness, "spool-only"), IDENTITY)
      ),
      stamp(raw("codex", "other-user"), {
        userId: "someone-else",
        clientVersion: "test",
      }),
      stamp(raw("codex", "before", START - 1), IDENTITY),
    ]);
    const collectors: Collector[] = HARNESSES.map((id) => ({
      id,
      discover: async () => [id],
      async *collect(ctx) {
        if (ctx.cursors.get(id)) {
          return;
        }
        yield raw(id, "source");
        yield raw(id, "spool-only");
        yield raw(id, "before", START - 1);
        ctx.cursors.set(id, { offset: 1000, mtimeMs: Date.now() });
      },
    }));
    if (failure !== "none") {
      collectors.push({
        id: "codex",
        async discover() {
          if (failure === "discovery") {
            throw new Error("source unavailable");
          }
          return ["unreadable"];
        },
        async *collect() {
          yield raw("codex", "spool-only");
          throw new Error("source unavailable");
        },
      });
    }
    const code = await runWatch(
      {
        backfill: true,
        once: true,
        intervalMs: 30_000,
        window: { since: START, until: END },
        toast: false,
        verbose: false,
        uploadUrl: new URL("/api/cli/telemetry", server.url).href,
      },
      {
        collectors,
        me: { _id: "user", role: "user" } as Me,
        session: {
          token: async () => "synthetic-test-token",
          client: {},
        } as Session,
        memory: ephemeralMemory(),
        log: () => {},
        say: () => {},
      }
    );
    expect(code).toBe(failure === "none" ? EXIT.OK : EXIT.NETWORK);
    expect(received).toHaveLength(HARNESSES.length * 2);
    expect([...readSpool()]).toHaveLength(HARNESSES.length * 2 + 2);
    expect(new Set(received.map((event) => event.eventId)).size).toBe(
      received.length
    );
    expect(
      received.every(
        (event) => event.occurredAt === new Date(START).toISOString()
      )
    ).toBe(true);
    expect(received.every((event) => event.identity.userId === "user")).toBe(
      true
    );
  } finally {
    await server.stop(true);
    for (const key of keys) {
      if (previous[key] === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = previous[key];
      }
    }
  }
});
