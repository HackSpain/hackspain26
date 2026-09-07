import { describe, expect, test } from "bun:test";
import type { TelemetryEvent } from "../src/watcher/schema";
import {
  eventId,
  modelFamily,
  SCHEMA,
  validateEvent,
} from "../src/watcher/schema";

export const validEvent: TelemetryEvent = {
  eventId: eventId("claude-code", "s1", "msg_1"),
  harness: "claude-code",
  identity: { clientVersion: "0.1.0", teamId: "t1", userId: "u1" },
  model: { family: "claude", provider: "anthropic", raw: "claude-sonnet-5" },
  observedAt: "2026-09-19T10:00:05.000Z",
  occurredAt: "2026-09-19T10:00:00.000Z",
  project: { dirHash: "9f2c1a7b3e4d5c6a", name: "agentos" },
  schema: SCHEMA,
  sessionId: "s1",
  tokens: { cacheRead: 30, cacheWrite: 40, input: 10, output: 20 },
  type: "usage",
};

describe("validateEvent", () => {
  test("accepts a canonical event", () => {
    expect(validateEvent(validEvent)).toEqual([]);
  });

  test("session events need no tokens; usage events do", () => {
    const { tokens: _t, ...noTokens } = validEvent;
    expect(validateEvent({ ...noTokens, type: "session.start" })).toEqual([]);
    expect(validateEvent(noTokens)).toContain("usage events need tokens");
  });

  test("rejects paths in project.name, bad families, and missing identity", () => {
    expect(
      validateEvent({
        ...validEvent,
        project: { dirHash: "9f2c1a7b3e4d5c6a", name: "/home/x" },
      })
    ).toContain("project.name must be a basename, not a path");
    expect(
      validateEvent({ ...validEvent, model: { family: "llama", raw: "x" } })
    ).toContain("model needs raw and a known family");
    expect(validateEvent({ ...validEvent, identity: {} })).toContain(
      "identity needs userId and clientVersion"
    );
    expect(
      validateEvent({
        ...validEvent,
        tokens: { cacheRead: 0, cacheWrite: 0, input: -1, output: 0 },
      })
    ).toContain("tokens.input must be a non-negative integer");
    expect(
      validateEvent({
        ...validEvent,
        native: { prompt: "do not collect this" },
      })
    ).toContain("native contains fields that are not safe for this harness");
    expect(validateEvent("nope")).toEqual(["not an object"]);
  });
});

describe("modelFamily", () => {
  test("maps raw model ids onto the dashboard buckets", () => {
    expect(modelFamily("claude-fable-5-1")).toBe("claude");
    expect(modelFamily("gpt-5-codex")).toBe("gpt");
    expect(modelFamily("o3-mini")).toBe("gpt");
    expect(modelFamily("gemini-2.5-pro")).toBe("gemini");
    expect(modelFamily("nemotron-3.5-lightning-free")).toBe("other");
  });
});
