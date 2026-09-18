import { describe, expect, test } from "bun:test";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { outputWithReasoning } from "../src/watcher/schema";
import {
  collectionWindow,
  inWindow,
  windowNotice,
  windowPhase,
} from "../src/watcher/window";

const START = Date.parse("2026-10-03T08:00:00Z");
const END = Date.parse("2026-10-05T16:00:00Z");
const scheduled = {
  endsAt: END,
  open: true,
  phase: "during" as const,
  startsAt: START,
};

describe("collectionWindow", () => {
  test("a scheduled hackathon is reported whole, whenever the watcher opens", () => {
    const lastRun = Date.parse("2026-10-04T12:00:00Z");
    expect(
      collectionWindow({ event: scheduled, role: "user" }, lastRun)
    ).toEqual({ scheduled: true, since: START, until: END });
  });

  test("without a schedule, and for organisers, the catch-up rule stays", () => {
    const unscheduled = {
      endsAt: undefined,
      open: true,
      phase: "unscheduled" as const,
      startsAt: undefined,
    };
    expect(collectionWindow({ event: unscheduled, role: "user" }, 42)).toEqual({
      scheduled: false,
      since: 42,
    });
    expect(collectionWindow({ event: scheduled, role: "admin" }, 42)).toEqual({
      scheduled: false,
      since: 42,
    });
  });

  test("the window is on the harness's timestamp, end exclusive", () => {
    const window = { since: START, until: END };
    expect(inWindow("2026-10-03T07:59:59.999Z", window)).toBe(false);
    expect(inWindow("2026-10-03T08:00:00.000Z", window)).toBe(true);
    expect(inWindow("2026-10-05T15:59:59.999Z", window)).toBe(true);
    expect(inWindow("2026-10-05T16:00:00.000Z", window)).toBe(false);
    expect(inWindow("not a date", window)).toBe(false);
    expect(inWindow("2030-01-01T00:00:00Z", { since: START })).toBe(true);
  });
});

describe("windowPhase and windowNotice", () => {
  const window = { scheduled: true, since: START, until: END };
  const date = (ms: number) => `<${new Date(ms).toISOString()}>`;

  test("before, during and after, on the current clock", () => {
    expect(windowPhase(window, START - 1)).toBe("before");
    expect(windowPhase(window, START)).toBe("during");
    expect(windowPhase(window, END)).toBe("after");
    expect(windowPhase({ scheduled: false, since: 0 }, START)).toBeUndefined();
    expect(windowPhase(undefined, START)).toBeUndefined();
  });

  test("a notice only while outside, with the date that matters", () => {
    expect(windowNotice(window, START, date)).toBeUndefined();
    expect(windowNotice(window, START - 1, date)).toContain(
      "starts <2026-10-03T08:00:00.000Z>"
    );
    expect(windowNotice(window, END, date)).toContain(
      "ended <2026-10-05T16:00:00.000Z>"
    );
    expect(
      windowNotice({ scheduled: false, since: 0 }, 1, date)
    ).toBeUndefined();
  });
});

describe("cursor coverage", () => {
  test("an earlier since starts the cursors over; the same or later keeps them", () => {
    const cursors = memoryCursorStore();
    expect(cursors.coverFrom(END)).toBe(false);
    cursors.set("/log.jsonl", { mtimeMs: 1, offset: 900 });
    expect(cursors.coverFrom(END + 1)).toBe(false);
    expect(cursors.get("/log.jsonl")?.offset).toBe(900);
    // First windowed run: lines skipped as "too old" must be read again.
    expect(cursors.coverFrom(START)).toBe(true);
    expect(cursors.get("/log.jsonl")).toBeUndefined();
    expect(cursors.coverFrom(START)).toBe(false);
  });
});

describe("outputWithReasoning", () => {
  test("adds thoughts only when the record's total counts them apart", () => {
    const base = { output: 340, prompt: 12_000, reasoning: 120 };
    expect(
      outputWithReasoning({ ...base, separateByDefault: false, total: 12_460 })
    ).toBe(460);
    expect(
      outputWithReasoning({ ...base, separateByDefault: true, total: 12_340 })
    ).toBe(340);
  });

  test("without a total, follows what the upstream API does", () => {
    const base = { output: 80, prompt: 500, reasoning: 20, total: 0 };
    expect(outputWithReasoning({ ...base, separateByDefault: true })).toBe(100);
    expect(outputWithReasoning({ ...base, separateByDefault: false })).toBe(80);
  });
});
