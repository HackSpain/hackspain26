import type { Sample, Team } from "@/app/insights/mock-data";

export const EVENT_TOKEN_STEP = 1_000_000_000;
export const TEAM_TOKEN_THRESHOLDS = [50_000_000, 100_000_000, 250_000_000, 500_000_000];
export const BROADCAST_MS = 9000;
export const PANEL_BREAK_MS = 60_000;

type TokenMilestoneBase = {
  crossedAtBucket: number;
  currentTokens: number;
  id: string;
  tokens: number;
};

export type EventTokenMilestone = TokenMilestoneBase & { kind: "event" };
export type TeamTokenMilestone<T extends Team = Team> = TokenMilestoneBase & {
  kind: "team";
  team: T;
};
export type TokenMilestone<T extends Team = Team> =
  | EventTokenMilestone
  | TeamTokenMilestone<T>;

function reachedMilestone(tokens: number, step: number): number {
  return Math.floor(tokens / step) * step;
}

function crossingBucket(samples: Sample[], milestone: number): number {
  let total = 0;
  const byBucket = new Map<number, number>();
  for (const sample of samples) {
    byBucket.set(sample.bucket, (byBucket.get(sample.bucket) ?? 0) + sample.tokens);
  }
  for (const [bucket, tokens] of [...byBucket].toSorted((a, b) => a[0] - b[0])) {
    total += tokens;
    if (total >= milestone) {
      return bucket;
    }
  }
  return -1;
}

/** Every scope's latest completed token step, for comparing consecutive TV polls. */
export function reachedTokenMilestones<T extends Team>(
  samples: Sample[],
  teams: T[],
): { event?: EventTokenMilestone; teams: TeamTokenMilestone<T>[] } {
  const currentTokens = samples.reduce((sum, sample) => sum + sample.tokens, 0);
  const eventTokens = reachedMilestone(currentTokens, EVENT_TOKEN_STEP);
  const event = eventTokens
    ? {
        crossedAtBucket: crossingBucket(samples, eventTokens),
        currentTokens,
        id: `event:${eventTokens}`,
        kind: "event" as const,
        tokens: eventTokens,
      }
    : undefined;

  const teamMilestones = teams.flatMap((team) => {
    const teamSamples = samples.filter((sample) => sample.teamId === team.id);
    const teamTokens = teamSamples.reduce((sum, sample) => sum + sample.tokens, 0);
    const milestone = teamTokens >= EVENT_TOKEN_STEP
      ? reachedMilestone(teamTokens, EVENT_TOKEN_STEP)
      : TEAM_TOKEN_THRESHOLDS.findLast((threshold) => teamTokens >= threshold) ?? 0;
    if (!milestone) {
      return [];
    }
    return [
      {
        crossedAtBucket: crossingBucket(teamSamples, milestone),
        currentTokens: teamTokens,
        id: `team:${team.id}:${milestone}`,
        kind: "team" as const,
        team,
        tokens: milestone,
      },
    ];
  });

  return { event, teams: teamMilestones };
}

type MilestoneSnapshot = ReturnType<typeof reachedTokenMilestones>;

export type MilestonePlayback = {
  seen: Map<string, number> | null;
  pending: TokenMilestone[];
  active?: TokenMilestone;
  endsAt: number;
  availableAt: number;
};

function scope(milestone: TokenMilestone): string {
  return milestone.kind === "event" ? "event" : `team:${milestone.team.id}`;
}

function entries(snapshot: MilestoneSnapshot): TokenMilestone[] {
  return snapshot.event ? [snapshot.event, ...snapshot.teams] : snapshot.teams;
}

export function createMilestonePlayback(): MilestonePlayback {
  return { seen: null, pending: [], endsAt: 0, availableAt: 0 };
}

/** A finished broadcast always leaves a full minute of visible panel, even after a delayed timer. */
export function advanceMilestonePlayback(state: MilestonePlayback, now: number): MilestonePlayback {
  if (state.active) {
    return now < state.endsAt ? state : {
      ...state, active: undefined, availableAt: now + PANEL_BREAK_MS,
    };
  }
  if (!state.pending.length || now < state.availableAt) {
    return state;
  }
  return {
    ...state, active: state.pending[0], pending: state.pending.slice(1), endsAt: now + BROADCAST_MS,
  };
}

/** Baseline the first valid poll; keep high-water marks across corrections and reconnects. */
export function updateMilestonePlayback(
  state: MilestonePlayback,
  snapshot: MilestoneSnapshot,
  now: number,
  replayInitial = false,
): MilestonePlayback {
  const milestones = entries(snapshot);
  const seen = new Map(state.seen);
  const arrived = milestones.filter((milestone) => milestone.tokens > (seen.get(scope(milestone)) ?? 0));
  for (const milestone of arrived) {
    seen.set(scope(milestone), milestone.tokens);
  }
  if (!state.seen) {
    const latest = replayInitial
      ? milestones.toSorted((a, b) => b.crossedAtBucket - a.crossedAtBucket)[0]
      : undefined;
    return advanceMilestonePlayback({ ...state, seen, pending: latest ? [latest] : [] }, now);
  }
  if (!arrived.length) {
    return state;
  }
  // Coalesce queued milestones by scope, so a team jumping 50M → 500M only gets its latest announcement.
  const pending = new Map(state.pending.map((milestone) => [scope(milestone), milestone]));
  for (const milestone of arrived) {
    pending.set(scope(milestone), milestone);
  }
  const ordered = [...pending.values()].toSorted((a, b) =>
    Number(b.kind === "event") - Number(a.kind === "event") ||
    a.crossedAtBucket - b.crossedAtBucket || a.id.localeCompare(b.id));
  return advanceMilestonePlayback({ ...state, seen, pending: ordered }, now);
}
