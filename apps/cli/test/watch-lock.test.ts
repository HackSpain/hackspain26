import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stateDir } from "../src/lib/config";
import { acquireWatchLock } from "../src/watcher";

let root: string;
const previousState = process.env.XDG_STATE_HOME;
const previousLocal = process.env.LOCALAPPDATA;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hackspain-watch-lock-"));
  process.env.XDG_STATE_HOME = root;
  process.env.LOCALAPPDATA = root;
});
afterEach(() => {
  if (previousState === undefined) {
    delete process.env.XDG_STATE_HOME;
  } else {
    process.env.XDG_STATE_HOME = previousState;
  }
  if (previousLocal === undefined) {
    delete process.env.LOCALAPPDATA;
  } else {
    process.env.LOCALAPPDATA = previousLocal;
  }
  rmSync(root, { recursive: true, force: true });
});
function path() {
  return join(stateDir(), "watch.lock");
}
test("only one acquisition succeeds and release permits the next watcher", () => {
  const release = acquireWatchLock();
  expect(acquireWatchLock).toThrow("Another watcher owns the lock");
  release();
  const next = acquireWatchLock();
  next();
  expect(existsSync(path())).toBe(false);
});
test("release never removes a replaced lock", () => {
  const release = acquireWatchLock();
  unlinkSync(path());
  writeFileSync(path(), "other-owner\n");
  release();
  expect(readFileSync(path(), "utf8")).toBe("other-owner\n");
});
test.each([
  "",
  "999999999\n",
])("an empty or stale legacy lock stays reserved: %s", (owner) => {
  const release = acquireWatchLock();
  release();
  writeFileSync(path(), owner);
  expect(acquireWatchLock).toThrow("Another watcher owns the lock");
  expect(readFileSync(path(), "utf8")).toBe(owner);
});
test("simultaneous processes cannot both own the watcher lock", async () => {
  const moduleUrl = new URL("../src/watcher/index.ts", import.meta.url).href;
  const gate = join(root, "go");
  const stop = join(root, "stop");
  const source = `import { existsSync } from "node:fs";
import { acquireWatchLock } from ${JSON.stringify(moduleUrl)};
while (!existsSync(${JSON.stringify(gate)})) await Bun.sleep(5);
try {
 const release = acquireWatchLock();
 process.stdout.write("acquired");
 while (!existsSync(${JSON.stringify(stop)})) await Bun.sleep(5);
 release();
} catch (error) {
 if (error.code !== "WATCHER_RUNNING") throw error;
 process.stdout.write("blocked");
}`;
  const children = [0, 1].map(() =>
    Bun.spawn([process.execPath, "--eval", source], {
      stdout: "pipe",
      stderr: "pipe",
    })
  );
  try {
    writeFileSync(gate, "go");
    const outputs = await Promise.all(
      children.map(async (child) => {
        const { value } = await child.stdout.getReader().read();
        return new TextDecoder().decode(value);
      })
    );
    expect(outputs.toSorted()).toEqual(["acquired", "blocked"]);
    writeFileSync(stop, "stop");
    expect(await Promise.all(children.map((child) => child.exited))).toEqual([
      0, 0,
    ]);
  } finally {
    writeFileSync(stop, "stop");
    for (const child of children) {
      child.kill();
    }
    await Promise.all(children.map((child) => child.exited));
  }
});
