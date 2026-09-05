import { describe, expect, test } from "bun:test";
import { stripAnsi, width } from "../src/lib/style";
import {
  IDLE_AFTER_MS,
  IDLE_INTERVAL_MS,
  scanIntervalFor,
} from "../src/watcher/index";
import {
  box,
  chart,
  diffFrame,
  fit,
  frame,
  gauge,
} from "../src/watcher/screen";
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
    { id: "claude-code", found: true, requests: 0 },
    { id: "codex", found: false, requests: 0 },
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
      expect(text).toContain("Activity");
      expect(text).toContain("Organisers");
      expect(stripAnsi(lines.at(-1) ?? "")).toContain("q quit");
    }
  });

  test("wide layout has the profile, harnesses with gauges, and the feed side by side", () => {
    const text = stripAnsi(
      frame(sampleState(), { columns: 120, rows: 40 }, { now: NOW }).join("\n")
    );
    expect(text).toContain("Domènec");
    expect(text).toContain("Quijote Labs");
    expect(text).toContain("Harnesses");
    expect(text).toContain("input");
    expect(text).toContain("cached");
    expect(text).toContain("Pizza at 14:00");
    expect(text).toContain("Courtyard");
    expect(text).toContain("not on this machine");
    expect(text).toContain("6 requests");
    expect(text).toContain("2 sessions");
    expect(text).toContain("peak 1");
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

  test("paused and a fresh message change the status and the feed accent", () => {
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

  test("chart scales to the peak and uses partial blocks", () => {
    const rows = chart([0, 2, 4, 1], 2).map(stripAnsi);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe("  █ ");
    expect(rows[1]).toBe(" ██▄");
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

  test("seriesWindow is zero-filled, oldest first", () => {
    const state = sampleState();
    const points = seriesWindow(state, 8, NOW);
    expect(points).toHaveLength(8);
    expect(points.map((p) => p.requests)).toEqual([0, 0, 1, 1, 1, 1, 1, 1]);
    expect(points.at(-1)?.byHarness["claude-code"]).toBe(1);
  });
});
