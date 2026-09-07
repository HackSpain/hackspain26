import { afterEach, describe, expect, test } from "bun:test";
import { parseTelemetryEvent, storeTelemetryEvents } from "./rawtree";
import type { TelemetryEvent } from "./rawtree";

const originalEnvironment = {
  apiKey: process.env.RAWTREE_API_KEY,
  baseUrl: process.env.RAWTREE_BASE_URL,
  database: process.env.RAWTREE_DATABASE,
  table: process.env.RAWTREE_TELEMETRY_TABLE,
};

const event: TelemetryEvent = {
  eventId: "codex:session-1:42",
  harness: "codex",
  identity: { clientVersion: "0.1.0", teamId: "team-1", userId: "user-1" },
  model: { family: "gpt", provider: "openai", raw: "gpt-5" },
  observedAt: "2026-09-07T12:00:01.000Z",
  occurredAt: "2026-09-07T12:00:00.000Z",
  project: { dirHash: "9f2c1a7b3e4d5c6a", name: "agentos" },
  schema: "hackspain.telemetry.v1",
  sessionId: "session-1",
  tokens: { cacheRead: 4, cacheWrite: 5, input: 2, output: 3 },
  type: "usage",
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restore("RAWTREE_API_KEY", originalEnvironment.apiKey);
  restore("RAWTREE_DATABASE", originalEnvironment.database);
  restore("RAWTREE_BASE_URL", originalEnvironment.baseUrl);
  restore("RAWTREE_TELEMETRY_TABLE", originalEnvironment.table);
});

describe("RawTree telemetry", () => {
  test("accepts only canonical events belonging to the authenticated user", () => {
    expect(
      parseTelemetryEvent(event, { teamId: "team-1", userId: "user-1" })
    ).toEqual(event);
    expect(
      parseTelemetryEvent(event, {
        teamId: "current-team",
        userId: "user-1",
      })?.identity.teamId
    ).toBe("current-team");
    expect(parseTelemetryEvent(event, { userId: "another-user" })).toBeNull();
    expect(
      parseTelemetryEvent(
        { ...event, project: { ...event.project, name: "/Users/alice/code" } },
        { userId: "user-1" }
      )
    ).toBeNull();
    expect(
      parseTelemetryEvent(
        { ...event, native: { prompt: "do not collect this" } },
        { userId: "user-1" }
      )
    ).toBeNull();
  });

  test("inserts the canonical events through the RawTree SDK", async () => {
    process.env.RAWTREE_API_KEY = "rt_test";
    process.env.RAWTREE_DATABASE = "analytics";
    process.env.RAWTREE_TELEMETRY_TABLE = "cli_events";
    process.env.RAWTREE_BASE_URL = "https://rawtree.example/";

    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = { init, input };
      return Response.json({ inserted: 1 });
    }) as typeof fetch;

    await storeTelemetryEvents([event], fetchImpl);

    const url = new URL(String(request?.input));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://rawtree.example/v1/tables/cli_events"
    );
    expect(url.searchParams.get("database")).toBe("analytics");
    expect(url.searchParams.get("deduplicate_insert")).toBe("enable");
    expect(url.searchParams.get("insert_deduplication_token")).toMatch(
      /^[a-f\d]{64}$/
    );
    expect(new Headers(request?.init?.headers).get("authorization")).toBe(
      "Bearer rt_test"
    );
    expect(JSON.parse(String(request?.init?.body))).toEqual([event]);
  });

  test("accepts a deduplicated replay that inserts zero new rows", async () => {
    process.env.RAWTREE_API_KEY = "rt_test";
    process.env.RAWTREE_DATABASE = "analytics";

    const fetchImpl = (async () =>
      Response.json({ inserted: 0 })) as unknown as typeof fetch;

    await expect(
      storeTelemetryEvents([event], fetchImpl)
    ).resolves.toBeUndefined();
  });

  test("uses a stable token and order, and rejects a partial insert", async () => {
    process.env.RAWTREE_API_KEY = "rt_test";
    process.env.RAWTREE_DATABASE = "analytics";
    const second = { ...event, eventId: "codex:session-1:43" };
    const requests: { url: string; body: string }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ body: String(init?.body), url: String(input) });
      return Response.json({ inserted: requests.length === 3 ? 1 : 2 });
    }) as typeof fetch;

    await storeTelemetryEvents([second, event], fetchImpl);
    await storeTelemetryEvents([event, second], fetchImpl);
    const firstUrl = new URL(requests[0]?.url ?? "");
    const secondUrl = new URL(requests[1]?.url ?? "");
    expect(firstUrl.searchParams.get("insert_deduplication_token")).toBe(
      secondUrl.searchParams.get("insert_deduplication_token")
    );
    expect(requests[0]?.body).toBe(requests[1]?.body);

    await expect(
      storeTelemetryEvents([event, second], fetchImpl)
    ).rejects.toThrow("RawTree inserted 1 of 2 telemetry events");
  });
});
