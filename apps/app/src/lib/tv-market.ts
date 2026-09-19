import { HARNESSES } from "@/app/insights/mock-data";
import type { HarnessId, Sample, Team } from "@/app/insights/mock-data";
import { NO_TEAM_ID } from "@/app/insights/use-live-insights";
import type { LiveInsightData } from "@/app/insights/use-live-insights";

/** The 24 buckets every insight source splits the hackathon into. */
export const MARKET_BUCKETS = 24;

export type MarketTeam = {
  id: string;
  name: string;
  project: string;
  tokens: number;
  /** Tokens spent in the bucket the board is currently in. */
  recent: number;
  pushes: number;
  pullRequests: number;
  rank: number;
  /** Places climbed since the previous bucket closed; negative means dropped. */
  move: number;
  /** Cumulative tokens per bucket, up to the current one. */
  trend: number[];
};

export type MarketTotals = {
  tokens: number;
  cachedTokens: number;
  pushes: number;
  pullRequests: number;
  sessions: number;
};

export type MarketSeries = MarketTotals[];

/** The bucket the board is in: the latest one anybody has reported usage or activity for. */
export function currentBucket(samples: Sample[]): number {
  let latest = 0;
  for (const sample of samples) {
    latest = Math.max(latest, sample.bucket);
  }
  return Math.min(latest, MARKET_BUCKETS - 1);
}

export function marketSeries(samples: Sample[]): MarketSeries {
  const series: MarketSeries = Array.from({ length: currentBucket(samples) + 1 }, () => ({
    cachedTokens: 0, pullRequests: 0, pushes: 0, sessions: 0, tokens: 0,
  }));
  for (const sample of samples) {
    const row = series[sample.bucket];
    if (!row) { continue; }
    row.tokens += sample.tokens;
    row.cachedTokens += sample.cachedTokens;
    row.pushes += sample.commits;
    row.pullRequests += sample.pullRequests;
    row.sessions += sample.sessions;
  }
  return series;
}

export function marketTotals(series: MarketSeries): MarketTotals {
  const totals: MarketTotals = { cachedTokens: 0, pullRequests: 0, pushes: 0, sessions: 0, tokens: 0 };
  for (const row of series) {
    totals.tokens += row.tokens;
    totals.cachedTokens += row.cachedTokens;
    totals.pushes += row.pushes;
    totals.pullRequests += row.pullRequests;
    totals.sessions += row.sessions;
  }
  return totals;
}

function ranks(rows: { id: string; tokens: number; name: string }[]): Map<string, number> {
  const sorted = rows.toSorted((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name, "es"));
  return new Map(sorted.map((row, index) => [row.id, index + 1]));
}

/** Every team on the board, best first. People without a team count in the totals, never here. */
export function marketTeams(samples: Sample[], teams: Team[]): MarketTeam[] {
  const current = currentBucket(samples);
  const listed = teams.filter((team) => team.id !== NO_TEAM_ID);
  const rows = listed.map((team) => {
    const perBucket = Array.from({ length: current + 1 }, () => 0);
    let pushes = 0;
    let pullRequests = 0;
    for (const sample of samples) {
      if (sample.teamId !== team.id) { continue; }
      perBucket[sample.bucket] = (perBucket[sample.bucket] ?? 0) + sample.tokens;
      pushes += sample.commits;
      pullRequests += sample.pullRequests;
    }
    let running = 0;
    const trend = perBucket.map((value) => { running += value; return running; });
    return {
      id: team.id, name: team.name, project: team.project,
      pullRequests, pushes, recent: perBucket[current] ?? 0, tokens: running, trend,
    };
  });
  const now = ranks(rows);
  const before = ranks(rows.map((row) => ({ ...row, tokens: row.tokens - row.recent })));
  return rows
    .map((row) => {
      const rank = now.get(row.id) ?? rows.length;
      // A team with nothing before this bucket has no earlier place to compare with.
      const move = row.tokens - row.recent > 0 ? (before.get(row.id) ?? rank) - rank : 0;
      return { ...row, move, rank };
    })
    .toSorted((a, b) => a.rank - b.rank);
}

