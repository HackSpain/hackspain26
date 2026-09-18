"use client";

import { useSyncExternalStore } from "react";
import type { TvInsights } from "@/app/api/tv/insights/route";
import { HARNESSES } from "./mock-data";
import type { HarnessId, Sample, Team } from "./mock-data";

/**
 * Real data for the insights page and the TV's insight boxes: AI usage from
 * RawTree (what `hackspain watch` reports, schema hackspain.telemetry.v2)
 * plus teams and GitHub activity from Convex, served by /api/tv/insights.
 * One poller per page, however many charts or boxes are on screen.
 */

const POLL_MS = 30_000;
/** Usage from people who are not in a team yet: counted, never ranked. */
export const NO_TEAM_ID = "no-team";

export type LiveInsightData = {
  /** "loading" until the first answer; then where the usage came from. */
  status: "loading" | TvInsights["usage"];
  samples: Sample[];
  teams: Team[];
  /** Technologies per project; `auto` of `total` were read from a repo. */
  stacks: TvInsights["stacks"];
  /** Minutes each of the 24 buckets covers; the hackathon is not 12 hours. */
  bucketMinutes: number;
  startsAt?: number;
  endsAt?: number;
};

const EMPTY: LiveInsightData = {
  bucketMinutes: 30,
  samples: [],
  stacks: { auto: 0, rows: [], total: 0 },
  status: "loading",
  teams: [],
};

const HARNESS_IDS = new Set<string>(HARNESSES.map((harness) => harness.id));
const TEAM_COLORS = ["#d96b2a", "#35858a", "#1e3958", "#8b6b9f", "#a67516", "#677558"];

export function toInsightData(payload: TvInsights): LiveInsightData {
  const known = new Set(payload.teams.map((team) => team.id));
  const byKey = new Map<string, Sample>();
  const sampleFor = (teamId: string, harness: HarnessId, bucket: number) => {
    const key = `${teamId}:${harness}:${bucket}`;
    let sample = byKey.get(key);
    if (!sample) {
      sample = {
        bucket,
        cachedTokens: 0,
        commits: 0,
        harness,
        pullRequests: 0,
        sessions: 0,
        teamId,
        tokens: 0,
      };
      byKey.set(key, sample);
    }
    return sample;
  };

  const usageByTeam = new Map<string, Map<HarnessId, number>>();
  for (const row of payload.samples) {
    if (!HARNESS_IDS.has(row.harness)) {
      continue;
    }
    const harness = row.harness as HarnessId;
    const teamId = known.has(row.teamId) ? row.teamId : NO_TEAM_ID;
    const sample = sampleFor(teamId, harness, row.bucket);
    sample.tokens += row.tokens;
    sample.cachedTokens += row.cachedTokens;
    sample.sessions += row.sessions;
    const perHarness = usageByTeam.get(teamId) ?? new Map<HarnessId, number>();
    perHarness.set(harness, (perHarness.get(harness) ?? 0) + row.tokens);
    usageByTeam.set(teamId, perHarness);
  }
  // GitHub activity has no harness; it rides on the team's main one.
  const mainHarness = (teamId: string, rank: number): HarnessId => {
    const ranked = [...(usageByTeam.get(teamId) ?? [])].toSorted(
      (a, b) => b[1] - a[1]
    );
    return ranked[rank]?.[0] ?? ranked[0]?.[0] ?? "claude-code";
  };
  for (const row of payload.activity) {
    if (!known.has(row.teamId)) {
      continue;
    }
    const sample = sampleFor(row.teamId, mainHarness(row.teamId, 0), row.bucket);
    sample.commits += row.pushes;
    sample.pullRequests += row.pullRequests;
  }

  const teams: Team[] = payload.teams.map((team, index) => ({
    color: TEAM_COLORS[index % TEAM_COLORS.length] ?? "#d96b2a",
    description: "",
    id: team.id,
    members: team.members,
    name: team.name,
    primary: mainHarness(team.id, 0),
    project: team.project,
    secondary: mainHarness(team.id, 1),
    track: "",
  }));
  if (usageByTeam.has(NO_TEAM_ID)) {
    teams.push({
      color: "#8a7a6a",
      description: "",
      id: NO_TEAM_ID,
      members: 0,
      name: "Sin equipo",
      primary: mainHarness(NO_TEAM_ID, 0),
      project: "",
      secondary: mainHarness(NO_TEAM_ID, 1),
      track: "",
    });
  }

  const { startsAt, endsAt } = payload.window;
  const bucketMinutes =
    startsAt !== undefined && endsAt !== undefined && endsAt > startsAt
      ? (endsAt - startsAt) / payload.buckets / 60_000
      : 30;
  return {
    bucketMinutes,
    endsAt,
    samples: [...byKey.values()].toSorted((a, b) => a.bucket - b.bucket),
    stacks: payload.stacks,
    startsAt,
    status: payload.usage,
    teams,
  };
}

let current: LiveInsightData = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function refresh(): Promise<void> {
  // A background tab skips the periodic refresh, never the first load: a
  // page opened in another tab must not sit on "Cargando…" until looked at.
  if (
    typeof document !== "undefined" &&
    document.hidden &&
    current.status !== "loading"
  ) {
    return;
  }
  try {
    const response = await fetch("/api/tv/insights");
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    current = toInsightData((await response.json()) as TvInsights);
  } catch {
    // Keep the last good numbers on screen; only a first load shows nothing.
    if (current.status === "loading") {
      current = { ...EMPTY, status: "unavailable" };
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

// Coming back to the tab shows fresh numbers at once, not up to 30 s later.
function onVisibilityChange(): void {
  if (!document.hidden) {
    void refresh();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    void refresh();
    timer = setInterval(() => void refresh(), POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

let override: LiveInsightData | null = null;

/** Demo screens feed every live widget synthetic numbers instead of `/api/tv/insights`. */
export function setLiveInsightsOverride(data: LiveInsightData | null): void {
  override = data;
  for (const listener of listeners) {
    listener();
  }
}

export function useLiveInsights(): LiveInsightData {
  return useSyncExternalStore(
    subscribe,
    () => override ?? current,
    () => EMPTY
  );
}
