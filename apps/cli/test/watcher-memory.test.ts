import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  catchUpSince,
  ephemeralMemory,
  openMemory,
  rememberNotification,
  replaySpool,
  shouldToast,
  TOAST_WINDOW_MS,
} from "../src/watcher/memory";
import { sinceLabel, summaryLines } from "../src/watcher/screen";
import { createState, NOTIFICATIONS_KEPT } from "../src/watcher/state";
import { validEvent } from "./schema.test";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

function tempPath(): string {
  return join(mkdtempSync(join(tmpdir(), "hs-memory-")), "watch-memory.json");
}

describe("watch memory file", () => {
  test("a first run starts fresh and persists across reopen", () => {
    const path = tempPath();
    const first = openMemory(path, NOW);
    expect(first.data).toEqual({
      firstStartedAt: NOW,
      notifications: [],
      version: 1,
    });
    first.data.lastActiveAt = NOW + 60_000;
    rememberNotification(first.data, {
      at: NOW + 30_000,
      body: "Courtyard",
      subject: "Pizza",
    });
    first.save();
    const again = openMemory(path, NOW + 3_600_000);
    expect(again.data.firstStartedAt).toBe(NOW);
    expect(again.data.lastActiveAt).toBe(NOW + 60_000);
    expect(again.data.lastNotificationAt).toBe(NOW + 30_000);
    expect(again.data.notifications).toHaveLength(1);
  });

  test("garbage on disk is ignored, not fatal", () => {
    const path = tempPath();
    writeFileSync(path, "{not json");
    expect(openMemory(path, NOW).data.firstStartedAt).toBe(NOW);
    writeFileSync(
      path,
      JSON.stringify({ version: 1, firstStartedAt: "x", notifications: [1] })
    );
    const loaded = openMemory(path, NOW).data;
    expect(loaded.firstStartedAt).toBe(NOW);
    expect(loaded.notifications).toEqual([]);
  });
});

describe("catchUpSince", () => {
  test("backfill wins, then the last scan, then now", () => {
    const memory = ephemeralMemory(NOW).data;
    expect(catchUpSince(memory, 2 * 3_600_000, NOW)).toBe(NOW - 2 * 3_600_000);
    expect(catchUpSince(memory, undefined, NOW)).toBe(NOW);
    memory.lastActiveAt = NOW - 5 * 3_600_000;
    expect(catchUpSince(memory, undefined, NOW)).toBe(NOW - 5 * 3_600_000);
    expect(catchUpSince(memory, 3_600_000, NOW)).toBe(NOW - 3_600_000);
  });
});

describe("remembered announcements", () => {
  test("newest first, deduplicated, capped, watermark kept", () => {
    const memory = ephemeralMemory(NOW).data;
    for (let i = 0; i < NOTIFICATIONS_KEPT + 5; i++) {
      rememberNotification(memory, {
        at: NOW + i * 1000,
        body: "b",
        subject: `n${i}`,
      });
    }
    rememberNotification(memory, { at: NOW + 3000, body: "b", subject: "n3" });
    expect(memory.notifications).toHaveLength(NOTIFICATIONS_KEPT);
    expect(memory.notifications[0]?.subject).toBe(`n${NOTIFICATIONS_KEPT + 4}`);
    expect(memory.lastNotificationAt).toBe(
      NOW + (NOTIFICATIONS_KEPT + 4) * 1000
    );
  });

  test("only fresh announcements toast", () => {
    expect(shouldToast(NOW - 1000, NOW)).toBe(true);
    expect(shouldToast(NOW - TOAST_WINDOW_MS, NOW)).toBe(true);
    expect(shouldToast(NOW - TOAST_WINDOW_MS - 1, NOW)).toBe(false);
  });
});

describe("replaySpool", () => {
  test("rebuilds totals, recent requests and per-harness counts", () => {
    const state = createState({
      me: { email: "d@example.com", name: "Domènec" },
      trackedSince: NOW - 86_400_000,
      uploadEnabled: false,
    });
    state.harnesses = [
      { found: true, id: "claude-code", requests: 0, tokens: 0 },
      { found: true, id: "codex", requests: 0, tokens: 0 },
    ];
    const events = Array.from({ length: 70 }, (_, i) => ({
      ...validEvent,
      eventId: `old-${i}`,
      harness: i % 7 === 0 ? ("codex" as const) : ("claude-code" as const),
      occurredAt: new Date(NOW - (70 - i) * 60_000).toISOString(),
      sessionId: `s${i % 3}`,
    }));
    expect(replaySpool(state, events)).toBe(70);
    expect(state.totals.requests).toBe(70);
    expect(state.totals.sessions.size).toBe(6);
    expect(state.recent).toHaveLength(60);
    expect(state.recent[0]?.at).toBeGreaterThan(state.recent[59]?.at ?? 0);
    expect(state.harnesses[1]?.requests).toBe(10);
    expect(state.harnesses[0]?.requests).toBe(60);
    const summary = summaryLines(state, NOW).join("\n");
    expect(summary).toContain("Since ");
    expect(summary).toContain("(this run ");
    expect(summary).toContain("70 requests");
  });
});

describe("sinceLabel", () => {
  test("time only today, day and time otherwise", () => {
    expect(sinceLabel(NOW - 3_600_000, NOW)).toMatch(/^\d{2}:\d{2}$/);
    expect(sinceLabel(NOW - 86_400_000, NOW)).toMatch(
      /^\w{3} \d{1,2} \w{3,4} \d{2}:\d{2}$/
    );
  });
});