export type MarketPost = {
  _id: string;
  kind: "post" | "github";
  authorName: string;
  teamName: string;
  text: string;
  createdAt: number;
};

/** What the board cycles through: every ranking page gets a turn, the charts in between. */
export type MarketSlide =
  | { kind: "pulso" } | { kind: "herramientas" } | { kind: "stacks" }
  | { kind: "ranking"; page: number; pages: number };

export function marketSlides(teamCount: number, pageSize: number): MarketSlide[] {
  const pages = Math.max(1, Math.ceil(teamCount / pageSize));
  const charts: MarketSlide[] = [{ kind: "pulso" }, { kind: "herramientas" }, { kind: "stacks" }];
  const slides: MarketSlide[] = [];
  for (let page = 0; page < Math.max(pages, charts.length); page += 1) {
    const chart = charts[page];
    if (chart) { slides.push(chart); }
    if (page < pages) { slides.push({ kind: "ranking", page, pages }); }
  }
  return slides;
}

/* ------------------------------------------------------------------ demo */

/** Park-Miller: the same invented numbers on every screen and every reload. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

const DEMO_TEAMS: [name: string, project: string][] = [
  ["Los Molinos", "Viento"], ["Rocinante Labs", "Galope"], ["Dulcinea", "Carta abierta"],
  ["Sancho Stack", "Escudero"], ["La Mancha ML", "Llanura"], ["Clavileño", "Vuelo sin motor"],
  ["Barataria", "Isla"], ["Yelmo de Mambrino", "Bacía"], ["Maese Pedro", "Retablo"],
  ["Cueva de Montesinos", "Eco"], ["Bachiller Carrasco", "Espejos"], ["Tizona", "Filo"],
  ["Venta del Puerto", "Posada"], ["Alcalá Bytes", "Cervantes API"], ["Galeotes", "Cadena"],
  ["Toboso Tech", "Aldea"], ["Babieca", "Trote"],
];
const DEMO_HARNESSES: [HarnessId, number][] = [
  ["claude-code", 0.36], ["cursor", 0.24], ["codex", 0.17], ["opencode", 0.09],
  ["gemini-cli", 0.07], ["copilot", 0.04], ["cline", 0.03],
];
const DEMO_BUCKET = 15;
const DEMO_MODELS: [name: string, family: string, provider: string, share: number][] = [
  ["claude-sonnet-4-5", "claude", "anthropic", 0.31], ["gpt-5-codex", "gpt", "openai", 0.22],
  ["claude-opus-4-1", "claude", "anthropic", 0.14], ["gemini-2-5-pro", "gemini", "google", 0.11],
  ["gpt-5", "gpt", "openai", 0.08], ["qwen3-coder", "qwen", "alibaba", 0.05],
  ["kimi-k2", "other", "moonshot", 0.04], ["gemini-2-5-flash", "gemini", "google", 0.03],
];

/**
 * Invented teams and numbers for `/tv?view=panel&demo=1`, never mixed with real
 * ones. `step` grows the bucket in progress so the board visibly moves.
 */
