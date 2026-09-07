import { describe, expect, test } from "bun:test";
import {
  eventId,
  modelFamily,
  SCHEMA,
  type TelemetryEvent,
  validateEvent,
} from "../src/watcher/schema";

export const validEvent: TelemetryEvent = {
  schema: SCHEMA,
  type: "usage",
  eventId: eventId("claude-code", "s1", "msg_1"),
  occurredAt: "2026-09-19T10:00:00.000Z",
  observedAt: "2026-09-19T10:00:05.000Z",
  harness: "claude-code",
  sessionId: "s1",
  project: { dirHash: "abc", name: "agentos" },
  model: { raw: "claude-sonnet-5", family: "claude", provider: "anthropic" },
  tokens: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 },
  identity: { userId: "u1", teamId: "t1", clientVersion: "0.1.0" },
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
        project: { dirHash: "x", name: "/home/x" },
      })
    ).toContain("project.name must be a basename, not a path");
    expect(
      validateEvent({ ...validEvent, model: { raw: "x", family: "llama" } })
    ).toContain("model needs raw and a known family");
    expect(validateEvent({ ...validEvent, identity: {} })).toContain(
      "identity needs userId and clientVersion"
    );
    expect(
      validateEvent({
        ...validEvent,
        tokens: { input: -1, output: 0, cacheRead: 0, cacheWrite: 0 },
      })
    ).toContain("tokens.input must be a non-negative integer");
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
