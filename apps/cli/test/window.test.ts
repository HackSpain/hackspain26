import { describe, expect, test } from "bun:test";
import { TELEMETRY_STARTS_AT } from "../../app/src/app/api/cli/telemetry/window";
import { memoryCursorStore } from "../src/watcher/cursor-store";
import { outputWithReasoning } from "../src/watcher/schema";
import {
  collectionWindow,
  inWindow,
  isRecording,
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
  test("Friday at 17:00 Madrid, independently of the scheduled event opening", () => {
    expect(collectionWindow({ event: scheduled })).toEqual({
      since: TELEMETRY_STARTS_AT,
      until: END,
    });
    expect(new Date(TELEMETRY_STARTS_AT).toISOString()).toBe(
      "2026-09-18T15:00:00.000Z"
    );
  });

  test("no schedule, no window: nothing is recorded", () => {
    const unscheduled = {
      endsAt: undefined,
      open: true,
      phase: "unscheduled" as const,
      startsAt: undefined,
    };
    expect(collectionWindow({ event: unscheduled })).toBeNull();
  });

  test("the window is on the harness's timestamp, end exclusive", () => {
    const window = { since: START, until: END };
    expect(inWindow("2026-10-03T07:59:59.999Z", window)).toBe(false);
    expect(inWindow("2026-10-03T08:00:00.000Z", window)).toBe(true);
    expect(inWindow("2026-10-05T15:59:59.999Z", window)).toBe(true);
    expect(inWindow("2026-10-05T16:00:00.000Z", window)).toBe(false);
    expect(inWindow("not a date", window)).toBe(false);
  });
});

describe("windowPhase, isRecording and windowNotice", () => {
  const window = { since: START, until: END };
  const date = (ms: number) => `<${new Date(ms).toISOString()}>`;

  test("before, during and after, on the current clock", () => {
    expect(windowPhase(window, START - 1)).toBe("before");
    expect(windowPhase(window, START)).toBe("during");
    expect(windowPhase(window, END)).toBe("after");
    expect(windowPhase(null, START)).toBe("unscheduled");
    expect(windowPhase(undefined, START)).toBeUndefined();
  });

  test("recording happens only during the hackathon, for everybody", () => {
    expect(isRecording(window, START - 1)).toBe(false);
    expect(isRecording(window, START)).toBe(true);
    expect(isRecording(window, END)).toBe(false);
    expect(isRecording(null, START)).toBe(false);
  });

  test("a notice whenever it is not recording, with the date that matters", () => {
    expect(windowNotice(window, START, date)).toBeUndefined();
    expect(windowNotice(window, START - 1, date)).toContain(
      "starts <2026-10-03T08:00:00.000Z>"
    );
    expect(windowNotice(window, END, date)).toContain(
      "ended <2026-10-05T16:00:00.000Z>"
    );
    expect(windowNotice(null, START, date)).toContain(
      "no hackathon is scheduled"
    );
    expect(windowNotice(undefined, START, date)).toBeUndefined();
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
