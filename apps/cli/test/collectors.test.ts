import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectClaudeCode,
  normalizeClaudeCode,
} from "../src/watcher/collectors/claude-code";
import { collectCline, normalizeCline } from "../src/watcher/collectors/cline";
import {
  collectCodex,
  initialCodexState,
  normalizeCodex,
} from "../src/watcher/collectors/codex";
import { parseJsonLine, tailJsonl } from "../src/watcher/collectors/jsonl-tail";
import {
  collectOpenCode,
  normalizeOpenCode,
} from "../src/watcher/collectors/opencode";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import { type RawEvent, validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const FIXTURES = join(import.meta.dir, "fixtures");
const IDENTITY = { userId: "u1", teamId: "t1", clientVersion: "test" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-collectors-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function ctx(overrides: Partial<CollectorContext> = {}): CollectorContext {
  return {
    cursors: memoryCursorStore(),
    since: 0,
    log: () => {},
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

describe("claude-code", () => {
  const fixture = join(FIXTURES, "claude-code", "session.jsonl");

  test("normalize: usage from assistant lines, synthetic skipped, others ignored", () => {
    const lines = readFileSync(fixture, "utf8")
      .trim()
      .split("\n")
      .map(parseJsonLine);
    const events = lines.map(normalizeClaudeCode);
    expect(events.filter(Boolean)).toHaveLength(6);
    const first = events.find(Boolean);
    expect(first?.model).toEqual({
      raw: "claude-fable-5-1",
      family: "claude",
      provider: "anthropic",
    });
    expect(first?.tokens).toMatchObject({ input: 2, output: 344 });
    expect(first?.project?.name).toBe("agentos");
    expect(events[8]).toBeNull(); // <synthetic>
    expect(events[9]).toBeNull(); // cost-state
  });

  test("collect: dedupes the per-block repeats, announces the session once, restart yields nothing", async () => {
    const root = join(dir, "claude");
    mkdirSync(join(root, "projects", "-home-hacker-agentos"), {
      recursive: true,
    });
    const file = join(
      root,
      "projects",
      "-home-hacker-agentos",
      "session.jsonl"
    );
    cpSync(fixture, file);
    const cursors = memoryCursorStore();
    const first = await drain(collectClaudeCode([root], ctx({ cursors })));
    expect(first.map((e) => e.type)).toEqual([
      "session.start",
      "usage",
      "usage",
    ]);
    expect(new Set(first.map((e) => e.eventId)).size).toBe(3);
    expectCanonical(first);

    const again = await drain(collectClaudeCode([root], ctx({ cursors })));
    expect(again).toEqual([]);

    appendFileSync(
      file,
      `${JSON.stringify({
        type: "assistant",
        sessionId: first[0]?.sessionId,
        timestamp: "2026-09-05T11:00:00.000Z",
        cwd: "/home/hacker/agentos",
        requestId: "req_new",
        apiBlockIndex: 0,
        message: {
          id: "msg_new",
          model: "claude-opus-5",
          role: "assistant",
          usage: {
            input_tokens: 5,
            output_tokens: 6,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 7,
          },
        },
      })}\n`
    );
    const appended = await drain(collectClaudeCode([root], ctx({ cursors })));
    expect(appended.map((e) => e.type)).toEqual(["usage"]);
    expect(appended[0]?.model?.raw).toBe("claude-opus-5");
  });

  test("collect: --since filters older events", async () => {
    const root = join(dir, "claude");
    mkdirSync(join(root, "projects", "p"), { recursive: true });
    cpSync(fixture, join(root, "projects", "p", "s.jsonl"));
    const events = await drain(
      collectClaudeCode([root], ctx({ since: Date.parse("2030-01-01") }))
    );
    expect(events).toEqual([]);
  });
});

describe("jsonl-tail", () => {
  test("leaves a partial trailing line for the next read and survives rotation", () => {
    const file = join(dir, "t.jsonl");
    const cursors = memoryCursorStore();
    writeFileSync(file, '{"a":1}\n{"a":2');
    let r = tailJsonl(file, cursors);
    expect(r.lines).toEqual(['{"a":1}']);
    cursors.set(file, r.cursor);
    appendFileSync(file, '}\n{"a":3}\n');
    r = tailJsonl(file, cursors);
    expect(r.lines).toEqual(['{"a":2}', '{"a":3}']);
    cursors.set(file, r.cursor);
    writeFileSync(file, '{"a":4}\n'); // truncated + rewritten
    r = tailJsonl(file, cursors);
    expect(r.lines).toEqual(['{"a":4}']);
  });
});

describe("codex", () => {
  const fixture = join(
    FIXTURES,
    "codex",
    "rollout-2026-09-19T10-00-00-0f3c1c9e-1b2a-4c3d-8e4f-5a6b7c8d9e0f.jsonl"
  );

  test("normalize: model from turn_context, input net of cache, reasoning kept, null info skipped", () => {
    const state = initialCodexState(fixture);
    const events = readFileSync(fixture, "utf8")
      .trim()
      .split("\n")
      .map((line) => normalizeCodex(parseJsonLine(line), state));
    const usage = events.filter(Boolean) as RawEvent[];
    expect(usage).toHaveLength(2);
    expect(usage[0]?.sessionId).toBe("0f3c1c9e-1b2a-4c3d-8e4f-5a6b7c8d9e0f");
    expect(usage[0]?.model).toEqual({
      raw: "gpt-5-codex",
      family: "gpt",
      provider: "openai",
    });
    expect(usage[0]?.tokens).toEqual({
      input: 400,
      output: 150,
      cacheRead: 800,
      cacheWrite: 0,
      reasoning: 40,
    });
    expect(usage[1]?.tokens).toEqual({
      input: 200,
      output: 250,
      cacheRead: 1600,
      cacheWrite: 0,
      reasoning: 60,
    });
    expect(usage[0]?.project).toEqual({
      dirHash: expect.any(String),
      name: "agentos",
      gitBranch: "main",
    });
    expect(usage[0]?.eventId).not.toBe(usage[1]?.eventId);
  });

  test("normalize: falls back to deltas of totals when last_token_usage is missing", () => {
    const state = initialCodexState("rollout-x.jsonl");
    normalizeCodex(
      { type: "turn_context", payload: { model: "gpt-5" } },
      state
    );
    const mk = (total: Record<string, number>) => ({
      timestamp: "2026-09-19T10:00:00Z",
      type: "event_msg",
      payload: { type: "token_count", info: { total_token_usage: total } },
    });
    const a = normalizeCodex(
      mk({ input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 }),
      state
    );
    const b = normalizeCodex(
      mk({ input_tokens: 250, cached_input_tokens: 100, output_tokens: 30 }),
      state
    );
    expect(a?.tokens).toMatchObject({ input: 100, output: 10 });
    expect(b?.tokens).toMatchObject({ input: 50, output: 20, cacheRead: 100 });
  });

  test("collect: walks sessions/, announces once, restart yields nothing", async () => {
    const root = join(dir, "codex");
    mkdirSync(join(root, "sessions", "2026", "09", "19"), { recursive: true });
    cpSync(
      fixture,
      join(
        root,
        "sessions",
        "2026",
        "09",
        "19",
        "rollout-2026-09-19T10-00-00-0f3c1c9e-1b2a-4c3d-8e4f-5a6b7c8d9e0f.jsonl"
      )
    );
    const cursors = memoryCursorStore();
    const first = await drain(collectCodex([root], ctx({ cursors })));
    expect(first.map((e) => e.type)).toEqual([
      "session.start",
      "usage",
      "usage",
    ]);
    expectCanonical(first);
    expect(await drain(collectCodex([root], ctx({ cursors })))).toEqual([]);
  });
});

describe("cline", () => {
  const taskDir = join(FIXTURES, "cline", "tasks", "1758276000000");

  test("normalize: completed requests only, stops at the in-flight one, model from metadata", () => {
    const task = {
      taskId: "1758276000000",
      messages: JSON.parse(
        readFileSync(join(taskDir, "ui_messages.json"), "utf8")
      ),
      metadata: JSON.parse(
        readFileSync(join(taskDir, "task_metadata.json"), "utf8")
      ),
    };
    const { events, mark } = normalizeCline(task, 0);
    expect(events).toHaveLength(2);
    expect(mark).toBe(1_758_276_010_000);
    expect(events[0]?.tokens).toEqual({
      input: 5200,
      output: 310,
      cacheRead: 3900,
      cacheWrite: 1200,
    });
    expect(events[0]?.costUsd).toBe(0.021);
    expect(events[0]?.model).toEqual({
      raw: "claude-sonnet-5",
      family: "claude",
      provider: "anthropic",
    });
    expect(events[0]?.project?.name).toBe("agentos");
    expect(normalizeCline(task, mark).events).toEqual([]);
  });

  test("collect: uses mtime + mark so an unchanged file is skipped", async () => {
    const root = join(dir, "cline-tasks");
    cpSync(join(FIXTURES, "cline", "tasks"), root, { recursive: true });
    const cursors = memoryCursorStore();
    const first = await drain(collectCline([root], ctx({ cursors })));
    expect(first.map((e) => e.type)).toEqual([
      "session.start",
      "usage",
      "usage",
    ]);
    expectCanonical(first);
    expect(await drain(collectCline([root], ctx({ cursors })))).toEqual([]);
  });
});

describe("opencode", () => {
  function makeDb(path: string): void {
    const db = new Database(path);
    db.run(
      "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)"
    );
    const insert = db.prepare("INSERT INTO message VALUES (?, ?, ?, ?, ?)");
    const assistant = (id: string, updated: number, completed?: number) =>
      insert.run(
        id,
        "ses_1",
        updated - 1000,
        updated,
        JSON.stringify({
          role: "assistant",
          modelID: "gpt-5",
          providerID: "openai",
          cost: 0.01,
          path: { cwd: "/home/hacker/agentos" },
          tokens: {
            input: 100,
            output: 20,
            reasoning: 5,
            cache: { read: 50, write: 0 },
          },
          time: {
            created: updated - 1000,
            ...(completed ? { completed } : {}),
          },
        })
      );
    insert.run(
      "msg_user",
      "ses_1",
      1000,
      1000,
      JSON.stringify({ role: "user", time: { created: 1000 } })
    );
    assistant("msg_a", 2000, 1999);
    assistant("msg_streaming", 3000);
    db.close();
  }

  test("normalize + collect: completed assistant messages only, watermark on time_updated", async () => {
    const path = join(dir, "opencode.db");
    makeDb(path);
    expect(
      normalizeOpenCode({
        id: "x",
        session_id: "s",
        time_updated: 1,
        data: '{"role":"user"}',
      })
    ).toBeNull();
    const cursors = memoryCursorStore();
    const first = await drain(collectOpenCode([path], ctx({ cursors })));
    expect(first.map((e) => [e.type, e.eventId])).toEqual([
      ["session.start", "opencode:ses_1:start"],
      ["usage", "opencode:ses_1:msg_a"],
    ]);
    expect(first[1]?.tokens).toEqual({
      input: 100,
      output: 20,
      cacheRead: 50,
      cacheWrite: 0,
      reasoning: 5,
    });
    expect(first[1]?.costUsd).toBe(0.01);
    expectCanonical(first);
    expect(await drain(collectOpenCode([path], ctx({ cursors })))).toEqual([]);

    const db = new Database(path);
    db.run(
      "UPDATE message SET time_updated = 4000, data = json_set(data, '$.time.completed', 3999) WHERE id = 'msg_streaming'"
    );
    db.close();
    const later = await drain(collectOpenCode([path], ctx({ cursors })));
    expect(later.map((e) => e.eventId)).toEqual([
      "opencode:ses_1:msg_streaming",
    ]);
  });
});
