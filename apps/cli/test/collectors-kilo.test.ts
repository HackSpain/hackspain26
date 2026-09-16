import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KILO_CODE, kiloDbPaths } from "../src/watcher/collectors/kilo-code";
import { collectOpenCode } from "../src/watcher/collectors/opencode";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", teamId: "t1", userId: "u1" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-kilo-"));
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

describe("kilo-code collector (OpenCode family)", () => {
  function makeDb(path: string): void {
    const db = new Database(path);
    db.run(
      "CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)"
    );
    db.prepare("INSERT INTO message VALUES (?, ?, ?, ?, ?)").run(
      "msg_k1",
      "ses_k",
      1000,
      2000,
      JSON.stringify({
        cost: 0.004,
        modelID: "claude-sonnet-5",
        path: { cwd: "/home/hacker/agentos" },
        providerID: "anthropic",
        role: "assistant",
        time: { completed: 1999, created: 1000 },
        tokens: { cache: { read: 300, write: 10 }, input: 120, output: 40 },
      })
    );
    db.close();
  }

  test("finds release and channel databases, release first", () => {
    const data = join(dir, "kilo");
    mkdirSync(data);
    for (const name of [
      "kilo-beta.db",
      "kilo.db",
      "opencode-dev.db",
      "notes.txt",
    ]) {
      writeFileSync(join(data, name), "");
    }
    expect(kiloDbPaths(data).map((p) => p.split("/").at(-1))).toEqual([
      "kilo.db",
      "kilo-beta.db",
      "opencode-dev.db",
    ]);
    expect(kiloDbPaths(join(dir, "missing"))).toEqual([]);
  });

  test("reads the shared message table under the kilo-code id", async () => {
    const path = join(dir, "kilo.db");
    makeDb(path);
    const events = await drain(collectOpenCode([path], ctx(), KILO_CODE));
    expect(events.map((e) => e.type)).toEqual(["session.start", "usage"]);
    expect(events[1]?.harness).toBe("kilo-code");
    expect(events[1]?.eventId).toBe("kilo-code:ses_k:msg_k1");
    expect(events[1]?.model).toEqual({
      family: "claude",
      provider: "anthropic",
      raw: "claude-sonnet-5",
    });
    expect(events[1]?.tokens).toEqual({
      cacheRead: 300,
      cacheWrite: 10,
      input: 120,
      output: 40,
    });
    for (const e of events) {
      expect(validateEvent(stamp(e, IDENTITY))).toEqual([]);
    }
  });
});
