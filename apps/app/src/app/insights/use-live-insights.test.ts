import { describe, expect, test } from "bun:test";
import type { TvInsights } from "@/app/api/tv/insights/route";
import { filterSamples, harnessRows, sumSamples, teamRows } from "./mock-data";
import { NO_TEAM_ID, toInsightData } from "./use-live-insights";

const payload: TvInsights = {
  activity: [
    { bucket: 1, pullRequests: 1, pushes: 3, teamId: "t1" },
    { bucket: 1, pullRequests: 0, pushes: 9, teamId: "ghost" },
  ],
  buckets: 24,
  generatedAt: 0,
  people: [{ id: "u1", name: "Ana", pullRequests: 1, pushes: 3, team: "Los Compiladores", tokens: 200 }],
  // What the aggregate returned on a real ClickHouse for the sample events.
  samples: [
    { bucket: 0, cachedTokens: 70, harness: "claude-code", requests: 1, sessions: 1, teamId: "t1", tokens: 100 },
    { bucket: 1, cachedTokens: 70, harness: "claude-code", requests: 1, sessions: 0, teamId: "t1", tokens: 100 },
    { bucket: 1, cachedTokens: 70, harness: "codex", requests: 1, sessions: 1, teamId: "t1", tokens: 100 },
    { bucket: 8, cachedTokens: 70, harness: "opencode", requests: 1, sessions: 1, teamId: "", tokens: 100 },
    { bucket: 9, cachedTokens: 0, harness: "gemini-cli", requests: 1, sessions: 1, teamId: "t2", tokens: 40 },
    { bucket: 9, cachedTokens: 0, harness: "not-a-harness", requests: 1, sessions: 1, teamId: "t2", tokens: 999 },
  ],
  stacks: {
    auto: 1,
    rows: [{ category: "Frontend", count: 1, name: "Next.js" }],
    total: 1,
  },
  teams: [
    { id: "t1", members: 3, name: "Los Compiladores", project: "AgentOS" },
    { id: "t2", members: 2, name: "Tortilla Stack", project: "" },
  ],
  usage: "ok",
  window: {
    endsAt: Date.parse("2026-09-20T16:00:00Z"),
    startsAt: Date.parse("2026-09-18T16:45:00Z"),
  },
};

describe("toInsightData", () => {
  const data = toInsightData(payload);
  const samples = filterSamples(data.samples, "event", "all", data.teams);

  test("totals count every known harness, teamless usage included", () => {
    const totals = sumSamples(samples);
    expect(totals.tokens).toBe(440);
    expect(totals.cachedTokens).toBe(280);
    // A session spanning two buckets is one session.
    expect(totals.sessions).toBe(4);
    expect(totals.commits).toBe(3);
    expect(totals.pullRequests).toBe(1);
  });

  test("usage without a team is kept under its own id, so it can stay off the ranking", () => {
    const rows = teamRows(samples, data.teams);
    expect(rows.map((row) => [row.id, row.tokens])).toEqual([
      ["t1", 300],
      ["t2", 40],
      [NO_TEAM_ID, 100],
    ]);
    expect(rows[0]?.primary).toBe("claude-code");
    expect(rows[0]?.secondary).toBe("codex");
  });

  test("every harness the watcher reports has a row", () => {
    const tokens = Object.fromEntries(
      harnessRows(samples).map((row) => [row.id, row.tokens])
    );
    expect(tokens["claude-code"]).toBe(200);
    expect(tokens.codex).toBe(100);
    expect(tokens.opencode).toBe(100);
    expect(tokens["gemini-cli"]).toBe(40);
  });

  test("Pi and Oh My Pi usage contributes to totals and separate harness rows", () => {
    const piData = toInsightData({
      ...payload,
      samples: [
        { bucket: 1, cachedTokens: 30, harness: "pi", requests: 1, sessions: 1, teamId: "t1", tokens: 100 },
        { bucket: 1, cachedTokens: 40, harness: "omp", requests: 1, sessions: 1, teamId: "t1", tokens: 200 },
      ],
    });
    const totals = sumSamples(piData.samples);
    expect(totals.tokens).toBe(300);
    expect(totals.cachedTokens).toBe(70);
    expect(totals.sessions).toBe(2);
    const rows = harnessRows(piData.samples);
    expect(rows.find((row) => row.id === "pi")?.tokens).toBe(100);
    expect(rows.find((row) => row.id === "omp")?.tokens).toBe(200);
  });

  test("buckets follow the real hackathon, not a 12-hour day", () => {
    expect(data.bucketMinutes).toBeCloseTo(118.125);
    expect(data.startsAt).toBe(payload.window.startsAt);
    expect(data.status).toBe("ok");
  });
});
