import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseTelemetryEvent } from "../../app/src/app/api/cli/telemetry/rawtree";
import {
  collectPi,
  normalizePi,
  OMP,
  ompCollector,
  PI,
  piCollector,
  piSessionDir,
} from "../src/watcher/collectors/pi";
import {
  memoryCursorStore,
  openCursorStore,
} from "../src/watcher/cursor-store";
import { COLLECTORS, stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const IDENTITY = { clientVersion: "test", userId: "u1" };
const TIME = "2026-09-19T10:00:00.000Z";
const HEADER = {
  cwd: "/work/project",
  id: "session-1",
  timestamp: TIME,
  type: "session",
  version: 3,
};
const USAGE = {
  cacheRead: 300,
  cacheWrite: 20,
  cost: { total: 0.004 },
  input: 100,
  output: 50,
  totalTokens: 470,
};

function message(id = "message-1", usage: unknown = USAGE) {
  return {
    id,
    message: {
      content: [{ text: "PRIVATE_RESPONSE", type: "text" }],
      model: "claude-sonnet-4-5",
      provider: "anthropic",
      role: "assistant",
      timestamp: Date.parse(TIME),
      usage,
    },
    parentId: null,
    timestamp: TIME,
    type: "message",
  };
}

function lines(...entries: unknown[]): string {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-pi-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function context(): CollectorContext {
  return { cursors: memoryCursorStore(), log: () => {}, since: 0 };
}

async function drain(events: AsyncIterable<RawEvent>): Promise<RawEvent[]> {
  const result: RawEvent[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}

describe.each([PI, OMP])("%s sessions", (harness) => {
  test("collects nested sessions, maps usage once and passes server ingestion", async () => {
    const bucket = join(dir, "project", "subagent");
    mkdirSync(bucket, { recursive: true });
    const entry = message("message-1", {
      ...USAGE,
      [harness === PI ? "reasoning" : "reasoningTokens"]: 25,
    });
    writeFileSync(
      join(bucket, "session.jsonl"),
      lines(
        { title: "PRIVATE_TITLE", type: "title" },
        HEADER,
        {
          id: "user-1",
          message: { content: "PRIVATE_PROMPT", role: "user" },
          type: "message",
        },
        {
          summary: "PRIVATE_SUMMARY",
          tokensBefore: 9999,
          type: "compaction",
        },
        entry,
        entry
      )
    );
    const events = await drain(collectPi([dir], context(), harness));
    expect(events.map((event) => event.type)).toEqual([
      "session.start",
      "usage",
    ]);
    const rawUsage = events[1];
    if (!rawUsage) {
      throw new Error("Missing usage event");
    }
    const usage = stamp(rawUsage, IDENTITY);
    expect(usage.eventId).toBe(`${harness}:session-1:message-1`);
    expect(usage.harness).toBe(harness);
    expect(usage.harnessVersion).toBeUndefined();
    expect(usage.model).toEqual({
      family: "claude",
      name: "claude-sonnet-4-5",
      provider: "anthropic",
      raw: "claude-sonnet-4-5",
    });
    expect(usage.tokens).toEqual({
      cacheRead: 300,
      cacheWrite: 20,
      input: 100,
      output: 50,
      reasoning: 25,
      total: 470,
    });
    expect(usage.native).toEqual({ costUsd: 0.004 });
    expect(usage.project?.dirHash).toMatch(/^[a-f0-9]{16}$/);
    for (const event of events) {
      const stamped = stamp(event, IDENTITY);
      expect(validateEvent(stamped)).toEqual([]);
      expect(parseTelemetryEvent(stamped, IDENTITY)).toEqual(stamped);
    }
    expect(JSON.stringify(events)).not.toContain("PRIVATE_");
    expect(JSON.stringify(events)).not.toContain(HEADER.cwd);
  });

  test("persists header context across scans and waits for partial lines", async () => {
    const path = join(dir, "session.jsonl");
    const ctx = context();
    const cursorPath = join(dir, "cursors.json");
    ctx.cursors = openCursorStore(cursorPath);
    writeFileSync(path, lines(HEADER, message()));
    expect(await drain(collectPi([dir], ctx, harness))).toHaveLength(2);
    expect(await drain(collectPi([dir], ctx, harness))).toEqual([]);
    appendFileSync(path, JSON.stringify(message("message-2")));
    expect(await drain(collectPi([dir], ctx, harness))).toEqual([]);
    appendFileSync(path, "\n");
    // Reload the persisted cursor as a restarted watcher would.
    ctx.cursors.save();
    const restarted = context();
    restarted.cursors = openCursorStore(cursorPath);
    const events = await drain(collectPi([dir], restarted, harness));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventId).toBe(`${harness}:session-1:message-2`);
    expect(events[0]?.project?.name).toBe("project");
    expect(restarted.cursors.get(path)?.mark).not.toContain(HEADER.cwd);
  });

  test("resets session metadata after rotation and honors the start boundary", async () => {
    const path = join(dir, "session.jsonl");
    const ctx = context();
    ctx.since = Date.parse(TIME);
    const old = { ...message("old"), timestamp: "2026-09-18T00:00:00.000Z" };
    writeFileSync(path, lines(HEADER, old, message()));
    const first = await drain(collectPi([dir], ctx, harness));
    expect(first.map((event) => event.eventId)).toEqual([
      `${harness}:session-1:start`,
      `${harness}:session-1:message-1`,
    ]);
    renameSync(path, join(dir, "session.old"));
    writeFileSync(path, lines({ ...HEADER, id: "session-2" }, message()));
    const rotated = await drain(collectPi([dir], ctx, harness));
    expect(rotated.map((event) => event.sessionId)).toEqual([
      "session-2",
      "session-2",
    ]);
  });

  test("skips corrupt records, missing headers, invalid usage and synthetic zero usage", async () => {
    const path = join(dir, "session.jsonl");
    writeFileSync(
      path,
      `${lines(message("orphan"))}broken json\n${lines(
        HEADER,
        message("null", null),
        message("negative", { ...USAGE, input: -1 }),
        message("string", { ...USAGE, output: "50" }),
        message("zero", { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 }),
        { ...message("date"), timestamp: "invalid" },
        message("good")
      )}`
    );
    const events = await drain(
      collectPi([join(dir, "missing"), path, dir], context(), harness)
    );
    expect(events.map((event) => event.eventId)).toEqual([
      `${harness}:session-1:start`,
      `${harness}:session-1:good`,
    ]);
  });

  test("counts billable error responses and does not invent reasoning", () => {
    const entry = message();
    const event = normalizePi(
      { ...entry, message: { ...entry.message, stopReason: "error" } },
      { sessionId: "s" },
      harness
    );
    expect(event?.tokens?.output).toBe(50);
    expect(event?.tokens?.reasoning).toBeUndefined();
  });
});

test("registers separate collectors and discovers their independent directory overrides", async () => {
  const piEnv = process.env.HACKSPAIN_PI_SESSION_DIR;
  const ompEnv = process.env.HACKSPAIN_OMP_SESSION_DIR;
  try {
    delete process.env.HACKSPAIN_PI_SESSION_DIR;
    delete process.env.HACKSPAIN_OMP_SESSION_DIR;
    expect(piSessionDir(PI)).toBe(join(homedir(), ".pi", "agent", "sessions"));
    expect(piSessionDir(OMP)).toBe(
      join(homedir(), ".omp", "agent", "sessions")
    );
    process.env.HACKSPAIN_PI_SESSION_DIR = join(dir, "pi");
    process.env.HACKSPAIN_OMP_SESSION_DIR = join(dir, "omp");
    mkdirSync(piSessionDir(PI));
    mkdirSync(piSessionDir(OMP));
    expect(await piCollector.discover()).toEqual([join(dir, "pi")]);
    expect(await ompCollector.discover()).toEqual([join(dir, "omp")]);
    expect(COLLECTORS).toContain(piCollector);
    expect(COLLECTORS).toContain(ompCollector);
  } finally {
    if (piEnv === undefined) {
      delete process.env.HACKSPAIN_PI_SESSION_DIR;
    } else {
      process.env.HACKSPAIN_PI_SESSION_DIR = piEnv;
    }
    if (ompEnv === undefined) {
      delete process.env.HACKSPAIN_OMP_SESSION_DIR;
    } else {
      process.env.HACKSPAIN_OMP_SESSION_DIR = ompEnv;
    }
  }
});
