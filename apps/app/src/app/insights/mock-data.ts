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

export function filterSamples(
  samples: Sample[],
  period: Period,
  track: string
): Sample[] {
  const buckets = PERIODS.find((item) => item.id === period)?.buckets ?? 24;
  const ids = new Set(
    TEAMS.filter((team) => track === "all" || team.track === track).map(
      (team) => team.id
    )
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

export function teamRows(samples: Sample[]) {
  return TEAMS.filter((team) =>
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

export function timeLabel(bucket: number): string {
  return `${String(9 + Math.floor(bucket / 2)).padStart(2, "0")}:${bucket % 2 ? "30" : "00"}`;
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
