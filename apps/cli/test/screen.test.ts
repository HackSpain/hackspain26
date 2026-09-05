import { describe, expect, test } from "bun:test";
import { stripAnsi, width } from "../src/lib/style";
import {
  IDLE_AFTER_MS,
  IDLE_INTERVAL_MS,
  scanIntervalFor,
} from "../src/watcher/index";
import { box, diffFrame, fit, frame, gauge, wrap } from "../src/watcher/screen";
import {
  BUCKET_MS,
  createState,
  recordEvent,
  recordNotification,
  seriesWindow,
} from "../src/watcher/state";
import { validEvent } from "./schema.test";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

function sampleState() {
  const state = createState({
    me: { name: "Domènec", email: "d@example.com" },
    team: {
      name: "Quijote Labs",
      isOwner: true,
      repoUrl: "https://github.com/HackSpain/hackspain26",
      members: 3,
    },
    project: {
      name: "AgentOS",
      status: "draft",
      tracks: ["Maisa"],
      updatedAt: NOW,
    },
    uploadEnabled: true,
  });
  state.startedAt = NOW - 5 * 60 * 1000;
  state.harnesses = [
    { id: "claude-code", found: true, requests: 0, tokens: 0 },
    { id: "codex", found: false, requests: 0, tokens: 0 },
  ];
  for (let i = 0; i < 6; i++) {
    recordEvent(state, {
      ...validEvent,
      eventId: `e${i}`,
      sessionId: i < 3 ? "s1" : "s2",
      occurredAt: new Date(NOW - i * BUCKET_MS).toISOString(),
    });
  }
  recordNotification(
    state,
    "Pizza at 14:00",
    "Courtyard, bring your badge.",
    NOW - 30_000
  );
  state.nextScanAt = NOW + 18_000;
  state.upload.lastOkAt = NOW - 2000;
  return state;
}

describe("frame", () => {
  test("fills the terminal exactly at every size and always ends with the key hints", () => {
    for (const size of [
      { columns: 160, rows: 50 },
      { columns: 120, rows: 40 },
      { columns: 100, rows: 30 },
      { columns: 80, rows: 24 },
      { columns: 60, rows: 20 },
      { columns: 40, rows: 12 },
    ]) {
      const lines = frame(sampleState(), size, { now: NOW });
      expect(lines).toHaveLength(size.rows);
      for (const line of lines) {
        expect(width(line)).toBeLessThanOrEqual(Math.max(40, size.columns));
      }
      const text = stripAnsi(lines.join("\n"));
      expect(text).toContain("Harnesses");
      expect(text).toContain("Organisers");
      expect(stripAnsi(lines.at(-1) ?? "")).toContain("q quit");
    }
  });

  test("wide layout: explainer, profile, harness table, feed, recent requests", () => {
    const text = stripAnsi(
      frame(sampleState(), { columns: 120, rows: 40 }, { now: NOW }).join("\n")
    );
    expect(text).toContain("How this works");
    expect(text.replace(/[│\s]+/g, " ")).toContain(
      "Never prompts, code, or file paths"
    );
    expect(text).toContain("Domènec");
    expect(text).toContain("Quijote Labs");
    expect(text).toContain("Claude Code");
    expect(text).toContain("● live");
    expect(text).toContain("not on this machine");
    expect(text).toContain("Total");
    expect(text).toContain("2 sessions");
    expect(text).toContain("Recent requests");
    expect(text).toContain("claude-sonnet-5");
    expect(text).toContain("Pizza at 14:00");
    expect(text).toContain("Courtyard");
  });

  test("tiny terminals keep the harness table and the feed", () => {
    const text = stripAnsi(
      frame(sampleState(), { columns: 60, rows: 12 }, { now: NOW }).join("\n")
    );
    expect(text).toContain("Harnesses");
    expect(text).toContain("Organisers");
    expect(text).not.toContain("How this works");
  });

  test("wordmark only on tall terminals", () => {
    const tall = stripAnsi(
      frame(sampleState(), { columns: 120, rows: 50 }, { now: NOW }).join("\n")
    );
    const short = stripAnsi(
      frame(sampleState(), { columns: 120, rows: 30 }, { now: NOW }).join("\n")
    );
    expect(tall).toContain("██╗");
    expect(short).not.toContain("██╗");
    expect(short).toContain("HACKSPAIN");
  });

  test("paused is visible in the status line", () => {
    const state = sampleState();
    state.paused = true;
    const lines = frame(state, { columns: 100, rows: 30 }, { now: NOW });
    expect(stripAnsi(lines.at(-1) ?? "")).toContain("paused");
    expect(stripAnsi(lines.at(-1) ?? "")).toContain("p resume");
  });
});

describe("primitives", () => {
  test("box lines are exactly the requested width and height", () => {
    const lines = box(
      { title: "Title", subtitle: "sub", height: 3 },
      ["short", "a much longer line that will need to be cut down to size"],
      30
    );
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(width(line)).toBe(30);
    }
    expect(stripAnsi(lines[0] ?? "")).toContain("Title");
    expect(stripAnsi(lines[0] ?? "")).toContain("sub");
  });

  test("wrap keeps words whole", () => {
    expect(wrap("one two three four", 9)).toEqual(["one two", "three", "four"]);
    expect(wrap("", 9)).toEqual([""]);
  });

  test("gauge fills proportionally", () => {
    expect(stripAnsi(gauge(0.5, 10))).toBe("█████░░░░░");
    expect(stripAnsi(gauge(2, 4))).toBe("████");
  });

  test("fit truncates visible width and drops colour when cutting", () => {
    expect(fit("hello", 10)).toBe("hello");
    expect(fit("\x1b[1mhello world\x1b[22m", 6)).toBe("hello…");
  });

  test("diffFrame reports only changed rows and asks for a repaint on resize", () => {
    expect(diffFrame(undefined, ["a", "b"])).toBeUndefined();
    expect(diffFrame(["a", "b"], ["a", "b", "c"])).toBeUndefined();
    expect(diffFrame(["a", "b", "c"], ["a", "B", "c"])).toEqual([
      { row: 1, line: "B" },
    ]);
    expect(diffFrame(["a", "b"], ["a", "b"])).toEqual([]);
  });

  test("scan interval backs off after ten idle minutes and snaps back on activity", () => {
    const start = NOW;
    expect(scanIntervalFor(30_000, undefined, start + 60_000, start)).toBe(
      30_000
    );
    expect(
      scanIntervalFor(30_000, undefined, start + IDLE_AFTER_MS, start)
    ).toBe(IDLE_INTERVAL_MS);
    expect(
      scanIntervalFor(
        30_000,
        start + IDLE_AFTER_MS,
        start + IDLE_AFTER_MS + 1000,
        start
      )
    ).toBe(30_000);
    expect(
      scanIntervalFor(120_000, undefined, start + IDLE_AFTER_MS, start)
    ).toBe(120_000);
  });

  test("state keeps recent requests newest first and per-harness tokens", () => {
    const state = sampleState();
    expect(state.recent).toHaveLength(6);
    expect(state.recent[0]?.at).toBeGreaterThan(state.recent[5]?.at ?? 0);
    expect(state.harnesses[0]?.tokens).toBe(6 * 100);
    expect(seriesWindow(state, 8, NOW).map((p) => p.requests)).toEqual([
      0, 0, 1, 1, 1, 1, 1, 1,
    ]);
  });
});
