import { afterEach, describe, expect, test } from "bun:test";
import { fetchUsage, parseUsageRows, usageSql } from "./usage";

const window = {
  buckets: 24,
  endsAt: Date.parse("2026-09-20T16:00:00Z"),
  startsAt: Date.parse("2026-09-18T16:45:00Z"),
};

const ENV = [
  "RAWTREE_API_KEY",
  "RAWTREE_DATABASE",
  "RAWTREE_BASE_URL",
] as const;
const original = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of ENV) {
    if (original[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original[name];
    }
  }
});

describe("usageSql", () => {
  // RawTree's OTLP transform flattens attributes into dotted top-level
  // columns. These checks pin the permanent dedupe key, event time and
  // standard/custom attribute names the aggregate relies on.
  test("dedupes on the permanent key and buckets on the harness's time", () => {
    const sql = usageSql("hackspain_otel_logs", window);
    expect(sql).toContain("GROUP BY userId, id");
    expect(sql).toContain("toString(`hackspain.user.id`) AS userId");
    expect(sql).toContain("toString(timeUnixNano)");
    expect(sql).toContain("toString(`hackspain.usage.total_tokens`)");
    expect(sql).toContain("WHERE toString(eventName) = 'hackspain.usage'");
    // 47 h 15 min in 24 buckets, from the start of the hackathon.
    expect(sql).toContain("intDiv(at - 1789749900, 7087)");
    expect(sql).toContain("at >= 1789749900 AND at < 1789920000");
    expect(sql).toContain("s.firstBucket = b.bucket");
  });

  test("the table name is never interpolated unchecked", () => {
    expect(() => usageSql("t; DROP TABLE x", window)).toThrow();
    expect(() => usageSql("cli_events", window)).not.toThrow();
  });
});

test("parseUsageRows accepts numbers or numeric strings and drops junk", () => {
  expect(
    parseUsageRows([
      {
        bucket: "1",
        cachedTokens: "70",
        harness: "codex",
        requests: 1,
        sessions: "1",
        teamId: "t1",
        tokens: "100",
      },
      { bucket: 8, harness: "opencode", teamId: "", tokens: 100 },
      { bucket: 1, tokens: 5 },
      null,
    ])
  ).toEqual([
    {
      bucket: 1,
      cachedTokens: 70,
      harness: "codex",
      requests: 1,
      sessions: 1,
      teamId: "t1",
      tokens: 100,
    },
    {
      bucket: 8,
      cachedTokens: 0,
      harness: "opencode",
      requests: 0,
      sessions: 0,
      teamId: "",
      tokens: 100,
    },
  ]);
});

describe("fetchUsage", () => {
  test("without a RawTree key it says so instead of failing", async () => {
    delete process.env.RAWTREE_API_KEY;
    process.env.RAWTREE_DATABASE = "hackspain";
    expect(await fetchUsage(window)).toEqual({
      rows: [],
      status: "unconfigured",
    });
  });

  test("queries RawTree with the shared key and returns the rows", async () => {
    process.env.RAWTREE_API_KEY = "rt_read_write";
    process.env.RAWTREE_DATABASE = "hackspain";
    process.env.RAWTREE_BASE_URL = "https://rawtree.test";
    const calls: { url: string; auth: string | null; sql: string }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        auth: headers.get("authorization"),
        sql: (JSON.parse(String(init?.body)) as { sql: string }).sql,
        url: String(input),
      });
      return Response.json({
        data: [
          { bucket: 0, cachedTokens: 70, harness: "claude-code", requests: 1, sessions: 1, teamId: "t1", tokens: 100 },
        ],
        meta: [],
        rows: 1,
        statistics: { bytes_read: 0, elapsed: 0, rows_read: 0 },
      });
    }) as typeof fetch;
    const result = await fetchUsage(window, fetchImpl);
    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(1);
    expect(calls[0]?.url).toContain("https://rawtree.test/v1/query");
    expect(calls[0]?.url).toContain("database=hackspain");
    expect(calls[0]?.auth).toBe("Bearer rt_read_write");
    expect(calls[0]?.sql).toContain("FROM hackspain_otel_logs");
  });

  test("no table yet (before the first event) is empty, not an error", async () => {
    process.env.RAWTREE_API_KEY = "rt_read_write";
    process.env.RAWTREE_DATABASE = "hackspain";
    const missing = (async () =>
      Response.json(
        { error: "unknown_table", hint: "", message: "Table hackspain_otel_logs does not exist" },
        { status: 404 }
      )) as unknown as typeof fetch;
    expect(await fetchUsage(window, missing)).toEqual({
      rows: [],
      status: "empty",
    });
  });

  test("any other failure is thrown for the route to report", async () => {
    process.env.RAWTREE_API_KEY = "rt_read_write";
    process.env.RAWTREE_DATABASE = "hackspain";
    const broken = (async () =>
      Response.json(
        { error: "forbidden", hint: "", message: "read permission required" },
        { status: 403 }
      )) as unknown as typeof fetch;
    await expect(fetchUsage(window, broken)).rejects.toThrow();
  });
});
