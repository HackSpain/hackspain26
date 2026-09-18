export const HARNESSES = [
  {
    color: "#d96b2a",
    id: "claude-code",
    mark: "CC",
    name: "Claude Code",
  },
  {
    color: "#35858a",
    id: "codex",
    mark: ">_",
    name: "Codex",
  },
  {
    color: "#1e3958",
    id: "cursor",
    mark: "Cu",
    name: "Cursor",
  },
  {
    color: "#8b6b9f",
    id: "opencode",
    mark: "OC",
    name: "OpenCode",
  },
  {
    color: "#a67516",
    id: "cline",
    mark: "Cl",
    name: "Cline",
  },
  {
    color: "#677558",
    id: "copilot",
    mark: "Co",
    name: "Copilot",
  },
  // The rest of the harnesses the watcher collects (apps/cli/src/watcher).
  {
    color: "#3f6fd1",
    id: "gemini-cli",
    mark: "Ge",
    name: "Gemini CLI",
  },
  {
    color: "#6a4bc4",
    id: "qwen-code",
    mark: "Qw",
    name: "Qwen Code",
  },
  {
    color: "#b8432f",
    id: "kilo-code",
    mark: "Ki",
    name: "Kilo Code",
  },
] as const;

export const TRACKS: string[] = [];
export const PERIODS = [
  { buckets: 24, id: "event", label: "Todo el evento" },
  { buckets: 12, id: "6h", label: "Últimas 6 horas" },
  { buckets: 2, id: "1h", label: "Última hora" },
] as const;

export type Period = (typeof PERIODS)[number]["id"];
export type Track = (typeof TRACKS)[number];
export type HarnessId = (typeof HARNESSES)[number]["id"];
export type Metric = "tokens" | "commits" | "pullRequests";

export interface Team {
  id: string;
  name: string;
  project: string;
  description: string;
  track: Track;
  members: number;
  primary: HarnessId;
  secondary: HarnessId;
  color: string;
}

// Insights telemetry is not connected yet. Never substitute fictional teams.
export const TEAMS: Team[] = [];

export interface Sample {
  teamId: string;
  harness: HarnessId;
  bucket: number;
  tokens: number;
  commits: number;
  pullRequests: number;
  sessions: number;
  cachedTokens: number;
}

// Keep metrics at zero until an actual telemetry source is connected.
export function getSamples(): Sample[] {
  return [];
}

/** `teams` defaults to the static list; live callers pass the real ones. */
export function filterSamples(
  samples: Sample[],
  period: Period,
  track: string,
  teams: Team[] = TEAMS
): Sample[] {
  const buckets = PERIODS.find((item) => item.id === period)?.buckets ?? 24;
  const ids = new Set(
    teams
      .filter((team) => track === "all" || team.track === track)
      .map((team) => team.id)
  );
  return samples.filter(
    (sample) => sample.bucket >= 24 - buckets && ids.has(sample.teamId)
  );
}

export interface Totals {
  tokens: number;
  commits: number;
  pullRequests: number;
  sessions: number;
  cachedTokens: number;
}

export function sumSamples(samples: Sample[]): Totals {
  const totals: Totals = {
    cachedTokens: 0,
    commits: 0,
    pullRequests: 0,
    sessions: 0,
    tokens: 0,
  };
  for (const sample of samples) {
    totals.tokens += sample.tokens;
    totals.commits += sample.commits;
    totals.pullRequests += sample.pullRequests;
    totals.sessions += sample.sessions;
    totals.cachedTokens += sample.cachedTokens;
  }
  return totals;
}

/** Totals per bucket, preserving the order in which buckets appear. */
export function bucketTotals(samples: Sample[]): Totals[] {
  return [...new Set(samples.map((sample) => sample.bucket))].map((bucket) =>
    sumSamples(samples.filter((sample) => sample.bucket === bucket))
  );
}

export function teamRows(samples: Sample[], teams: Team[] = TEAMS) {
  return teams.filter((team) =>
    samples.some((sample) => sample.teamId === team.id)
  ).map((team) => ({
    ...team,
    ...sumSamples(samples.filter((sample) => sample.teamId === team.id)),
  }));
}
export type TeamRow = ReturnType<typeof teamRows>[number];

export function harnessRows(samples: Sample[]) {
  return HARNESSES.map((harness) => {
    const rows = samples.filter((sample) => sample.harness === harness.id);
    return {
      ...harness,
      ...sumSamples(rows),
      teams: new Set(rows.map((sample) => sample.teamId)).size,
    };
  });
}
export type HarnessRow = ReturnType<typeof harnessRows>[number];

/**
 * Where the buckets sit in real time. Without one, charts keep the 12-hour
 * day of the static layout (09:00, 30 minutes a bucket).
 */
export type Timeline = { startsAt?: number; bucketMinutes: number };

const REAL_TIME = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
  weekday: "short",
});

/** Minutes since the start as a clock time: "sáb 10:30" on a real timeline. */
export function minuteLabel(minutes: number, timeline?: Timeline): string {
  if (timeline?.startsAt === undefined) {
    return `${String(9 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
  }
  return REAL_TIME.format(new Date(timeline.startsAt + minutes * 60_000));
}

export function timeLabel(bucket: number, timeline?: Timeline): string {
  return minuteLabel(bucket * (timeline?.bucketMinutes ?? 30), timeline);
}

export function compact(value: number): string {
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value / 1_000_000)} M`;
  }
  if (value >= 1000) {
    return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value / 1000)} k`;
  }
  return String(value);
}
export function number(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}
export function percent(value: number, total: number): string {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(total ? (value / total) * 100 : 0)} %`;
}
