import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCursorStore } from "../src/watcher/cursor-store";
import type { FileCursor } from "../src/watcher/types";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-cursors-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

test("unchanged cursors do not replace the persisted file, including after restart", () => {
  const path = join(dir, "cursors.json");
  const store = openCursorStore(path);
  const cursor: FileCursor = {
    inode: 10,
    mark: "state",
    mtimeMs: 20,
    offset: 30,
    seenSessions: ["session"],
  };
  store.set("log", cursor);
  store.save();
  const before = statSync(path);
  for (const current of [store, openCursorStore(path)]) {
    current.set("log", { ...cursor, seenSessions: ["session"] });
    current.save();
    expect(statSync(path).ino).toBe(before.ino);
    expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
  }
});

const changes: Partial<FileCursor>[] = [
  { offset: 2 },
  { inode: 10 },
  { mtimeMs: 2 },
  { mark: "new state" },
  { seenSessions: ["b"] },
  { seenSessions: ["b", "c"] },
  { seenSessions: undefined },
  { seenSessions: [] },
];

test.each(changes)("persists cursor update %j", (change) => {
  const path = join(dir, "cursors.json");
  const store = openCursorStore(path);
  const previous: FileCursor = {
    inode: 1,
    mark: "old state",
    mtimeMs: 1,
    offset: 1,
    seenSessions: ["a"],
  };
  store.set("log", previous);
  store.save();
  const cursor = { ...previous, ...change };
  store.set("log", cursor);
  store.save();
  expect(openCursorStore(path).get("log")).toEqual(cursor);
});

test("coverage invalidation still persists", () => {
  const path = join(dir, "cursors.json");
  const store = openCursorStore(path);
  store.coverFrom(100);
  store.set("log", { mtimeMs: 1, offset: 1 });
  store.save();
  expect(store.coverFrom(50)).toBe(true);
  store.save();
  const restarted = openCursorStore(path);
  expect(restarted.get("log")).toBeUndefined();
  expect(restarted.coverFrom(50)).toBe(false);
});
