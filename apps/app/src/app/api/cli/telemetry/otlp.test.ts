import { afterEach, describe, expect, test } from "bun:test";
import { exportTelemetryAsOtlpLogs, toOtlpLogs } from "./otlp";
import type { TelemetryEvent } from "./rawtree";

const event: TelemetryEvent = {
  costUsd: 0.25,
  eventId: "claude-code:session-1:msg_1",
  harness: "claude-code",
  identity: { clientVersion: "0.4.0", teamId: "team-1", userId: "user-1" },
  model: { family: "claude", provider: "anthropic", raw: "claude-fable-5-1" },
  native: { requestId: "req_1" },
  // Read two days after it happened.
  observedAt: "2026-10-05T10:00:00.000Z",
  occurredAt: "2026-10-03T09:30:00.000Z",
  project: { dirHash: "9f2c1a7b3e4d5c6a", name: "agentos" },
  schema: "hackspain.telemetry.v1",
  sessionId: "session-1",
  tokens: { cacheRead: 4, cacheWrite: 5, input: 2, output: 3, reasoning: 1 },
  type: "usage",
};

const ENV = [
  "RAWTREE_API_KEY",
  "RAWTREE_BASE_URL",
  "RAWTREE_DATABASE",
  "RAWTREE_OTLP_LOGS_TABLE",
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

function attribute(record: { attributes: { key: string; value: unknown }[] }, key: string) {
  return record.attributes.find((entry) => entry.key === key)?.value;
}

describe("toOtlpLogs", () => {
  test("the log is timed when the harness recorded it, not when it was read", () => {
    const record = toOtlpLogs([event]).resourceLogs[0]?.scopeLogs[0]?.logRecords[0];
    expect(record?.timeUnixNano).toBe("1791019800000000000");
    expect(record?.observedTimeUnixNano).toBe("1791194400000000000");
    expect(record?.eventName).toBe("hackspain.usage");
  });

  test("GenAI names where they exist, hackspain.* for the rest", () => {
    const record = toOtlpLogs([event]).resourceLogs[0]?.scopeLogs[0]?.logRecords[0];
    if (!record) {
      throw new Error("no record");
    }
    expect(attribute(record, "gen_ai.request.model")).toEqual({
      stringValue: "claude-fable-5-1",
    });
    expect(attribute(record, "gen_ai.usage.input_tokens")).toEqual({ intValue: "2" });
    expect(attribute(record, "gen_ai.usage.output_tokens")).toEqual({ intValue: "3" });
    expect(attribute(record, "gen_ai.conversation.id")).toEqual({
      stringValue: "session-1",
    });
    expect(attribute(record, "hackspain.usage.cache_read_tokens")).toEqual({
      intValue: "4",
    });
    expect(attribute(record, "hackspain.cost_usd")).toEqual({ doubleValue: 0.25 });
    expect(attribute(record, "event.id")).toEqual({
      stringValue: "claude-code:session-1:msg_1",
    });
  });

  test("absent fields are left out; batches group by CLI version", () => {
    const start: TelemetryEvent = {
      eventId: "codex:s2:start",
      harness: "codex",
      identity: { clientVersion: "0.3.0", userId: "user-1" },
      observedAt: event.observedAt,
      occurredAt: event.occurredAt,
      schema: "hackspain.telemetry.v1",
      sessionId: "s2",
      type: "session.start",
    };
    const logs = toOtlpLogs([event, start]);
    expect(logs.resourceLogs).toHaveLength(2);
    const record = logs.resourceLogs[1]?.scopeLogs[0]?.logRecords[0];
    expect(record?.attributes.map((entry) => entry.key)).toEqual([
      "event.id",
      "gen_ai.conversation.id",
      "hackspain.schema",
      "hackspain.harness",
      "hackspain.user.id",
    ]);
  });
});

describe("exportTelemetryAsOtlpLogs", () => {
  test("off unless a logs table is configured", async () => {
    delete process.env.RAWTREE_OTLP_LOGS_TABLE;
    process.env.RAWTREE_API_KEY = "key";
    let called = false;
    await exportTelemetryAsOtlpLogs([event], (() => {
      called = true;
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch);
    expect(called).toBe(false);
  });

  test("posts OTLP/JSON to RawTree with the table and database headers", async () => {
    process.env.RAWTREE_OTLP_LOGS_TABLE = "hackspain_otel_logs";
    process.env.RAWTREE_API_KEY = "key";
    process.env.RAWTREE_DATABASE = "hackspain";
    process.env.RAWTREE_BASE_URL = "https://rawtree.test/";
    const calls: { url: string; init: RequestInit }[] = [];
    await exportTelemetryAsOtlpLogs([event], ((url: string, init: RequestInit) => {
      calls.push({ init, url });
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch);
    expect(calls[0]?.url).toBe("https://rawtree.test/otlp/v1/logs");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer key");
    expect(headers["x-rawtree-logs-table"]).toBe("hackspain_otel_logs");
    expect(headers["x-rawtree-database"]).toBe("hackspain");
    expect(headers["content-type"]).toBe("application/json");
  });

  test("a partial success with rejected records is an error", async () => {
    process.env.RAWTREE_OTLP_LOGS_TABLE = "hackspain_otel_logs";
    process.env.RAWTREE_API_KEY = "key";
    const rejected = (() =>
      Promise.resolve(
        Response.json({ partialSuccess: { rejectedLogRecords: 1 } })
      )) as unknown as typeof fetch;
    await expect(exportTelemetryAsOtlpLogs([event], rejected)).rejects.toThrow(
      "rejected 1"
    );
  });
});
