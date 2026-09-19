import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseTelemetryEvent } from "../../app/src/app/api/cli/telemetry/rawtree";
import {
  collectGrok,
  grokCollector,
  grokRoot,
  normalizeGrok,
} from "../src/watcher/collectors/grok";
import {
  memoryCursorStore,
  openCursorStore,
} from "../src/watcher/cursor-store";
import { COLLECTORS, stamp } from "../src/watcher/index";
import type { RawEvent } from "../src/watcher/schema";
import { validateEvent } from "../src/watcher/schema";
import type { CollectorContext } from "../src/watcher/types";

const FIXTURE = join(import.meta.dir, "fixtures", "grok");
const IDENTITY = { clientVersion: "test", userId: "u1" };
const TIME = "2026-09-19T10:00:00.000Z";
const DEFAULT_COUNTERS = {
  cached_prompt_tokens: 800,
  completion_tokens: 100,
  prompt_tokens: 1000,
  reasoning_tokens: 75,
};

let dir: string;
let root: string;
let log: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-grok-"));
  root = join(dir, ".grok");
  cpSync(FIXTURE, root, { recursive: true });
  log = join(root, "logs", "unified.jsonl");
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

function inference(sid: string, ts: string, ctx = DEFAULT_COUNTERS) {
  return {
    ctx,
    msg: "shell.turn.inference_done",
    sid,
    ts,
    ver: "1.0.13",
  };
}

describe("grok", () => {
  test("normalizes usage and passes server ingestion", () => {
    const raw = normalizeGrok(inference("session-known", TIME), {
      cwd: "/work/project",
      model: "grok-4.6",
    });
    if (!raw) {
      throw new Error("Missing usage event");
    }
    const event = stamp(raw, IDENTITY);
    expect(event.eventId).toBe(`grok:session-known:${TIME}`);
    expect(event.harnessVersion).toBe("1.0.13");
    expect(event.model).toEqual({
      family: "other",
      name: "grok-4-6",
      provider: "xai",
      raw: "grok-4.6",
    });
    expect(event.tokens).toEqual({
      cacheRead: 800,
      cacheWrite: 0,
      input: 200,
      output: 100,
      reasoning: 75,
      total: 1100,
    });
    expect(event.project?.name).toBe("project");
    expect(validateEvent(event)).toEqual([]);
    expect(parseTelemetryEvent(event, IDENTITY)).toEqual(event);
    expect(
      normalizeGrok(
        inference("s", TIME, {
          cached_prompt_tokens: 0,
          completion_tokens: 0,
          prompt_tokens: 0,
          reasoning_tokens: 0,
        })
      )
    ).toBeNull();
  });

  test("announces each session once and resumes from the persisted cursor", async () => {
    const cursorPath = join(dir, "cursors.json");
    const ctx = context();
    ctx.cursors = openCursorStore(cursorPath);
    const first = await drain(collectGrok([log], join(root, "sessions"), ctx));
    expect(first.map((event) => event.type)).toEqual([
      "session.start",
      "usage",
      "session.start",
      "usage",
    ]);
    expect(first[1]?.model?.raw).toBe("grok-4.6");
    expect(first[3]?.model?.raw).toBe("unknown");
    expect(first[3]?.project).toBeUndefined();
    expect(JSON.stringify(first)).not.toContain("PRIVATE_");
    expect(JSON.stringify(first)).not.toContain("/work/project");
    ctx.cursors.save();

    const appendedAt = "2026-09-19T10:03:00.000Z";
    appendFileSync(
      log,
      `${JSON.stringify(inference("session-known", appendedAt))}\n`
    );
    const restarted = context();
    restarted.cursors = openCursorStore(cursorPath);
    const next = await drain(
      collectGrok([log], join(root, "sessions"), restarted)
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.eventId).toBe(`grok:session-known:${appendedAt}`);
  });

  test("since drops old usage while advancing the cursor", async () => {
    const ctx = context();
    ctx.since = Date.parse("2026-09-19T10:02:00.000Z");
    const first = await drain(collectGrok([log], join(root, "sessions"), ctx));
    expect(first.map((event) => event.sessionId)).toEqual([
      "session-missing",
      "session-missing",
    ]);
    expect(
      await drain(collectGrok([log], join(root, "sessions"), ctx))
    ).toEqual([]);
  });

  test("discovers only when the unified log exists", async () => {
    expect(grokRoot()).toBe(join(homedir(), ".grok"));
    const logs = await grokCollector.discover();
    expect(logs).toEqual(
      existsSync(join(grokRoot(), "logs", "unified.jsonl"))
        ? [join(grokRoot(), "logs", "unified.jsonl")]
        : []
    );
    expect(COLLECTORS).toContain(grokCollector);
  });

  test("fixtures contain no real home paths", () => {
    expect(readFileSync(log, "utf8")).not.toContain("/Users/");
  });
});
