import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
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
  rmSync(dir, { force: true, recursive: true });
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
      calls.push({ init: init ?? {}, url: String(url) });
      return new Response(null, {
        status: calls.length === 1 ? 200 : 503,
        statusText: "x",
      });
    }) as typeof fetch;
    const sink = httpSink(
      "https://ingest.example/v1",
      async () => "tok",
      fetchImpl,
      {
        pendingPath: join(dir, "pending.json"),
        rejectionsPath: join(dir, "rejections.ndjson"),
      }
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

  test("persists a failed batch and retries it after a restart", async () => {
    const pendingPath = join(dir, "pending.json");
    const failed = httpSink(
      "https://ingest.example/v1",
      async () => "tok",
      (async () =>
        new Response(null, {
          status: 503,
          statusText: "down",
        })) as unknown as typeof fetch,
      { pendingPath }
    );

    await expect(failed.write([event(1)])).rejects.toMatchObject({
      code: "SINK_HTTP",
    });
    expect(existsSync(pendingPath)).toBe(true);

    const bodies: string[] = [];
    const recovered = httpSink(
      "https://ingest.example/v1",
      async () => "tok",
      (async (_input, init) => {
        bodies.push(String(init?.body));
        return new Response(null, { status: 200 });
      }) as typeof fetch,
      { pendingPath }
    );
    await recovered.flushPending?.();

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain(event(1).eventId);
    expect(existsSync(pendingPath)).toBe(false);
  });

  test("accounts for rejected events and keeps rejection details locally", async () => {
    const messages: string[] = [];
    const rejectionsPath = join(dir, "rejections.ndjson");
    const sink = httpSink(
      "https://ingest.example/v1",
      async () => "tok",
      (async () =>
        Response.json(
          {
            ok: true,
            value: {
              accepted: 1,
              rejected: 1,
              rejections: [
                { eventId: event(2).eventId, line: 2, reason: "invalid_event" },
              ],
              stored: true,
            },
          },
          { status: 202 }
        )) as unknown as typeof fetch,
      {
        onRejected: (message) => messages.push(message),
        pendingPath: join(dir, "pending.json"),
        rejectionsPath,
      }
    );

    await sink.write([event(1), event(2)]);

    expect(messages[0]).toContain("1 telemetry event was rejected");
    expect(readFileSync(rejectionsPath, "utf8")).toContain("invalid_event");
  });
});

describe("batcher", () => {
  test("flushes a durable upload even with no new in-memory events", async () => {
    let durable = 2;
    let flushes = 0;
    const batcher = createBatcher(
      [
        {
          flushPending: async () => {
            flushes++;
            durable = 0;
          },
          name: "durable",
          pending: () => durable,
          write: async () => {},
        },
      ],
      () => {}
    );

    expect(batcher.size()).toBe(2);
    expect(await batcher.flush()).toBe(true);
    expect(flushes).toBe(1);
    expect(batcher.size()).toBe(0);
  });

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
      async *collect() {
        yield raw;
        yield { ...raw, eventId: "dup" };
        yield {
          ...raw,
          eventId: "bad",
          project: { dirHash: "h", name: "/abs/path" },
        };
      },
      discover: async () => ["/x"],
      id: "claude-code",
    };
    const broken: Collector = {
      async *collect() {
        yield { ...raw, eventId: "codex:1" };
        throw new Error("boom");
      },
      discover: async () => ["/y"],
      id: "codex",
    };
    const pushed: TelemetryEvent[] = [];
    const logs: string[] = [];
    const batcher = {
      dropped: () => 0,
      flush: async () => true,
      push: (e: TelemetryEvent) => pushed.push(e),
      size: () => pushed.length,
    };
    const recent = new Set(["dup"]);
    const result = await scanOnce(
      [good, broken],
      {
        cursors: { get: () => undefined, save: () => {}, set: () => {} },
        log: (m) => logs.push(m),
        since: 0,
      },
      batcher,
      { clientVersion: "t", userId: "u" },
      recent
    );
    expect(result).toEqual({
      byHarness: { "claude-code": 1, codex: 1 },
      events: 2,
      skipped: 2,
    });
    expect(pushed[0]?.identity).toEqual({ clientVersion: "t", userId: "u" });
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
        model: { family: "gpt", raw: "gpt-5" },
        sessionId: "s2",
      }),
      stamp(
        {
          eventId: "x",
          harness: "codex",
          occurredAt: "2026-09-19T09:00:00.000Z",
          sessionId: "s3",
          type: "session.start",
        },
        { clientVersion: "t", userId: "u" }
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
