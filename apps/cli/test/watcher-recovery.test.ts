import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "../src/lib/api";
import { EXIT } from "../src/lib/errors";
import type { Me } from "../src/lib/me";
import { cursorsPath, openCursorStore } from "../src/watcher/cursor-store";
import { runWatch, stamp } from "../src/watcher/index";
import { ephemeralMemory } from "../src/watcher/memory";
import type { RawEvent, TelemetryEvent } from "../src/watcher/schema";
import { spoolSink } from "../src/watcher/sinks/spool";
import { createState } from "../src/watcher/state";
import type { Collector } from "../src/watcher/types";

// Exercise the real scan/flush/shutdown path with isolated state and no backend.
test("failed shutdown preserves disk cursors, and the next run recovers the events", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-watch-recovery-"));
  const previous = {
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
  };
  process.env.XDG_STATE_HOME = dir;
  process.env.LOCALAPPDATA = dir;
  try {
    const now = Date.now();
    const window = { since: now - 10_000, until: now - 1 };
    const collector: Collector = {
      id: "devin",
      discover: async () => ["session-db"],
      async *collect(ctx) {
        if (ctx.cursors.get("session-db")) {
          return;
        }
        yield {
          eventId: "devin:session:message",
          harness: "devin",
          sessionId: "session",
          type: "usage",
          occurredAt: new Date(now - 5000).toISOString(),
          model: { family: "gpt", raw: "gpt-5" },
          tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
        };
        ctx.cursors.set("session-db", { offset: 0, mark: 1, mtimeMs: now });
      },
    };
    const state = createState({
      me: { name: "Test" },
      uploadEnabled: false,
      window,
    });
    state.stopRequested = true;
    let failing = true;
    const delivered: string[] = [];
    const logs: string[] = [];
    const deps = {
      collectors: [collector],
      extraSinks: [
        {
          name: "test-upload",
          write: async (events: { eventId: string }[]) => {
            if (failing) {
              throw new Error("offline");
            }
            delivered.push(...events.map((event) => event.eventId));
          },
        },
      ],
      history: [],
      log: (message: string) => logs.push(message),
      say: () => {},
      me: { _id: "user", role: "user" } as Me,
      memory: ephemeralMemory(now),
      session: { client: {} } as Session,
      state,
    };
    const options = {
      once: false,
      intervalMs: 30_000,
      window,
      toast: false,
      verbose: false,
    };
    expect(await runWatch(options, deps)).toBe(EXIT.INTERRUPTED);
    expect(existsSync(cursorsPath())).toBe(false);
    expect(
      logs.some((message) => message.includes("next run will retry"))
    ).toBe(true);
    expect(await runWatch({ ...options, once: true }, deps)).toBe(EXIT.NETWORK);
    expect(existsSync(cursorsPath())).toBe(false);
    failing = false;
    expect(await runWatch({ ...options, once: true }, deps)).toBe(EXIT.OK);
    expect(delivered).toEqual(["devin:session:message"]);
    expect(openCursorStore().get("session-db")?.mark).toBe(1);
  } finally {
    delete process.env.XDG_STATE_HOME;
    delete process.env.LOCALAPPDATA;
    if (previous.XDG_STATE_HOME !== undefined) {
      process.env.XDG_STATE_HOME = previous.XDG_STATE_HOME;
    }
    if (previous.LOCALAPPDATA !== undefined) {
      process.env.LOCALAPPDATA = previous.LOCALAPPDATA;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("restart reconstructs native request aliases from the spool even without recent ids", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-otel-restart-"));
  const previous = {
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
  };
  process.env.XDG_STATE_HOME = dir;
  process.env.LOCALAPPDATA = dir;
  try {
    const at = Date.now() - 5000;
    const raw = (requestId: string): RawEvent => ({
      eventId: `claude-code:session:request:${requestId}`,
      harness: "claude-code",
      sessionId: "session",
      type: "usage",
      occurredAt: new Date(at).toISOString(),
      model: { raw: "claude-sonnet-4-5" },
      tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      native: { requestId },
    });
    await spoolSink().write([
      stamp(raw("already-counted"), { userId: "user", clientVersion: "test" }),
      stamp(raw("different-participant"), {
        userId: "other",
        clientVersion: "test",
      }),
    ]);
    const collector: Collector = {
      id: "claude-code",
      discover: async () => ["transcript"],
      async *collect() {
        yield {
          ...raw("already-counted"),
          eventId: "claude-code:session:msg_old",
        };
        yield {
          ...raw("different-participant"),
          eventId: "claude-code:session:msg_new",
        };
      },
    };
    const delivered: TelemetryEvent[] = [];
    expect(
      await runWatch(
        {
          once: true,
          intervalMs: 30_000,
          toast: false,
          verbose: false,
          window: { since: at - 1000, until: at + 1000 },
        },
        {
          collectors: [collector],
          me: { _id: "user", role: "user" } as Me,
          session: { client: {} } as Session,
          memory: ephemeralMemory(),
          log: () => {},
          say: () => {},
          extraSinks: [
            {
              name: "test",
              write: async (events) => {
                delivered.push(...events);
              },
            },
          ],
        }
      )
    ).toBe(EXIT.OK);
    expect(delivered.map((event) => event.eventId)).toEqual([
      "claude-code:session:msg_new",
    ]);
  } finally {
    delete process.env.XDG_STATE_HOME;
    delete process.env.LOCALAPPDATA;
    if (previous.XDG_STATE_HOME !== undefined) {
      process.env.XDG_STATE_HOME = previous.XDG_STATE_HOME;
    }
    if (previous.LOCALAPPDATA !== undefined) {
      process.env.LOCALAPPDATA = previous.LOCALAPPDATA;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
