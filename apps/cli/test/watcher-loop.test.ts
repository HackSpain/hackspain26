import {
  afterEach,
  beforeEach,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "../src/lib/api";
import { stateDir } from "../src/lib/config";
import { EXIT } from "../src/lib/errors";
import type { Me } from "../src/lib/me";
import { loadRecentIds, runWatch, saveRecentIds } from "../src/watcher/index";
import { ephemeralMemory } from "../src/watcher/memory";
import { createState } from "../src/watcher/state";
import type { Collector } from "../src/watcher/types";

const NOW = Date.UTC(2026, 8, 19, 12);
const originalTimeout = globalThis.setTimeout;
const previousXdg = process.env.XDG_STATE_HOME;
const previousLocal = process.env.LOCALAPPDATA;
let dir: string;
let sleeps: number[];
let onSleep: (callback: () => void) => void;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-loop-"));
  process.env.XDG_STATE_HOME = dir;
  process.env.LOCALAPPDATA = dir;
  setSystemTime(NOW);
  sleeps = [];
  spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay: number
  ) => {
    sleeps.push(delay);
    return originalTimeout(() => onSleep(callback), 0);
  }) as typeof setTimeout);
});

afterEach(() => {
  mock.restore();
  setSystemTime();
  process.env.XDG_STATE_HOME = previousXdg;
  process.env.LOCALAPPDATA = previousLocal;
  rmSync(dir, { force: true, recursive: true });
});

const options = {
  intervalMs: 30_000,
  once: false,
  toast: false,
  verbose: false,
  window: { since: NOW - 1000, until: NOW + 3_600_000 },
};

function dependencies() {
  let scans = 0;
  const collector: Collector = {
    async *collect() {
      scans++;
      yield* [];
    },
    discover: async () => ["synthetic"],
    id: "codex",
  };
  return {
    collectors: [collector],
    history: [],
    log: () => {},
    me: { _id: "u1", role: "user" } as Me,
    memory: ephemeralMemory(NOW),
    say: () => {},
    scans: () => scans,
    session: {
      client: { query: async () => [] },
      token: async () => "synthetic",
      url: "https://example.com",
    } as unknown as Session,
  };
}

test.each([
  "SIGINT",
  "SIGTERM",
] as const)("line mode sleeps until the next scan and wakes immediately on %s", async (signal) => {
  const deps = dependencies();
  onSleep = () => {
    process.emit(signal);
  };
  expect(await runWatch(options, deps)).toBe(EXIT.INTERRUPTED);
  expect(sleeps).toEqual([30_000]);
  expect(deps.scans()).toBe(1);
});

test("pause sleeps until the update check; resume and quit wake it immediately", async () => {
  const deps = dependencies();
  const state = createState({ me: { name: "Test" }, uploadEnabled: false });
  state.paused = true;
  onSleep = (callback) => {
    if (sleeps.length === 1) {
      state.paused = false;
      state.wake?.();
    } else if (sleeps.length === 2) {
      setSystemTime(NOW + 30_000);
      callback();
    } else {
      state.stopRequested = true;
      state.wake?.();
    }
  };
  expect(await runWatch(options, { ...deps, state })).toBe(EXIT.INTERRUPTED);
  expect(sleeps).toEqual([300_000, 30_000, 30_000]);
  expect(deps.scans()).toBe(2);
  expect(state.wake).toBeUndefined();
});

test("idle scans do not rewrite recent event ids", async () => {
  saveRecentIds(new Set(["codex:existing"]));
  const path = join(stateDir(), "recent-ids.json");
  const before = statSync(path);
  const deps = dependencies();
  onSleep = (callback) => {
    if (sleeps.length === 1) {
      setSystemTime(NOW + 30_000);
      callback();
    } else {
      process.emit("SIGTERM");
    }
  };
  await runWatch(options, deps);
  expect(deps.scans()).toBe(2);
  expect(statSync(path).ino).toBe(before.ino);
  expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
});

test("an empty backfill replaces previously saved recent ids", async () => {
  saveRecentIds(new Set(["codex:existing"]));
  expect(
    await runWatch({ ...options, backfill: true, once: true }, dependencies())
  ).toBe(EXIT.OK);
  expect([...loadRecentIds()]).toEqual([]);
});

test("pending images load in bounded turns, then the loop returns to sleep", async () => {
  const deps = dependencies();
  const state = createState({
    imageProtocol: "kitty",
    me: { name: "Test" },
    uploadEnabled: false,
  });
  state.feed = Array.from({ length: 10 }, (_, n) => ({
    _id: `post-${n}`,
    author: { name: "Test" },
    createdAt: NOW - n,
    imagePath: `/api/files/image-${n}`,
    kind: "post" as const,
    text: "",
  }));
  const requests = spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
  );
  const attempted: number[] = [];
  onSleep = (callback) => {
    attempted.push(requests.mock.calls.length);
    if (sleeps.length < 3) {
      setSystemTime(NOW + sleeps.length * 1000);
      callback();
    } else {
      state.stopRequested = true;
      state.wake?.();
    }
  };
  await runWatch(options, { ...deps, state });
  expect(sleeps).toEqual([1000, 1000, 28_000]);
  expect(attempted).toEqual([4, 8, 10]);
  expect(state.feedImageFailed.size).toBe(10);
  expect(deps.scans()).toBe(1);
});

test("a long scan interval still wakes for the update check", async () => {
  const deps = dependencies();
  let checks = 0;
  onSleep = (callback) => {
    setSystemTime(NOW + 300_000);
    callback();
  };
  expect(
    await runWatch(
      { ...options, intervalMs: 600_000 },
      {
        ...deps,
        checkForUpdate: async () => {
          checks++;
          return true;
        },
      }
    )
  ).toBe(EXIT.OK);
  expect(sleeps).toEqual([300_000]);
  expect(checks).toBe(1);
  expect(deps.scans()).toBe(1);
});

test("quit during a scan does not start another sleep", async () => {
  const deps = dependencies();
  const state = createState({ me: { name: "Test" }, uploadEnabled: false });
  deps.collectors[0] = {
    async *collect() {
      state.stopRequested = true;
      yield* [];
    },
    discover: async () => ["synthetic"],
    id: "codex",
  };
  expect(await runWatch(options, { ...deps, state })).toBe(EXIT.INTERRUPTED);
  expect(sleeps).toEqual([]);
});
