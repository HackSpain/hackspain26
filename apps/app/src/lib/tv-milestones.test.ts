import { describe, expect, test } from "bun:test";
import type { Sample, Team } from "@/app/insights/mock-data";
import {
  advanceMilestonePlayback,
  BROADCAST_MS,
  createMilestonePlayback,
  PANEL_BREAK_MS,
  reachedTokenMilestones,
  updateMilestonePlayback,
} from "./tv-milestones";

const teams: Team[] = [
  {
    color: "#000",
    description: "",
    id: "x",
    members: 3,
    name: "Equipo X",
    primary: "codex",
    project: "X",
    secondary: "claude-code",
    track: "",
  },
  {
    color: "#000",
    description: "",
    id: "y",
    members: 2,
    name: "Equipo Y",
    primary: "codex",
    project: "Y",
    secondary: "claude-code",
    track: "",
  },
];

function sample(teamId: string, bucket: number, tokens: number): Sample {
  return {
    bucket,
    cachedTokens: 0,
    commits: 0,
    harness: "codex",
    pullRequests: 0,
    sessions: 1,
    teamId,
    tokens,
  };
}

describe("reachedTokenMilestones", () => {
  test("stays empty until one of the broadcast thresholds is reached", () => {
    expect(reachedTokenMilestones([sample("x", 0, 49_999_999)], teams)).toEqual({
      event: undefined,
      teams: [],
    });
  });

  test("keeps collective billions exact, including tokens without a team", () => {
    const result = reachedTokenMilestones(
      [
        sample("x", 0, 55_000_000),
        sample("y", 1, 30_000_000),
        sample("y", 3, 25_000_000),
        sample("no-team", 2, 10_850_000_000),
        sample("no-team", 4, 400_000_000),
      ],
      teams,
    );

    expect(result.event?.tokens).toBe(11_000_000_000);
    expect(result.event?.crossedAtBucket).toBe(4);
    expect(result.teams.map((milestone) => [milestone.team.name, milestone.tokens])).toEqual([
      ["Equipo X", 50_000_000],
      ["Equipo Y", 50_000_000],
    ]);
    expect(result.teams[1]?.crossedAtBucket).toBe(3);
  });

  test.each([
    [49_999_999, 0], [50_000_000, 50_000_000], [99_999_999, 50_000_000],
    [100_000_000, 100_000_000], [249_999_999, 100_000_000],
    [250_000_000, 250_000_000], [499_999_999, 250_000_000],
    [500_000_000, 500_000_000], [999_999_999, 500_000_000],
    [1_000_000_000, 1_000_000_000], [1_999_999_999, 1_000_000_000],
    [2_000_000_000, 2_000_000_000], [11_500_000_000, 11_000_000_000],
  ])("team total %d yields only the highest milestone %d", (tokens, milestone) => {
    expect(reachedTokenMilestones([sample("x", 0, tokens)], teams).teams[0]?.tokens ?? 0).toBe(milestone);
  });
});

function snapshot(x: number, y = 0, unassigned = 0) {
  return reachedTokenMilestones([
    sample("x", 1, x), sample("y", 2, y), sample("no-team", 3, unassigned),
  ], teams);
}

describe("milestone playback", () => {
  test("joins live without replaying historical milestones; demo can replay the latest", () => {
    const initial = snapshot(250_000_000, 100_000_000);
    const live = updateMilestonePlayback(createMilestonePlayback(), initial, 0);
    expect(live.active).toBeUndefined();
    expect(live.pending).toEqual([]);
    expect(updateMilestonePlayback(live, initial, 1)).toBe(live);
    const demo = updateMilestonePlayback(createMilestonePlayback(), initial, 0, true);
    expect(demo.active?.id).toBe("team:y:100000000");
  });

  test("global takes priority and jumps only announce the highest crossed threshold", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(550_000_000, 100_000_000, 2_600_000_000), 100);
    expect(state.active?.id).toBe("event:3000000000");
    expect(state.pending.map((milestone) => milestone.id)).toEqual([
      "team:x:500000000", "team:y:100000000",
    ]);
  });

  test("shows for nine seconds, then leaves a full minute before the next announcement", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(50_000_000, 50_000_000), 100);
    const endsAt = 100 + BROADCAST_MS;
    expect(advanceMilestonePlayback(state, endsAt - 1)).toBe(state);
    state = advanceMilestonePlayback(state, endsAt);
    expect(state.active).toBeUndefined();
    expect(state.availableAt).toBe(endsAt + PANEL_BREAK_MS);
    expect(advanceMilestonePlayback(state, state.availableAt - 1)).toBe(state);
    state = advanceMilestonePlayback(state, state.availableAt);
    expect(state.active?.id).toBe("team:y:50000000");
    expect(state.endsAt).toBe(endsAt + PANEL_BREAK_MS + BROADCAST_MS);
  });

  test("new polls do not interrupt the active milestone or reset its timer", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(50_000_000), 100);
    const active = state.active;
    state = updateMilestonePlayback(state, snapshot(100_000_000, 100_000_000, 900_000_000), 200);
    expect(state.active).toBe(active);
    expect(state.endsAt).toBe(100 + BROADCAST_MS);
    expect(state.pending[0]?.kind).toBe("event");
  });

  test("coalesces pending scopes and respects the break even when new polls arrive", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(50_000_000, 50_000_000), 100);
    state = advanceMilestonePlayback(state, 100 + BROADCAST_MS);
    state = updateMilestonePlayback(state, snapshot(50_000_000, 100_000_000, 900_000_000), 10_000);
    state = updateMilestonePlayback(state, snapshot(50_000_000, 550_000_000, 1_900_000_000), 20_000);
    expect(state.active).toBeUndefined();
    expect(state.pending.map((milestone) => milestone.id)).toEqual([
      "event:2000000000", "team:y:500000000",
    ]);
    state = advanceMilestonePlayback(state, state.availableAt);
    expect(state.active?.id).toBe("event:2000000000");
  });

  test("does not replay after a correction, empty response, or repeated snapshot", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(50_000_000), 100);
    state = advanceMilestonePlayback(state, 100 + BROADCAST_MS);
    state = updateMilestonePlayback(state, snapshot(0), 20_000);
    state = updateMilestonePlayback(state, snapshot(50_000_000), 80_000);
    expect(state.active).toBeUndefined();
    expect(state.pending).toEqual([]);
    state = updateMilestonePlayback(state, snapshot(100_000_000), 90_000);
    expect(state.active?.id).toBe("team:x:100000000");
  });

  test("a delayed timer still gives the panel a full minute", () => {
    let state = updateMilestonePlayback(createMilestonePlayback(), snapshot(0), 0);
    state = updateMilestonePlayback(state, snapshot(50_000_000, 50_000_000), 100);
    state = advanceMilestonePlayback(state, 300_000);
    expect(state.active).toBeUndefined();
    expect(state.availableAt).toBe(300_000 + PANEL_BREAK_MS);
  });
});