export function demoInsights(step: number, now: number): LiveInsightData {
  const random = seeded(2026);
  const samples: Sample[] = [];
  const teams: Team[] = DEMO_TEAMS.map(([name, project], index) => ({
    color: HARNESSES[index % HARNESSES.length]?.color ?? "#d96b2a",
    description: "", id: `demo-${index}`, members: 3 + (index % 3), name,
    primary: "claude-code", project, secondary: "cursor", track: "",
  }));
  for (const [index, team] of teams.entries()) {
    const appetite = 0.35 + random() * 1.6;
    const harnesses = DEMO_HARNESSES.filter(() => random() > 0.45).slice(0, 3);
    const mix = harnesses.length ? harnesses : DEMO_HARNESSES.slice(0, 1);
    for (let bucket = 0; bucket <= DEMO_BUCKET; bucket += 1) {
      // Quiet at night (buckets 6 to 9), loud before the deadline.
      const rhythm = bucket >= 6 && bucket <= 9 ? 0.25 : 0.7 + bucket / 20;
      const live = bucket === DEMO_BUCKET ? 0.2 + (((step + index * 7) % 40) / 40) * (index % 3 === 0 ? 5 : 1) : 1;
      for (const [harness, weight] of mix) {
        const tokens = Math.round(appetite * rhythm * weight * live * (0.6 + random() * 0.9) * 2_400_000);
        samples.push({
          bucket, cachedTokens: Math.round(tokens * (0.5 + random() * 0.3)),
          commits: harness === mix[0]?.[0] ? Math.round(random() * 5 * rhythm * live) : 0,
          harness, pullRequests: harness === mix[0]?.[0] && random() > 0.7 ? 1 : 0,
          sessions: 1 + Math.round(random() * 3), teamId: team.id, tokens,
        });
      }
    }
  }
  const bucketMs = 2 * 3_600_000;
  const startsAt = now - (DEMO_BUCKET + 0.6) * bucketMs;
  const total = samples.reduce((sum, sample) => sum + sample.tokens, 0);
  // Shares drift with `step` so the ranking visibly trades places.
  const models = DEMO_MODELS.map(([name, family, provider, share], index) => {
    const wobble = 1 + 0.18 * Math.sin((step + index * 5) / 3);
    return {
      family, name, provider,
      requests: Math.round(total * share * wobble / 38_000),
      tokens: Math.round(total * share * wobble),
    };
  }).toSorted((a, b) => b.tokens - a.tokens);
  return {
    bucketMinutes: bucketMs / 60_000, endsAt: startsAt + MARKET_BUCKETS * bucketMs, models, samples,
    stacks: {
      auto: 14, total: DEMO_TEAMS.length,
      rows: [
        ["TypeScript", "language", 15], ["React", "frontend", 13], ["Next.js", "frontend", 11],
        ["Python", "language", 9], ["Tailwind CSS", "frontend", 9], ["Convex", "backend", 7],
        ["FastAPI", "backend", 5], ["Postgres", "data", 5], ["Vercel AI SDK", "ai", 4],
        ["Cloudflare Workers", "infra", 3], ["Tinybird", "data", 3], ["Rust", "language", 2],
      ].map(([name, category, count]) => ({ category: String(category), count: Number(count), name: String(name) })),
    },
    startsAt, status: "ok", teams,
  };
}

const DEMO_POSTS: [kind: MarketPost["kind"], author: string, team: string, text: string][] = [
  ["github", "lucia-fdz", "Los Molinos", "feat: el molino ya responde por voz"],
  ["post", "Dani", "Rocinante Labs", "Primera demo funcionando de punta a punta. Ahora a dormir dos horas."],
  ["github", "mvillacampa", "Sancho Stack", "fix: race condition al cerrar la sesión del agente"],
  ["post", "Irene", "Dulcinea", "Alguien tiene un cable HDMI de sobra? Estamos en la mesa 12."],
  ["github", "pablo-rg", "La Mancha ML", "Abre PR #14: embeddings en streaming"],
  ["post", "Nuria", "Clavileño", "El café de la tercera planta es claramente superior. De nada."],
  ["github", "sara-dev", "Barataria", "refactor: adiós al monolito, hola workers"],
  ["github", "jorgeql", "Tizona", "feat: exportar el informe a PDF"],
  ["post", "Álex", "Maese Pedro", "Buscamos a alguien que sepa de WebRTC, media hora nada más."],
  ["github", "martaog", "Alcalá Bytes", "test: cobertura de la API al 80 %"],
];

export function demoFeed(now: number): MarketPost[] {
  return DEMO_POSTS.map(([kind, authorName, teamName, text], index) => ({
    _id: `demo-post-${index}`, authorName, createdAt: now - (index * 4 + 1) * 61_000, kind, teamName, text,
  }));
}
