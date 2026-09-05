import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summarize } from "../src/commands/telemetry";
import { BATCH_MAX, createBatcher } from "../src/watcher/batcher";
import { formatNotification, scanOnce, stamp } from "../src/watcher/index";
import {
  platformToaster,
  toastLinux,
  toastMac,
  toastWindows,
} from "../src/watcher/notify";
import type { RawEvent, TelemetryEvent } from "../src/watcher/schema";
import { httpSink } from "../src/watcher/sinks/http";
import { enforceCap, readSpool, spoolSink } from "../src/watcher/sinks/spool";
import type { Collector } from "../src/watcher/types";
import { validEvent } from "./schema.test";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-watcher-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function event(
  i: number,
  overrides: Partial<TelemetryEvent> = {}
): TelemetryEvent {
  return { ...validEvent, eventId: `claude-code:s1:msg_${i}`, ...overrides };
}

describe("spool sink", () => {
  test("appends one line per event and reads back", async () => {
    const sink = spoolSink(dir);
    await sink.write([event(1), event(2)]);
    await sink.write([event(3)]);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.ndjson$/);
    expect([...readSpool(dir)].map((e) => e.eventId)).toEqual([
      "claude-code:s1:msg_1",
      "claude-code:s1:msg_2",
      "claude-code:s1:msg_3",
    ]);
    if (process.platform !== "win32") {
      expect(statSync(join(dir, files[0] ?? "")).mode & 0o777).toBe(0o600);
    }
  });

  test("enforceCap drops the oldest day files but keeps the newest", async () => {
    const sink = spoolSink(dir, 1);
    await sink.write([event(1)]);
    const Bun_ = Bun;
    await Bun_.write(
      join(dir, "2020-01-01.ndjson"),
      `${JSON.stringify(event(0))}\n`
    );
    enforceCap(dir, 1);
    expect(readdirSync(dir)).toHaveLength(1);
    expect(readdirSync(dir)[0]).not.toBe("2020-01-01.ndjson");
  });
});

describe("http sink", () => {
  test("posts NDJSON with a bearer token and fails on non-2xx", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(null, {
        status: calls.length === 1 ? 200 : 503,
        statusText: "x",
      });
    }) as typeof fetch;
    const sink = httpSink(
      "https://ingest.example/v1",
      async () => "tok",
      fetchImpl
    );
    await sink.write([event(1), event(2)]);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok");
    expect(headers["content-type"]).toBe("application/x-ndjson");
    expect(String(calls[0]?.init.body).trim().split("\n")).toHaveLength(2);
    await expect(sink.write([event(3)])).rejects.toMatchObject({
      code: "SINK_HTTP",
    });
  });
});

describe("batcher", () => {
  test("splits into batches, keeps failed events, backs off, then recovers", async () => {
    const writes: number[] = [];
    let fail = true;
    let now = 1_000_000;
    const sink = {
      name: "flaky",
      write: async (events: TelemetryEvent[]) => {
        if (fail) {
          throw new Error("down");
        }
        writes.push(events.length);
      },
    };
    const logs: string[] = [];
    const batcher = createBatcher(
      [sink],
      (m) => logs.push(m),
      () => now
    );
    for (let i = 0; i < BATCH_MAX + 5; i++) {
      batcher.push(event(i));
    }
    expect(await batcher.flush()).toBe(false);
    expect(batcher.size()).toBe(BATCH_MAX + 5);
    expect(logs[0]).toContain("retry in 5s");
    fail = false;
    expect(await batcher.flush()).toBe(false); // still backing off
    now += 6000;
    expect(await batcher.flush()).toBe(true);
    expect(writes).toEqual([BATCH_MAX, 5]);
    expect(batcher.size()).toBe(0);
  });
});

describe("scanOnce", () => {
  test("stamps identity, validates, dedupes against recent ids, survives a throwing collector", async () => {
    const raw: RawEvent = (({
      schema: _s,
      observedAt: _o,
      identity: _i,
      ...rest
    }) => rest)(validEvent);
    const good: Collector = {
      id: "claude-code",
      discover: async () => ["/x"],
      async *collect() {
        yield raw;
        yield { ...raw, eventId: "dup" };
        yield {
          ...raw,
          eventId: "bad",
          project: { dirHash: "h", name: "/abs/path" },
        };
      },
    };
    const broken: Collector = {
      id: "codex",
      discover: async () => ["/y"],
      async *collect() {
        yield { ...raw, eventId: "codex:1" };
        throw new Error("boom");
      },
    };
    const pushed: TelemetryEvent[] = [];
    const logs: string[] = [];
    const batcher = {
      push: (e: TelemetryEvent) => pushed.push(e),
      flush: async () => true,
      size: () => pushed.length,
      dropped: () => 0,
    };
    const recent = new Set(["dup"]);
    const result = await scanOnce(
      [good, broken],
      {
        cursors: { get: () => undefined, set: () => {}, save: () => {} },
        since: 0,
        log: (m) => logs.push(m),
      },
      batcher,
      { userId: "u", clientVersion: "t" },
      recent
    );
    expect(result).toEqual({
      events: 2,
      skipped: 2,
      byHarness: { "claude-code": 1, codex: 1 },
    });
    expect(pushed[0]?.identity).toEqual({ userId: "u", clientVersion: "t" });
    expect(pushed[0]?.schema).toBe("hackspain.telemetry.v1");
    expect(logs.some((l) => l.includes("dropped bad"))).toBe(true);
    expect(logs.some((l) => l.includes("collector failed"))).toBe(true);
  });
});

describe("telemetry stats", () => {
  test("summarize totals by harness and family", () => {
    const events = [
      event(1),
      event(2, {
        harness: "codex",
        model: { raw: "gpt-5", family: "gpt" },
        sessionId: "s2",
      }),
      stamp(
        {
          type: "session.start",
          eventId: "x",
          occurredAt: "2026-09-19T09:00:00.000Z",
          harness: "codex",
          sessionId: "s3",
        },
        { userId: "u", clientVersion: "t" }
      ),
    ];
    const s = summarize(events);
    expect(s.all.events).toBe(2);
    expect(s.all.sessions.size).toBe(3);
    expect(s.byHarness.get("codex")?.input).toBe(10);
    expect(s.byFamily.get("gpt")?.events).toBe(1);
    expect(s.first).toBe("2026-09-19T09:00:00.000Z");
  });
});

describe("notify", () => {
  test("picks a toaster per platform and formats terminal lines", () => {
    expect(platformToaster("darwin")).toBe(toastMac);
    expect(platformToaster("win32")).toBe(toastWindows);
    expect(platformToaster("linux")).toBe(toastLinux);
    const line = formatNotification(
      "Lunch",
      "Pizza at 14:00\nCourtyard",
      Date.UTC(2026, 8, 19, 12, 0)
    );
    expect(line).toContain("Organisers: Lunch");
    expect(line).toContain("\n  Courtyard");
  });
});

describe("fixtures stay redacted", () => {
  test("no home paths or message content", () => {
    const root = join(import.meta.dir, "fixtures");
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]
      );
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/\/home\/(?!hacker\b)[a-z]/);
      expect(text).not.toMatch(/\/Users\//);
    }
  });
});
