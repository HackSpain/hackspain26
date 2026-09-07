export const HARNESSES = [
  {
    color: "#d96b2a",
    id: "claude-code",
    mark: "CC",
    models: [0, 100, 0, 0],
    name: "Claude Code",
  },
  {
    color: "#35858a",
    id: "codex",
    mark: ">_",
    models: [100, 0, 0, 0],
    name: "Codex",
  },
  {
    color: "#1e3958",
    id: "cursor",
    mark: "Cu",
    models: [42, 43, 12, 3],
    name: "Cursor",
  },
  {
    color: "#8b6b9f",
    id: "opencode",
    mark: "OC",
    models: [28, 38, 19, 15],
    name: "OpenCode",
  },
  {
    color: "#a67516",
    id: "cline",
    mark: "Cl",
    models: [21, 52, 18, 9],
    name: "Cline",
  },
  {
    color: "#677558",
    id: "copilot",
    mark: "Co",
    models: [57, 34, 6, 3],
    name: "Copilot",
  },
] as const;

export const MODELS = ["GPT", "Claude", "Gemini", "Otros"] as const;
export const TRACKS = ["Agents", "DevTools", "Impacto"] as const;
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

export const TEAMS: Team[] = [
  {
    color: "#d96b2a",
    description:
      "Un espacio de trabajo donde agentes y personas construyen juntos.",
    id: "tortilla",
    members: 4,
    name: "Tortilla Overflow",
    primary: "claude-code",
    project: "AgentOS",
    secondary: "codex",
    track: "Agents",
  },
  {
    color: "#35858a",
    description:
      "Del primer commit a una demo desplegada, sin salir del terminal.",
    id: "siesta",
    members: 3,
    name: "Siesta.sh",
    primary: "codex",
    project: "Deploy & chill",
    secondary: "cursor",
    track: "DevTools",
  },
  {
    color: "#1e3958",
    description:
      "Agentes que conectan iniciativas locales con las personas que las necesitan.",
    id: "paella",
    members: 4,
    name: "Paella Intelligence",
    primary: "cursor",
    project: "Barrio",
    secondary: "claude-code",
    track: "Impacto",
  },
  {
    color: "#8b6b9f",
    description:
      "Revisiones de código que explican el contexto y proponen el siguiente paso.",
    id: "gitana",
    members: 4,
    name: "Git Happens",
    primary: "claude-code",
    project: "Reviewmate",
    secondary: "opencode",
    track: "DevTools",
  },
  {
    color: "#a67516",
    description:
      "Memoria compartida para equipos de agentes que trabajan en tareas largas.",
    id: "context",
    members: 3,
    name: "Context Cowboys",
    primary: "opencode",
    project: "Memory Lane",
    secondary: "codex",
    track: "Agents",
  },
  {
    color: "#677558",
    description: "Un tutor que adapta sus explicaciones a cada estudiante.",
    id: "churros",
    members: 4,
    name: "Churros & Code",
    primary: "cursor",
    project: "Aula abierta",
    secondary: "cline",
    track: "Impacto",
  },
  {
    color: "#35858a",
    description:
      "Herramientas de desarrollo que siguen funcionando sin conexión.",
    id: "localhost",
    members: 3,
    name: "Localhost Heroes",
    primary: "codex",
    project: "Local First",
    secondary: "copilot",
    track: "DevTools",
  },
  {
    color: "#d96b2a",
    description:
      "Un estudio creativo para convertir una idea en una historia interactiva.",
    id: "prompt",
    members: 4,
    name: "Prompt Fiction",
    primary: "claude-code",
    project: "Scene",
    secondary: "cursor",
    track: "Agents",
  },
  {
    color: "#a67516",
    description:
      "Rutas compartidas para reducir los desplazamientos de una comunidad.",
    id: "cache",
    members: 3,
    name: "Caché con leche",
    primary: "cline",
    project: "Green Route",
    secondary: "opencode",
    track: "Impacto",
  },
  {
    color: "#677558",
    description:
      "Un copiloto para mantener las entregas de equipos pequeños en movimiento.",
    id: "merge",
    members: 4,
    name: "Merge y punto",
    primary: "copilot",
    project: "Shipyard",
    secondary: "codex",
    track: "DevTools",
  },
  {
    color: "#8b6b9f",
    description:
      "Agentes que investigan y preparan decisiones con fuentes trazables.",
    id: "neural",
    members: 3,
    name: "Neural Nomads",
    primary: "opencode",
    project: "Compass",
    secondary: "claude-code",
    track: "Agents",
  },
  {
    color: "#1e3958",
    description:
      "Una ayuda cotidiana para coordinar las tareas de cuidado en familia.",
    id: "404",
    members: 4,
    name: "404 Sleep Not Found",
    primary: "cursor",
    project: "Cuida",
    secondary: "copilot",
    track: "Impacto",
  },
];

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

// Deterministic, fictional event telemetry. No participant data or API calls.
const BASE_SAMPLES: Sample[] = TEAMS.flatMap((team, teamIndex) =>
  Array.from({ length: 24 }, (_, bucket) =>
    [team.primary, team.secondary].map((harness, toolIndex) => {
      let phaseIndex = 2;
      if (bucket < 4) {
        phaseIndex = 0;
      } else if (bucket < 18) {
        phaseIndex = 1;
      }
      const rhythms = [
        [0.65, 1.05, 1.8],
        [1.25, 1, 0.55],
        [0.9, 1.05, 1.1],
      ];
      const wave =
        (0.65 + ((bucket * 7 + teamIndex * 3) % 9) / 12) *
        rhythms[teamIndex % rhythms.length][phaseIndex];
      const share = toolIndex === 0 ? 0.76 : 0.24;
      const tokens =
        Math.round(((15 - teamIndex) * 25_000 * wave * share) / 100) * 100;
      const commits = Math.max(
        0,
        Math.round(
          (4 + ((teamIndex * 5 + bucket * 3) % 15)) *
            share *
            wave *
            (0.75 + teamIndex / 22)
        )
      );
      return {
        bucket,
        cachedTokens: Math.round(tokens * (0.28 + (teamIndex % 5) * 0.09)),
        commits,
        harness,
        pullRequests: Math.floor(commits / (3 + (teamIndex % 3))),
        sessions: Math.max(1, Math.round((5 + (bucket % 6)) * share * wave)),
        teamId: team.id,
        tokens,
      };
    })
  ).flat()
);

export function getSamples(tick: number): Sample[] {
  return BASE_SAMPLES.map((sample, index) => {
    if (sample.bucket !== 23) {
      return sample;
    }
    const updates = Math.floor((tick + (index % 12)) / 12);
    const tokens = updates * (1200 + (index % 7) * 400);
    return {
      ...sample,
      cachedTokens: sample.cachedTokens + Math.round(tokens * 0.4),
      commits: sample.commits + updates,
      sessions: sample.sessions + updates,
      tokens: sample.tokens + tokens,
    };
  });
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
