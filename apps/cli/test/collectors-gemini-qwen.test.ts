import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectGeminiCli,
  listGeminiChats,
  normalizeGeminiCli,
  sessionIdFromName,
} from "../src/watcher/collectors/gemini-cli";
import {
  collectQwenCode,
  listQwenChats,
  normalizeQwenCode,
} from "../src/watcher/collectors/qwen-code";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { modelFamily, validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const FIXTURES = join(import.meta.dir, "fixtures");
const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };
const GEMINI_SESSION = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const QWEN_SESSION = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-gemini-qwen-"));
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

describe("gemini-cli collector", () => {
  test("counts a turn once its tokens arrive, dedupes the re-appended record", async () => {
    const root = join(dir, ".gemini");
    cpSync(join(FIXTURES, "gemini-cli"), root, { recursive: true });
    expect(listGeminiChats(root)).toHaveLength(2);
    const events = await drain(collectGeminiCli([root], ctx()));
    const usage = events.filter((e) => e.type === "usage");
    const starts = events.filter((e) => e.type === "session.start");
    expect(usage).toHaveLength(3);
    expect(starts.map((s) => s.sessionId).toSorted()).toEqual(
      [GEMINI_SESSION, "sub-0001"].toSorted()
    );
    const main = usage.filter((e) => e.sessionId === GEMINI_SESSION);
    expect(main).toHaveLength(2);
    const [first, second] = main.toSorted((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt)
    );
    // Prompt 12000 of which 9000 cached: 3000 fresh, 9000 cache read.
    expect(first?.tokens).toEqual({
      cacheRead: 9000,
      cacheWrite: 0,
      input: 3000,
      output: 340,
      reasoning: 120,
    });
    expect(first?.model).toEqual({
      family: "gemini",
      provider: "google",
      raw: "gemini-2.5-pro",
    });
    expect(first?.eventId).toBe(`gemini-cli:${GEMINI_SESSION}:m2`);
    // Project comes from the metadata line's directories, hashed and named.
    expect(first?.project?.name).toBe("agentos");
    expect(first?.project?.dirHash).toMatch(/^[a-f\d]{16}$/);
    expect(second?.tokens).toEqual({
      cacheRead: 0,
      cacheWrite: 0,
      input: 500,
      output: 80,
    });
    for (const e of events) {
      expect(validateEvent(stamp(e, IDENTITY))).toEqual([]);
    }
  });

  test("honours since and continues from the cursor", async () => {
    const root = join(dir, ".gemini");
    cpSync(join(FIXTURES, "gemini-cli"), root, { recursive: true });
    // Fixture timestamps are in the future relative to the copy; the file
    // mtime must be at least as new as `since` for the pre-filter to keep it.
    const touched = new Date("2026-09-19T10:03:00Z");
    for (const file of listGeminiChats(root)) {
      utimesSync(file, touched, touched);
    }
    const late = await drain(
      collectGeminiCli(
        [root],
        ctx({ since: Date.parse("2026-09-19T10:01:00Z") })
      )
    );
    expect(
      late
        .filter((e) => e.type === "usage")
        .map((e) => e.eventId)
        .toSorted()
    ).toEqual(
      [`gemini-cli:${GEMINI_SESSION}:m3`, "gemini-cli:sub-0001:s1"].toSorted()
    );

    const cursors = memoryCursorStore();
    const first = await drain(collectGeminiCli([root], ctx({ cursors })));
    const again = await drain(collectGeminiCli([root], ctx({ cursors })));
    expect(first.length).toBeGreaterThan(0);
    expect(again).toEqual([]);
    const file = join(
      root,
      "tmp/9f2c1a7b3e4d5c6a/chats/session-2026-09-19T10-00-a1b2c3d4.jsonl"
    );
    appendFileSync(
      file,
      `${JSON.stringify({
        id: "m9",
        model: "gemini-2.5-pro",
        timestamp: "2026-09-19T10:05:00.000Z",
        tokens: {
          cached: 0,
          input: 10,
          output: 5,
          thoughts: 0,
          tool: 0,
          total: 15,
        },
        type: "gemini",
      })}\n`
    );
    const more = await drain(collectGeminiCli([root], ctx({ cursors })));
    expect(more.map((e) => e.eventId)).toEqual([
      `gemini-cli:${GEMINI_SESSION}:m9`,
    ]);
    // The session id survived in the cursor mark: no second session.start.
    expect(more[0]?.sessionId).toBe(GEMINI_SESSION);
  });

  test("normalisation edge cases", () => {
    const state = {};
    expect(
      normalizeGeminiCli(
        { id: "x", timestamp: "bad", type: "gemini", tokens: { input: 1 } },
        state,
        "f"
      )
    ).toBeNull();
    expect(
      normalizeGeminiCli(
        { id: "x", timestamp: "2026-09-19T10:00:00Z", type: "user" },
        state,
        "f"
      )
    ).toBeNull();
    expect(
      normalizeGeminiCli(
        { id: "x", timestamp: "2026-09-19T10:00:00Z", type: "gemini" },
        state,
        "f"
      )
    ).toBeNull();
    const noMeta = normalizeGeminiCli(
      {
        id: "x",
        timestamp: "2026-09-19T10:00:00Z",
        type: "gemini",
        tokens: { input: 5, output: 1 },
      },
      state,
      "fallback1"
    );
    expect(noMeta?.sessionId).toBe("fallback1");
    expect(noMeta?.project).toBeUndefined();
    expect(
      sessionIdFromName("/x/chats/session-2026-09-19T10-00-a1b2c3d4.jsonl")
    ).toBe("a1b2c3d4");
    expect(sessionIdFromName("/x/chats/parent/sub-0001.jsonl")).toBe(
      "sub-0001"
    );
  });
});

