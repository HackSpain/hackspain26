import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectCopilot,
  initialCopilotState,
  normalizeCopilot,
} from "../src/watcher/collectors/copilot";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-copilot-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function start() {
  return {
    data: {
      context: { branch: "main", cwd: join(dir, "project") },
      copilotVersion: "1.0.86",
      sessionId: "session-1",
    },
    id: "start-1",
    timestamp: "2026-09-19T09:00:00.000Z",
    type: "session.start",
  };
}

function shutdown(
  id: string,
  usage: Record<string, number>,
  timestamp = "2026-09-19T10:00:00.000Z"
) {
  return {
    data: {
      modelMetrics: {
        "claude-sonnet-4.6": {
          requests: { cost: 1, count: 1 },
          usage,
        },
      },
      sessionStartTime: Date.parse("2026-09-19T09:00:00.000Z"),
      shutdownType: "routine",
      totalApiDurationMs: 1000,
    },
    id,
    timestamp,
    type: "session.shutdown",
  };
}

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
  for await (const event of iter) {
    out.push(event);
  }
  return out;
}

describe("copilot", () => {
  test("normalizes shutdown usage with input net of both caches", () => {
    const state = initialCopilotState(join(dir, "fallback", "events.jsonl"));
    expect(normalizeCopilot(start(), state)).toEqual([]);
    const [event] = normalizeCopilot(
      shutdown("shutdown-1", {
        cacheReadTokens: 600,
        cacheWriteTokens: 100,
        inputTokens: 1000,
        outputTokens: 200,
        reasoningTokens: 50,
      }),
      state
    );
    expect(event?.project?.dirHash).toMatch(/^[a-f\d]{16}$/);
    expect(event).toMatchObject({
      eventId: "copilot:session-1:shutdown-1:0",
      harness: "copilot",
      harnessVersion: "1.0.86",
      model: { family: "claude", raw: "claude-sonnet-4.6" },
      project: {
        gitBranch: "main",
        name: "project",
      },
      sessionId: "session-1",
      tokens: {
        cacheRead: 600,
        cacheWrite: 100,
        input: 300,
        output: 200,
        reasoning: 50,
      },
      type: "usage",
    });
    expect(validateEvent(stamp(event as RawEvent, IDENTITY))).toEqual([]);
  });

  test("emits only cumulative growth across resumed shutdowns", () => {
    const state = initialCopilotState(join(dir, "session-1", "events.jsonl"));
    normalizeCopilot(start(), state);
    normalizeCopilot(
      shutdown("shutdown-1", {
        cacheReadTokens: 600,
        cacheWriteTokens: 100,
        inputTokens: 1000,
        outputTokens: 200,
        reasoningTokens: 50,
      }),
      state
    );
    const [increment] = normalizeCopilot(
      shutdown("shutdown-2", {
        cacheReadTokens: 800,
        cacheWriteTokens: 100,
        inputTokens: 1500,
        outputTokens: 260,
        reasoningTokens: 60,
      }),
      state
    );
    expect(increment?.tokens).toEqual({
      cacheRead: 200,
      cacheWrite: 0,
      input: 300,
      output: 60,
      reasoning: 10,
    });
    expect(
      normalizeCopilot(
        shutdown("shutdown-3", {
          cacheReadTokens: 800,
          cacheWriteTokens: 100,
          inputTokens: 1500,
          outputTokens: 260,
          reasoningTokens: 60,
        }),
        state
      )
    ).toEqual([]);
    const [reset] = normalizeCopilot(
      shutdown("shutdown-4", {
        cacheReadTokens: 100,
        cacheWriteTokens: 0,
        inputTokens: 400,
        outputTokens: 30,
      }),
      state
    );
    expect(reset?.tokens).toEqual({
      cacheRead: 100,
      cacheWrite: 0,
      input: 300,
      output: 30,
    });
  });

  test("collects old-mtime shutdown logs once and resumes from its file cursor", async () => {
    const root = join(dir, ".copilot");
    const sessionDir = join(root, "session-state", "session-1");
    mkdirSync(sessionDir, { recursive: true });
    const path = join(sessionDir, "events.jsonl");
    writeFileSync(
      path,
      `${JSON.stringify(start())}\n${JSON.stringify(
        shutdown("shutdown-1", {
          cacheReadTokens: 600,
          cacheWriteTokens: 100,
          inputTokens: 1000,
          outputTokens: 200,
          reasoningTokens: 50,
        })
      )}\n`
    );
    const cursors = memoryCursorStore();
    const old = new Date("2026-09-17T00:00:00Z");
    utimesSync(path, old, old);
    const first = await drain(
      collectCopilot(
        [root],
        ctx({ cursors, since: Date.parse("2026-09-18T15:00:00Z") })
      )
    );
    expect(first.map((event) => event.type)).toEqual([
      "session.start",
      "usage",
    ]);
    expect(await drain(collectCopilot([root], ctx({ cursors })))).toEqual([]);

    appendFileSync(
      path,
      `${JSON.stringify(
        shutdown(
          "shutdown-2",
          {
            cacheReadTokens: 800,
            cacheWriteTokens: 100,
            inputTokens: 1500,
            outputTokens: 260,
            reasoningTokens: 60,
          },
          "2026-09-19T11:00:00.000Z"
        )
      )}\n`
    );
    const appended = await drain(collectCopilot([root], ctx({ cursors })));
    expect(appended).toHaveLength(1);
    expect(appended[0]?.type).toBe("usage");
    expect(appended[0]?.tokens?.input).toBe(300);
  });

  test("uses the session directory when the start record is unavailable", () => {
    const state = initialCopilotState(
      join(dir, "session-fallback", "events.jsonl")
    );
    const [event] = normalizeCopilot(
      shutdown("shutdown-1", {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 100,
        outputTokens: 10,
      }),
      state
    );
    expect(event?.sessionId).toBe("session-fallback");
    expect(event?.project).toBeUndefined();
  });
});
