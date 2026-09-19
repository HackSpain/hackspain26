import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectCursor,
  installCursorHook,
  normalizeCursorHook,
  recordCursorHook,
} from "../src/watcher/collectors/cursor";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-cursor-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function hook(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    cache_read_tokens: 600,
    cache_write_tokens: 100,
    conversation_id: "conversation-1",
    cursor_version: "2.3.1",
    generation_id: "generation-1",
    input_tokens: 1000,
    model: "claude-sonnet-4-5",
    occurred_at: "2026-09-19T10:00:00.000Z",
    output_tokens: 200,
    workspace_roots: [join(dir, "project")],
    ...overrides,
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

describe("cursor", () => {
  test("normalizes hook usage with input net of both caches", () => {
    const event = normalizeCursorHook(hook());
    expect(event).toMatchObject({
      eventId: "cursor:conversation-1:generation-1",
      harness: "cursor",
      harnessVersion: "2.3.1",
      model: { family: "claude", raw: "claude-sonnet-4-5" },
      sessionId: "conversation-1",
      tokens: {
        cacheRead: 600,
        cacheWrite: 100,
        input: 300,
        output: 200,
      },
      type: "usage",
    });
    expect(event?.project).toEqual({
      dirHash: expect.any(String),
      name: "project",
    });
    expect(validateEvent(stamp(event as RawEvent, IDENTITY))).toEqual([]);
  });

  test("records only the privacy allowlist", () => {
    const path = join(dir, "cursor-events.jsonl");
    expect(
      recordCursorHook(
        {
          ...hook(),
          text: "private response",
          user_email: "person@example.com",
          arbitrary_secret: "secret",
        },
        path,
        Date.parse("2026-09-19T10:00:00.000Z"),
        {
          since: Date.parse("2026-09-19T09:00:00.000Z"),
          until: Date.parse("2026-09-19T11:00:00.000Z"),
        }
      )
    ).toBe(true);
    const saved = JSON.parse(readFileSync(path, "utf8"));
    expect(saved).toEqual(hook());
    expect(saved.text).toBeUndefined();
    expect(saved.user_email).toBeUndefined();
    expect(
      recordCursorHook(hook(), path, Date.parse("2026-09-19T12:00:00.000Z"), {
        since: Date.parse("2026-09-19T09:00:00.000Z"),
        until: Date.parse("2026-09-19T11:00:00.000Z"),
      })
    ).toBe(false);
    expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(1);
  });

  test("collects a session once and resumes from its file cursor", async () => {
    const path = join(dir, "cursor-events.jsonl");
    writeFileSync(
      path,
      `${JSON.stringify(hook())}\n${JSON.stringify(
        hook({ generation_id: "generation-2", output_tokens: 250 })
      )}\n`
    );
    const cursors = memoryCursorStore();
    const first = await drain(collectCursor([path], ctx({ cursors })));
    expect(first.map((event) => event.type)).toEqual([
      "session.start",
      "usage",
      "usage",
    ]);
    expect(new Set(first.map((event) => event.eventId)).size).toBe(3);
    expect(await drain(collectCursor([path], ctx({ cursors })))).toEqual([]);
  });

  test("installs additively, is idempotent, and rejects invalid config", () => {
    const root = join(dir, ".cursor");
    mkdirSync(root);
    const path = join(root, "hooks.json");
    writeFileSync(
      path,
      JSON.stringify({
        hooks: { afterFileEdit: [{ command: "./format.sh" }] },
        custom: true,
        version: 1,
      })
    );
    expect(installCursorHook(root, "/bin/hackspain _cursor-hook")).toBe(
      "installed"
    );
    expect(installCursorHook(root, "/bin/hackspain _cursor-hook")).toBe(
      "present"
    );
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      custom: true,
      hooks: {
        afterAgentResponse: [{ command: "/bin/hackspain _cursor-hook" }],
        afterFileEdit: [{ command: "./format.sh" }],
      },
      version: 1,
    });

    writeFileSync(path, "not json");
    expect(() => installCursorHook(root)).toThrow("invalid JSON");
    expect(readFileSync(path, "utf8")).toBe("not json");
  });
});