describe("qwen-code collector", () => {
  test("assistant records with usage become events; others are skipped", async () => {
    const root = join(dir, ".qwen");
    cpSync(join(FIXTURES, "qwen-code"), root, { recursive: true });
    expect(listQwenChats(root)).toHaveLength(1);
    const events = await drain(collectQwenCode([root], ctx()));
    expect(events.filter((e) => e.type === "session.start")).toHaveLength(1);
    const usage = events.filter((e) => e.type === "usage");
    expect(usage.map((e) => e.eventId)).toEqual([
      `qwen-code:${QWEN_SESSION}:u2`,
      `qwen-code:${QWEN_SESSION}:u4`,
    ]);
    expect(usage[0]?.tokens).toEqual({
      cacheRead: 6000,
      cacheWrite: 0,
      input: 2000,
      output: 210,
      reasoning: 40,
    });
    expect(usage[0]?.model).toEqual({
      family: "qwen",
      raw: "qwen3-coder-plus",
    });
    expect(usage[0]?.harnessVersion).toBe("0.5.2");
    expect(usage[0]?.project).toEqual(
      expect.objectContaining({ gitBranch: "main", name: "agentos" })
    );
    // Qwen Code can talk to any OpenAI-compatible model.
    expect(usage[1]?.model?.family).toBe("gpt");
    for (const e of events) {
      expect(validateEvent(stamp(e, IDENTITY))).toEqual([]);
    }
  });

  test("normalisation edge cases and the qwen model family", () => {
    expect(
      normalizeQwenCode({
        uuid: "a",
        sessionId: "s",
        timestamp: "2026-09-19T11:00:00Z",
        type: "user",
      })
    ).toBeNull();
    expect(
      normalizeQwenCode({
        uuid: "a",
        sessionId: "s",
        timestamp: "2026-09-19T11:00:00Z",
        type: "assistant",
      })
    ).toBeNull();
    expect(
      normalizeQwenCode({
        uuid: "a",
        sessionId: "s",
        timestamp: "2026-09-19T11:00:00Z",
        type: "assistant",
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      })
    ).toBeNull();
    const unknownVersion = normalizeQwenCode({
      sessionId: "s",
      timestamp: "2026-09-19T11:00:00Z",
      type: "assistant",
      usageMetadata: { candidatesTokenCount: 1, promptTokenCount: 1 },
      uuid: "a",
      version: "unknown",
    });
    expect(unknownVersion?.harnessVersion).toBeUndefined();
    expect(modelFamily("qwen3-coder-plus")).toBe("qwen");
    expect(modelFamily("Qwen/Qwen2.5-72B")).toBe("qwen");
  });

  test("fixtures carry no home paths", () => {
    for (const rel of [
      "gemini-cli/tmp/9f2c1a7b3e4d5c6a/chats/session-2026-09-19T10-00-a1b2c3d4.jsonl",
      "qwen-code/projects/-home-hacker-agentos/chats/7c9e6679-7425-40de-944b-e07fc1f90ae7.jsonl",
    ]) {
      expect(readFileSync(join(FIXTURES, rel), "utf8")).not.toContain(
        "/home/domenec"
      );
    }
  });
});
