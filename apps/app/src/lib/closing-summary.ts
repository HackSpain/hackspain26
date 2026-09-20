import { HARNESSES } from "../app/insights/mock-data";
import { TRACK_SYMBOLS } from "../components/participant-directory/network-model";
import type { ClosingData } from "./closing";
import { HARNESS_ICONS, TECH_ICONS } from "./tv-icons";

const MADRID = "Europe/Madrid";
/** Buckets whose midpoint falls before this hour in Madrid count as night. */
const NIGHT_ENDS_HOUR = 7;
const SPRINT_BUCKETS = 2;
/** A team needs this share of the top team's tokens to compete on cache rate. */
const CACHE_AWARD_FLOOR = 0.05;

/** `icon` is a logo unless `photo` says it is somebody's face, which gets cropped instead of fitted. */
export type Bar = { key: string; name: string; value: number; share: number; detail?: string; icon?: string; photo?: boolean };

export type Award = { title: string; team: string; detail: string; logoUrl?: string };

/** The one person who burned the most tokens, with the comparisons that make the number land. */
export type Burner = {
  name: string;
  team: string;
  photoUrl?: string;
  tokens: number;
  /** Of every token of the weekend. */
  share: number;
  pushes: number;
  /** Times the runner-up's tokens; 0 when nobody else has any. */
  lead: number;
  /** How many of the quietest teams, added together, still burned less. */
  teamsOutburned: number;
};

export type ClosingSummary = {
  hero: { label: string; value: number }[];
  hours: number;
  timeline: {
    labels: string[];
    night: boolean[];
    tokens: number[];
    github: number[];
    nightShare: number;
  };
  usage: { tokens: number; requests: number; sessions: number; cachedShare: number };
  harnesses: Bar[];
  models: Bar[];
  stacks: { rows: Bar[]; total: number; auto: number };
  tracks: { rows: Bar[]; total: number };
  people: Bar[];
  burner: Burner | null;
  feed: ClosingData["totals"]["feed"];
  awards: Award[];
  generatedAt: number;
};

const compactFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const plainFormat = new Intl.NumberFormat("es-ES", { useGrouping: "always" });
const UNITS: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]];
/** Below this the exact number is as short as its compact form. */
const COMPACT_FROM = 10_000;

/** "1.234", "16,6 k", "456 k", "9,6 M", "13,9 B": three digits and a unit at most. */
export function figure(value: number): string {
  if (value < COMPACT_FROM) {
    return plainFormat.format(Math.round(value));
  }
  for (const [index, [size, suffix]] of UNITS.entries()) {
    if (value < size) {
      continue;
    }
    const scaled = value / size;
    const shown = scaled < 99.95 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
    const above = UNITS[index - 1];
    // 999.960 rounds up to a thousand of its unit: hand it to the next one.
    return shown >= 1000 && above ? `1 ${above[1]}` : `${compactFormat.format(shown)} ${suffix}`;
  }
  return plainFormat.format(Math.round(value));
}

export function percent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

const MODEL_ICONS: Record<string, string | undefined> = {
  claude: TECH_ICONS.Anthropic,
  gemini: TECH_ICONS.Gemini,
  gpt: TECH_ICONS.OpenAI,
  mistral: TECH_ICONS.Mistral,
};

function iconOf(icon: string | undefined): { icon?: string } {
  return icon ? { icon } : {};
}

/** Track labels carry the sponsor's name ("THEKER Robotics"); the symbols key on its slug. */
function trackIcon(label: string): string | undefined {
  const slug = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  return Object.entries(TRACK_SYMBOLS).find(([key]) => slug.startsWith(key))?.[1];
}

