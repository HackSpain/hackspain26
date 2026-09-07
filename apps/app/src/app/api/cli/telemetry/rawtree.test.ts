import { afterEach, describe, expect, test } from "bun:test";
import {
  parseTelemetryEvent,
  storeTelemetryEvents,
  type TelemetryEvent,
} from "./rawtree";

const originalEnvironment = {
  apiKey: process.env.RAWTREE_API_KEY,
  database: process.env.RAWTREE_DATABASE,
  baseUrl: process.env.RAWTREE_BASE_URL,
  table: process.env.RAWTREE_TELEMETRY_TABLE,
};

const event: TelemetryEvent = {
  schema: "hackspain.telemetry.v1",
  type: "usage",
  eventId: "codex:session-1:42",
  occurredAt: "2026-09-07T12:00:00.000Z",
  observedAt: "2026-09-07T12:00:01.000Z",
  harness: "codex",
  sessionId: "session-1",
  project: { dirHash: "9f2c1a7b3e4d5c6a", name: "agentos" },
  model: { raw: "gpt-5", family: "gpt", provider: "openai" },
  tokens: { input: 2, output: 3, cacheRead: 4, cacheWrite: 5 },
  identity: { userId: "user-1", teamId: "team-1", clientVersion: "0.1.0" },
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
      parseTelemetryEvent(event, { userId: "user-1", teamId: "team-1" })
    ).toEqual(event);
    expect(
      parseTelemetryEvent(event, {
        userId: "user-1",
        teamId: "current-team",
      })?.identity.teamId
    ).toBe("current-team");
    expect(
      parseTelemetryEvent(event, { userId: "another-user" })
    ).toBeNull();
    expect(
      parseTelemetryEvent(
        { ...event, project: { ...event.project, name: "/Users/alice/code" } },
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
      request = { input, init };
      return Response.json({ inserted: 1 });
    }) as typeof fetch;

    await storeTelemetryEvents([event], fetchImpl);

    expect(request?.input).toBe(
      "https://rawtree.example/v1/tables/cli_events?database=analytics"
    );
    expect(new Headers(request?.init?.headers).get("authorization")).toBe(
      "Bearer rt_test"
    );
    expect(JSON.parse(String(request?.init?.body))).toEqual([event]);
  });

  test("fails the batch when RawTree inserts fewer events than requested", async () => {
    process.env.RAWTREE_API_KEY = "rt_test";
    process.env.RAWTREE_DATABASE = "analytics";

    const fetchImpl = (async () =>
      Response.json({ inserted: 0 })) as unknown as typeof fetch;

    expect(storeTelemetryEvents([event], fetchImpl)).rejects.toThrow(
      "RawTree inserted 0 of 1 telemetry events"
    );
  });
});
