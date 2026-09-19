import { describe, expect, test } from "bun:test";
import type { TelemetryEvent } from "../src/watcher/schema";
import {
  canonicalize,
  eventId,
  modelFamily,
  SCHEMA,
  upgradeEvent,
  validateEvent,
} from "../src/watcher/schema";

export const validEvent: TelemetryEvent = {
  eventId: eventId("claude-code", "s1", "msg_1"),
  harness: "claude-code",
  identity: { clientVersion: "0.1.0", teamId: "t1", userId: "u1" },
  model: {
    family: "claude",
    name: "claude-sonnet-5",
    provider: "anthropic",
    raw: "claude-sonnet-5",
  },
  observedAt: "2026-09-19T10:00:05.000Z",
  occurredAt: "2026-09-19T10:00:00.000Z",
  project: {
    dirHash: "9f2c1a7b3e4d5c6a",
    name: "agentos",
    repo: "hackspain/agentos",
  },
  schema: SCHEMA,
  sessionId: "s1",
  tokens: { cacheRead: 30, cacheWrite: 40, input: 10, output: 20, total: 100 },
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
      validateEvent({
        ...validEvent,
        project: {
          dirHash: "9f2c1a7b3e4d5c6a",
          name: "agentos",
          repo: "https://github.com/hackspain/agentos",
        },
      })
    ).toContain("project needs dirHash and name");
    expect(
      validateEvent({ ...validEvent, model: { family: "llama", raw: "x" } })
    ).toContain("model needs raw, name, provider and a known family");
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

describe("one schema for every harness", () => {
  test("canonicalize derives the model, the total, and files the price under native", () => {
    const event = canonicalize({
      costUsd: 0.12,
      eventId: "opencode:s1:m1",
      harness: "opencode",
      model: { provider: "OpenRouter", raw: "anthropic/claude-sonnet-4.5" },
      occurredAt: "2026-09-19T10:00:00.000Z",
      sessionId: "s1",
      tokens: { cacheRead: 30, cacheWrite: 0, input: 10, output: 20 },
      type: "usage",
    });
    expect(event.model).toEqual({
      family: "claude",
      name: "claude-sonnet-4-5",
      provider: "openrouter",
      raw: "anthropic/claude-sonnet-4.5",
    });
    expect(event.tokens?.total).toBe(60);
    expect(event.native).toEqual({ costUsd: 0.12 });
    expect("costUsd" in event).toBe(false);
  });

  test("the validator holds every event to it", () => {
    expect(validateEvent({ ...validEvent, costUsd: 1 })).toContain(
      "costUsd belongs in native.costUsd"
    );
    expect(
      validateEvent({
        ...validEvent,
        tokens: { ...validEvent.tokens, total: 1 },
      })
    ).toContain("tokens.total must be input + output + cacheRead + cacheWrite");
    const { model: _m, ...noModel } = validEvent;
    expect(validateEvent(noModel)).toContain("usage events need a model");
    expect(
      validateEvent({ ...validEvent, native: { costUsd: 0.5, requestId: "r" } })
    ).toEqual([]);
    expect(
      validateEvent({
        ...validEvent,
        harness: "opencode",
        native: { requestId: "r" },
      })
    ).toContain("native contains fields that are not safe for this harness");
  });

  test("v1 lines in an old spool read as v2", () => {
    const v1 = {
      costUsd: 0.01,
      eventId: "opencode:s1:m1",
      harness: "opencode",
      identity: { clientVersion: "0.4.2", userId: "u1" },
      model: { family: "gpt", raw: "gpt-5-2025-08-07" },
      observedAt: "2026-09-19T10:00:05.000Z",
      occurredAt: "2026-09-19T10:00:00.000Z",
      schema: "hackspain.telemetry.v1",
      sessionId: "s1",
      tokens: { cacheRead: 1, cacheWrite: 2, input: 3, output: 4 },
      type: "usage",
    };
    const upgraded = upgradeEvent(v1);
    expect(validateEvent(upgraded)).toEqual([]);
    expect(upgraded.model?.name).toBe("gpt-5");
    expect(upgraded.model?.provider).toBe("openai");
    expect(upgraded.tokens?.total).toBe(10);
    expect(upgraded.native).toEqual({ costUsd: 0.01 });
    // Already v2: untouched.
    expect(upgradeEvent(validEvent)).toBe(validEvent);
  });
});