function bars(rows: Omit<Bar, "share">[], limit: number): Bar[] {
  const top = rows
    .filter((row) => row.value > 0)
    .toSorted((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = top[0]?.value ?? 0;
  return top.map((row) => ({ ...row, share: max > 0 ? row.value / max : 0 }));
}

function winner(scores: Map<string, number>): [string, number] | null {
  const [best] = [...scores].toSorted((a, b) => b[1] - a[1]);
  return best && best[1] > 0 ? best : null;
}

function add(scores: Map<string, number>, key: string, value: number): void {
  scores.set(key, (scores.get(key) ?? 0) + value);
}

export function summarize(data: ClosingData): ClosingSummary {
  const { insights, totals } = data;
  const { startsAt, endsAt } = insights.window;
  const buckets = insights.buckets;
  const scheduled = startsAt !== undefined && endsAt !== undefined && endsAt > startsAt;
  const bucketMs = scheduled ? (endsAt - startsAt) / buckets : 3_600_000;
  const origin = scheduled ? startsAt : 0;

  const tick = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: MADRID, weekday: "short" });
  const hourOf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: MADRID });
  const labels = Array.from({ length: buckets }, (_, bucket) => tick.format(origin + bucket * bucketMs));
  const night = Array.from({ length: buckets }, (_, bucket) =>
    scheduled ? Number(hourOf.format(origin + (bucket + 0.5) * bucketMs)) < NIGHT_ENDS_HOUR : false
  );

  const teamName = new Map(insights.teams.map((team) => [team.id, team.name]));
  const teamLogo = new Map(insights.teams.map((team) => [team.id, team.logoUrl]));
  const tokensPerBucket = Array.from({ length: buckets }, () => 0);
  const githubPerBucket = Array.from({ length: buckets }, () => 0);
  const perHarness = new Map<string, number>();
  const teamTokens = new Map<string, number>();
  const teamCached = new Map<string, number>();
  const teamNight = new Map<string, number>();
  const teamSprint = new Map<string, number>();
  const teamPushes = new Map<string, number>();
  const teamPulls = new Map<string, number>();
  let tokens = 0;
  let cached = 0;
  let requests = 0;
  let sessions = 0;
  const lastBucket = Math.max(...insights.samples.map((row) => row.bucket), 0);

  for (const row of insights.samples) {
    tokens += row.tokens;
    cached += row.cachedTokens;
    requests += row.requests;
    sessions += row.sessions;
    tokensPerBucket[row.bucket] = (tokensPerBucket[row.bucket] ?? 0) + row.tokens;
    add(perHarness, row.harness, row.tokens);
    if (!teamName.has(row.teamId)) {
      continue;
    }
    add(teamTokens, row.teamId, row.tokens);
    add(teamCached, row.teamId, row.cachedTokens);
    if (night[row.bucket]) {
      add(teamNight, row.teamId, row.tokens);
    }
    if (row.bucket > lastBucket - SPRINT_BUCKETS) {
      add(teamSprint, row.teamId, row.tokens);
    }
  }
  let pushes = 0;
  let pulls = 0;
  for (const row of insights.activity) {
    pushes += row.pushes;
    pulls += row.pullRequests;
    githubPerBucket[row.bucket] = (githubPerBucket[row.bucket] ?? 0) + row.pushes + row.pullRequests;
    if (teamName.has(row.teamId)) {
      add(teamPushes, row.teamId, row.pushes);
      add(teamPulls, row.teamId, row.pullRequests);
    }
  }

  const topTokens = winner(teamTokens);
  const cacheRates = new Map<string, number>();
  for (const [teamId, total] of teamTokens) {
    if (topTokens && total >= topTokens[1] * CACHE_AWARD_FLOOR) {
      cacheRates.set(teamId, (teamCached.get(teamId) ?? 0) / total);
    }
  }
  const award = (title: string, best: [string, number] | null, detail: (value: number) => string): Award[] =>
    best ? [{ detail: detail(best[1]), team: teamName.get(best[0]) ?? "", title, ...(teamLogo.get(best[0]) ? { logoUrl: teamLogo.get(best[0]) } : {}) }] : [];

  const byTokens = insights.people.filter((person) => person.tokens > 0).toSorted((a, b) => b.tokens - a.tokens);
  const [top, second] = byTokens;
  let teamsOutburned = 0;
  let quietest = 0;
  for (const value of [...teamTokens.values()].toSorted((a, b) => a - b)) {
    quietest += value;
    if (!top || quietest >= top.tokens) {
      break;
    }
    teamsOutburned += 1;
  }

  const nightTokens = tokensPerBucket.reduce((sum, value, bucket) => sum + (night[bucket] ? value : 0), 0);
  const harnessName = new Map<string, string>(HARNESSES.map((harness) => [harness.id, harness.name]));

  return {
    awards: [
      ...award("Quemadores de tokens", topTokens, (value) => `${figure(value)} tokens`),
      ...award("Máquina de commits", winner(teamPushes), (value) => `${figure(value)} pushes`),
      ...award("Reyes del pull request", winner(teamPulls), (value) => `${figure(value)} PRs`),
      ...award("Los búhos", winner(teamNight), (value) => `${figure(value)} tokens de madrugada`),
      ...award("Sprint final", winner(teamSprint), (value) => `${figure(value)} tokens en la recta final`),
      ...award("Maestros de la caché", winner(cacheRates), (value) => `${percent(value)} de tokens desde caché`),
    ],
    burner: top
      ? {
          lead: second ? top.tokens / second.tokens : 0,
          name: top.name,
          ...(top.photoUrl ? { photoUrl: top.photoUrl } : {}),
          pushes: top.pushes,
          share: tokens > 0 ? top.tokens / tokens : 0,
          team: top.team,
          teamsOutburned,
          tokens: top.tokens,
        }
      : null,
    feed: totals.feed,
    generatedAt: data.generatedAt,
    harnesses: bars(
      [...perHarness].map(([id, value]) => ({ detail: tokens > 0 ? percent(value / tokens) : "", ...iconOf(HARNESS_ICONS[id]), key: id, name: harnessName.get(id) ?? id, value })),
      6
    ),
    hero: [
      { label: "Asistentes", value: totals.people.checkedIn },
      { label: "Equipos", value: totals.teams },
      { label: "Proyectos entregados", value: totals.submissions.total },
      { label: "Tokens", value: tokens },
      { label: "Pushes a GitHub", value: pushes },
      { label: "Pull requests", value: pulls },
      { label: "Posts en el feed", value: totals.feed.posts },
      { label: "Memes", value: totals.feed.memes },
    ],
    hours: scheduled ? Math.round((endsAt - startsAt) / 3_600_000) : 0,
    models: bars(
      insights.models.map((model) => ({ detail: model.provider, ...iconOf(MODEL_ICONS[model.family]), key: model.name, name: model.name, value: model.tokens })),
      6
    ),
    people: bars(
      byTokens.map((person) => ({ detail: person.team, ...iconOf(person.photoUrl), key: person.id, name: person.name, photo: true, value: person.tokens })),
      7
    ),
    stacks: {
      auto: insights.stacks.auto,
      rows: bars(
        // "Otras" is the catalog's catch-all; on a slide it reads as noise.
        insights.stacks.rows.map((row) => ({ ...(row.category === "Otras" ? {} : { detail: row.category }), ...iconOf(TECH_ICONS[row.name]), key: row.name, name: row.name, value: row.count })),
        14
      ),
      total: insights.stacks.total,
    },
    timeline: {
      github: githubPerBucket,
      labels,
      night,
      nightShare: tokens > 0 ? nightTokens / tokens : 0,
      tokens: tokensPerBucket,
    },
    tracks: {
      rows: bars(
        totals.submissions.byTrack.map((track) => ({ ...iconOf(trackIcon(track.label)), key: track.label, name: track.label, value: track.count })),
        12
      ),
      total: totals.submissions.total,
    },
    usage: { cachedShare: tokens > 0 ? cached / tokens : 0, requests, sessions, tokens },
  };
}

