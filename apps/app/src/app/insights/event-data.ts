import { TEAMS, sumSamples } from "./mock-data";
import type { Sample, Totals } from "./mock-data";

export const EVENT_MINUTES = 720;
export const SNAPSHOT_MINUTE = 705;
export const PHASES = [
  { color: "#35858a", end: 120, id: "start", name: "Arranque", start: 0 },
  { color: "#1e3958", end: 540, id: "build", name: "Construcción", start: 120 },
  { color: "#d96b2a", end: 720, id: "demo", name: "Preparar demo", start: 540 },
] as const;

// Fictional pricing for the mock. This is not a provider's price schedule.
export function usageUsd(totals: Pick<Totals, "tokens" | "cachedTokens">): number {
  return (
    ((totals.tokens - totals.cachedTokens) * 4 + totals.cachedTokens * 0.5) /
    1_000_000
  );
}

export function money(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function elapsed(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return hours
    ? `${hours} h${remainder ? ` ${remainder} min` : ""}`
    : `${remainder} min`;
}

export function eventTime(minutes: number): string {
  return `${String(9 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function phaseRows(samples: Sample[]) {
  return PHASES.map((phase) => {
    const rows = samples.filter(
      (sample) =>
        sample.bucket * 30 >= phase.start && sample.bucket * 30 < phase.end
    );
    const totals = sumSamples(rows);
    return {
      ...phase,
      ...totals,
      cost: usageUsd(totals),
      hourlyTokens: totals.tokens / ((phase.end - phase.start) / 60),
    };
  });
}

export function agentSessions(samples: Sample[]) {
  return samples.flatMap((sample) => {
    const teamIndex = TEAMS.findIndex((team) => team.id === sample.teamId);
    return Array.from({ length: sample.sessions }, (_, index) => {
      const start = sample.bucket * 30 + ((index * 7 + teamIndex * 3) % 30);
      const end = Math.min(
        EVENT_MINUTES,
        start + 8 + ((index * 11 + teamIndex * 5 + sample.bucket) % 33)
      );
      return { end, harness: sample.harness, start, teamId: sample.teamId };
    });
  });
}

export function concurrencyRows(samples: Sample[]) {
  const sessions = agentSessions(samples);
  const ids = [...new Set(samples.map((sample) => sample.teamId))];
  return Array.from({ length: EVENT_MINUTES + 1 }, (_, minute) => {
    const counts: Record<string, number> = {};
    for (const id of ids) {
      counts[id] = 0;
    }
    for (const session of sessions) {
      if (session.start <= minute && session.end > minute) {
        counts[session.teamId] += 1;
      }
    }
    return {
      counts,
      minute,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    };
  });
}

export const MILESTONES = TEAMS.map((team, index) => {
  const firstCommit = 4 + ((index * 7) % 25);
  const firstBuild = 38 + ((index * 31) % 160);
  return {
    firstBuild,
    firstCommit,
    firstDemo: index === 11 ? null : firstBuild + 60 + ((index * 47) % 380),
    teamId: team.id,
  };
});

