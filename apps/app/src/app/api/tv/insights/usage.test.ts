import { afterEach, describe, expect, test } from "bun:test";
import { fetchUsage, modelsSql, parseModelRows, parsePersonRows, parseUsageRows, peopleSql, usageSql } from "./usage";

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

describe("modelsSql", () => {
  test("dedupes on the permanent key and groups by the normalised model name", () => {
    const sql = modelsSql("hackspain_otel_logs", window);
    expect(sql).toContain("GROUP BY userId, id");
    expect(sql).toContain("any(toString(`gen_ai.request.model`)) AS model");
    expect(sql).toContain("any(toString(`hackspain.model.family`)) AS family");
    expect(sql).toContain("any(toString(`gen_ai.provider.name`)) AS provider");
    expect(sql).toContain("at >= 1789749900 AND at < 1789920000");
    expect(sql).toContain("GROUP BY model");
    expect(() => modelsSql("t; DROP TABLE x", window)).toThrow();
  });
});

test("peopleSql dedupes on the permanent key and sums tokens per person", () => {
  const sql = peopleSql("hackspain_otel_logs", window);
  expect(sql).toContain("GROUP BY userId, id");
  expect(sql).toContain("at >= 1789749900 AND at < 1789920000 AND userId != ''");
  expect(sql).toContain("GROUP BY userId\n");
  expect(() => peopleSql("t; DROP TABLE x", window)).toThrow();
});

test("parsePersonRows drops rows without a user", () => {
  expect(
    parsePersonRows([{ tokens: "900", userId: "u1" }, { tokens: 5 }, { tokens: 5, userId: "" }, null])
  ).toEqual([{ tokens: 900, userId: "u1" }]);
});

test("parseModelRows fills family and provider and drops nameless rows", () => {
  expect(
    parseModelRows([
      { family: "gpt", name: "gpt-5-codex", provider: "openai", requests: "3", tokens: "900" },
      { name: "mystery", tokens: 5 },
      { family: "claude", tokens: 5 },
      null,
    ])
  ).toEqual([
    { family: "gpt", name: "gpt-5-codex", provider: "openai", requests: 3, tokens: 900 },
    { family: "other", name: "mystery", provider: "unknown", requests: 0, tokens: 5 },
  ]);
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
      models: [],
      people: [],
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
      const sql = (JSON.parse(String(init?.body)) as { sql: string }).sql;
      let data: unknown[] = [{ bucket: 0, cachedTokens: 70, harness: "claude-code", requests: 1, sessions: 1, teamId: "t1", tokens: 100 }];
      if (sql.includes("GROUP BY model")) {
        data = [{ family: "claude", name: "claude-sonnet-4-5", provider: "anthropic", requests: 1, tokens: 100 }];
      } else if (sql.includes("GROUP BY userId\n")) {
        data = [{ tokens: 100, userId: "u1" }];
      }
      return Response.json({
        data,
        meta: [],
        rows: 1,
        statistics: { bytes_read: 0, elapsed: 0, rows_read: 0 },
      });
    }) as typeof fetch;
    const result = await fetchUsage(window, fetchImpl);
    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(1);
    expect(result.models).toEqual([
      { family: "claude", name: "claude-sonnet-4-5", provider: "anthropic", requests: 1, tokens: 100 },
    ]);
    expect(result.people).toEqual([{ tokens: 100, userId: "u1" }]);
    // One aggregate per table read: usage per team/harness/bucket, models and people.
    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toContain("https://rawtree.test/v1/query");
    expect(calls[0]?.url).toContain("database=hackspain");
    expect(calls[0]?.auth).toBe("Bearer rt_read_write");
    expect(calls[0]?.sql).toContain("FROM hackspain_otel_logs");
    expect(calls[1]?.sql).toContain("FROM hackspain_otel_logs");
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
      models: [],
      people: [],
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