/** Invented numbers for `?demo=1`, shaped like a real weekend: quiet night, loud finish. */
export function demoClosingData(): ClosingData {
  const startsAt = Date.parse("2026-09-19T11:00:00+02:00");
  const endsAt = Date.parse("2026-09-20T11:00:00+02:00");
  const buckets = 24;
  const teams = Array.from({ length: 12 }, (_, index) => ({
    id: `demo-${index}`,
    members: 3 + (index % 3),
    name: `Equipo ${String(index + 1).padStart(2, "0")}`,
    project: `Proyecto ${index + 1}`,
  }));
  const harnesses = ["claude-code", "cursor", "codex", "opencode", "copilot"];
  const samples: ClosingData["insights"]["samples"] = [];
  const activity: ClosingData["insights"]["activity"] = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const hour = (11 + bucket) % 24;
    let energy = 1;
    if (hour < 7) {
      energy = 0.25;
    } else if (bucket > 20) {
      energy = 1.6;
    }
    for (const [index, team] of teams.entries()) {
      const tokens = Math.round(energy * (900_000 + ((index * 37 + bucket * 53) % 17) * 140_000));
      samples.push({
        bucket,
        cachedTokens: Math.round(tokens * (0.5 + (index % 5) * 0.08)),
        harness: harnesses[(index + (bucket % 2)) % harnesses.length] ?? "claude-code",
        requests: Math.round(tokens / 30_000),
        sessions: bucket % 4 === 0 ? 1 + (index % 2) : 0,
        teamId: team.id,
        tokens,
      });
      activity.push({
        bucket,
        pullRequests: (index + bucket) % 5 === 0 ? 1 : 0,
        pushes: Math.round(energy * (1 + ((index + bucket) % 4))),
        teamId: team.id,
      });
    }
  }
  const stackNames = ["TypeScript", "React", "Next.js", "Tailwind CSS", "Python", "Convex", "FastAPI", "Supabase", "Vercel AI SDK", "PostgreSQL", "Bun", "Docker", "Astro", "Rust"];
  return {
    generatedAt: Date.now(),
    insights: {
      activity,
      buckets,
      generatedAt: Date.now(),
      models: [
        { family: "claude", name: "claude-opus-5", provider: "anthropic", requests: 5200, tokens: 210_000_000 },
        { family: "claude", name: "claude-sonnet-5", provider: "anthropic", requests: 4100, tokens: 140_000_000 },
        { family: "gpt", name: "gpt-5.2-codex", provider: "openai", requests: 2300, tokens: 66_000_000 },
        { family: "gemini", name: "gemini-3-pro", provider: "google", requests: 900, tokens: 21_000_000 },
        { family: "other", name: "kimi-k2", provider: "moonshot", requests: 300, tokens: 6_000_000 },
      ],
      // One anonymous handle far ahead of everybody, like the real thing.
      people: ["t0kenl0rd_99", "Ana García", "Pau Ferrer", "Irene Sanz", "Marc Soler", "Lucía Vidal", "Hugo Marín", "Noa Prats"].map((name, index) => ({
        id: `demo-person-${index}`,
        name,
        pullRequests: index % 3,
        pushes: index === 0 ? 4 : 20 + index * 9,
        team: teams[index]?.name ?? "",
        tokens: index === 0 ? 61_000_000 : Math.round(34_000_000 / index),
      })),
      samples,
      stacks: {
        auto: 9,
        rows: stackNames.map((name, index) => ({ category: index % 3 === 0 ? "lenguaje" : "framework", count: Math.max(1, 12 - index), name })),
        total: 12,
      },
      teams,
      usage: "ok",
      window: { endsAt, startsAt },
    },
    totals: {
      feed: {
        authors: 96,
        byHour: Array.from({ length: 24 }, (_, hour) => (hour < 7 ? 2 : 6 + ((hour * 7) % 11))),
        comments: 214,
        emojis: ["🔥", "😂", "🚀", "❤️", "👀", "🥲"].map((emoji, index) => ({ count: 120 - index * 17, emoji })),
        images: 88,
        memes: 47,
        posts: 263,
        reactions: 1180,
      },
      milestones: 31,
      people: { checkedIn: 342, inTeams: 318 },
      submissions: {
        byTrack: ["Maisa", "HappyRobot", "Prosper AI", "Embat", "THEKER Robotics"].map((label, index) => ({ count: 12 - index * 2 + (index % 2), label })),
        total: 12,
      },
      teams: 12,
    },
  };
}
