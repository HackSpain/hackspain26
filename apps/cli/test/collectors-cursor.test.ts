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
  cursorHookCommand,
  installCursorHook,
  normalizeCursorHook,
  recordCursorHook,
  setCursorCollectionWindow,
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
        stop: [{ command: "/bin/hackspain _cursor-hook" }],
        afterFileEdit: [{ command: "./format.sh" }],
      },
      version: 1,
    });

    writeFileSync(path, "not json");
    expect(() => installCursorHook(root)).toThrow("invalid JSON");
    expect(readFileSync(path, "utf8")).toBe("not json");
  });
});

test("replaces obsolete recorder commands and preserves unrelated hook options", () => {
  const path = join(dir, "hooks.json");
  const custom = { command: "./after.sh", timeout: 10 };
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      hooks: {
        afterAgentResponse: [
          custom,
          { command: "'/old/hackspain' '_cursor-hook'" },
        ],
        stop: [{ command: "./stop.sh", loop_limit: 2 }],
      },
    })
  );
  const command =
    "'/new path/hackspain' '_cursor-hook' '--event-log' '/state/log'";
  expect(installCursorHook(dir, command)).toBe("installed");
  expect(installCursorHook(dir, command)).toBe("present");
  const config = JSON.parse(readFileSync(path, "utf8"));
  expect(config.hooks.afterAgentResponse).toEqual([custom, { command }]);
  expect(config.hooks.stop).toEqual([
    { command: "./stop.sh", loop_limit: 2 },
    { command },
  ]);
});

test("does not partially rewrite config when the fallback hook is invalid", () => {
  const path = join(dir, "hooks.json");
  const original = JSON.stringify({ hooks: { stop: {} } });
  writeFileSync(path, original);
  expect(() => installCursorHook(dir)).toThrow("stop must be an array");
  expect(readFileSync(path, "utf8")).toBe(original);
});

test("hook command pins storage even when the GUI has a different environment", async () => {
  const eventLog = join(dir, "state with spaces", "events.jsonl");
  const windowFile = join(dir, "state with spaces", "window.json");
  setCursorCollectionWindow(
    { since: 0, until: Date.now() + 60_000 },
    windowFile
  );
  const command = cursorHookCommand();
  expect(command).toContain("--event-log");
  expect(command).toContain("--window-file");
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "../src/index.ts"),
      "_cursor-hook",
      "--event-log",
      eventLog,
      "--window-file",
      windowFile,
    ],
    {
      env: {
        ...process.env,
        XDG_STATE_HOME: join(dir, "different-gui-state"),
        LOCALAPPDATA: join(dir, "different-gui-state"),
        HACKSPAIN_NO_AUTO_UPDATE: "1",
      },
      stdin: new Blob([
        JSON.stringify(
          hook({
            text: "must not persist",
            workspace_roots: ["C:\\Users\\someone\\proyecto"],
          })
        ),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  expect(await child.exited).toBe(0);
  expect(await new Response(child.stdout).text()).toBe("");
  const saved = readFileSync(eventLog, "utf8");
  expect(saved).not.toContain("must not persist");
  const events = await drain(collectCursor([eventLog], ctx()));
  expect(events.at(-1)?.project?.name).toBe("proyecto");
  expect(validateEvent(stamp(events.at(-1) as RawEvent, IDENTITY))).toEqual([]);
});

test("Windows hook commands quote paths literally for Cursor's PowerShell runner", () => {
  const previous = process.env.HACKSPAIN_CURSOR_EVENT_LOG;
  try {
    process.env.HACKSPAIN_CURSOR_EVENT_LOG = join(
      dir,
      "Sam's $projects",
      "events.jsonl"
    );
    const command = cursorHookCommand("win32");
    expect(command).toContain("Sam''s $projects");
    expect(command).toContain("'_cursor-hook'");
    expect(command).not.toContain('"');
  } finally {
    delete process.env.HACKSPAIN_CURSOR_EVENT_LOG;
    if (previous !== undefined) {
      process.env.HACKSPAIN_CURSOR_EVENT_LOG = previous;
    }
  }
});
