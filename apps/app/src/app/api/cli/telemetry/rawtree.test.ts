import { describe, expect, test } from "bun:test";
import { occurredInWindow, parseTelemetryEvent } from "./rawtree";
import type { TelemetryEvent } from "./rawtree";

const event: TelemetryEvent = {
  eventId: "codex:session-1:42",
  harness: "codex",
  identity: { clientVersion: "0.1.0", teamId: "team-1", userId: "user-1" },
  model: { family: "gpt", name: "gpt-5", provider: "openai", raw: "gpt-5" },
  observedAt: "2026-09-07T12:00:01.000Z",
  occurredAt: "2026-09-07T12:00:00.000Z",
  project: {
    dirHash: "9f2c1a7b3e4d5c6a",
    name: "agentos",
    repo: "hackspain/agentos",
  },
  schema: "hackspain.telemetry.v2",
  sessionId: "session-1",
  tokens: { cacheRead: 4, cacheWrite: 5, input: 2, output: 3, total: 14 },
  type: "usage",
};

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
        {
          ...event,
          project: {
            ...event.project,
            repo: "https://token@github.com/hackspain/agentos",
          },
        },
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

  test("a v1 event from an older binary is canonicalized as the same v2 event", () => {
    const v1 = {
      ...event,
      costUsd: 0.25,
      model: { family: "gpt", provider: "openai", raw: "gpt-5" },
      schema: "hackspain.telemetry.v1",
      tokens: { cacheRead: 4, cacheWrite: 5, input: 2, output: 3 },
    };
    expect(parseTelemetryEvent(v1, { teamId: "team-1", userId: "user-1" })).toEqual(
      { ...event, native: { costUsd: 0.25 } }
    );
  });

  test("derived fields are computed here, never taken from the client", () => {
    const forged = {
      ...event,
      model: {
        family: "claude",
        name: "something-else",
        provider: "OpenRouter",
        raw: "openai/gpt-5-2025-08-07",
      },
      tokens: { ...event.tokens, total: 999_999 },
    };
    const parsed = parseTelemetryEvent(forged, { userId: "user-1" });
    expect(parsed?.model).toEqual({
      family: "gpt",
      name: "gpt-5",
      provider: "openrouter",
      raw: "openai/gpt-5-2025-08-07",
    });
    expect(parsed?.tokens?.total).toBe(14);
  });

  test("usage needs a model; native is an allowlist per harness", () => {
    const { model: _model, ...noModel } = event;
    expect(parseTelemetryEvent(noModel, { userId: "user-1" })).toBeNull();
    // requestId is Claude Code's; a price is fine from any harness.
    expect(
      parseTelemetryEvent(
        { ...event, native: { requestId: "req_1" } },
        { userId: "user-1" }
      )
    ).toBeNull();
    expect(
      parseTelemetryEvent(
        { ...event, native: { costUsd: 0.5 } },
        { userId: "user-1" }
      )?.native
    ).toEqual({ costUsd: 0.5 });
    expect(
      parseTelemetryEvent(
        { ...event, native: { costUsd: -1 } },
        { userId: "user-1" }
      )
    ).toBeNull();
  });
});

describe("occurredInWindow", () => {
  const window = {
    endsAt: Date.parse("2026-09-20T16:00:00Z"),
    startsAt: Date.parse("2026-09-18T16:45:00Z"),
  };

  test("only the hackathon, on the harness's time, end exclusive", () => {
    expect(occurredInWindow("2026-09-18T14:59:59.999Z", window)).toBe(false);
    expect(occurredInWindow("2026-09-18T15:00:00.000Z", window)).toBe(false);
    expect(occurredInWindow("2026-09-18T16:44:59.999Z", window)).toBe(false);
    expect(occurredInWindow("2026-09-18T16:45:00.000Z", window)).toBe(true);
    expect(occurredInWindow("2026-09-20T15:59:59.999Z", window)).toBe(true);
    expect(occurredInWindow("2026-09-20T16:00:00.000Z", window)).toBe(false);
  });

  test("no scheduled hackathon, nothing is stored", () => {
    expect(occurredInWindow("2026-09-19T10:00:00Z", {})).toBe(false);
    expect(
      occurredInWindow("2026-09-19T10:00:00Z", { startsAt: window.startsAt })
    ).toBe(false);
  });
});
