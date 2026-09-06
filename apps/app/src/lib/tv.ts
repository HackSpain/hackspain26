export const TV_WIDGET_KINDS = [
  "banner",
  "ticker",
  "clock",
  "message",
  "insightsStats",
  "insightsActivity",
  "insightsHarness",
  "insightsStacks",
  "insightsScatter",
  "insightsLeaderboard",
  "insightsEvolution",
  "liveCommits",
  "liveAgents",
  "liveTokens",
  "liveLeaderboard",
  "feed",
  "sponsorGrid",
  "sponsorTicker",
] as const;

export type TvWidgetKind = (typeof TV_WIDGET_KINDS)[number];

export type TvSponsorTier = "gold" | "silver" | "community";
export type TvTickerSpeed = "slow" | "normal" | "fast";
export type TvFeedMode = "latest" | "rotate";
export type TvFeedSource = "all" | "participants" | "github";

export type TvSponsor = {
  name: string;
  logoUrl: string;
  href: string;
  tier: TvSponsorTier;
};

export type TvWidget = {
  _id: string;
  kind: TvWidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  text: string;
  sponsors?: TvSponsor[];
  tickerSpeed?: TvTickerSpeed;
  feedMode?: TvFeedMode;
  feedSource?: TvFeedSource;
};

export const TV_TEXT_KINDS = new Set<TvWidgetKind>([
  "banner",
  "ticker",
  "message",
]);

export const TV_SPONSOR_KINDS = new Set<TvWidgetKind>([
  "sponsorGrid",
  "sponsorTicker",
]);

export const TV_FEED_KINDS = new Set<TvWidgetKind>(["feed"]);

export const TV_PALETTE: readonly {
  kind: TvWidgetKind;
  label: string;
  hint: string;
  group: "tv" | "insights" | "live" | "sponsors";
}[] = [
  { kind: "banner", label: "Banner", hint: "Titular grande", group: "tv" },
  { kind: "ticker", label: "Ticker", hint: "Cinta en movimiento", group: "tv" },
  { kind: "clock", label: "Reloj", hint: "Hora en vivo", group: "tv" },
  { kind: "message", label: "Mensaje", hint: "Tarjeta de aviso", group: "tv" },
  {
    kind: "insightsStats",
    label: "Cifras",
    hint: "Tokens, commits, PRs",
    group: "insights",
  },
  {
    kind: "insightsActivity",
    label: "Actividad",
    hint: "Gráfico del evento",
    group: "insights",
  },
  {
    kind: "insightsHarness",
    label: "Harnesses",
    hint: "Cuota por herramienta",
    group: "insights",
  },
  {
    kind: "insightsStacks",
    label: "Stacks",
    hint: "Tecnologías declaradas",
    group: "insights",
  },
  {
    kind: "insightsScatter",
    label: "Tokens vs commits",
    hint: "Dispersión por equipo",
    group: "insights",
  },
  {
    kind: "insightsLeaderboard",
    label: "Leaderboard",
    hint: "Clasificación",
    group: "insights",
  },
  {
    kind: "insightsEvolution",
    label: "Evolución",
    hint: "Consumo por fase",
    group: "insights",
  },
  {
    kind: "liveCommits",
    label: "Commits en vivo",
    hint: "Stream de GitHub",
    group: "live",
  },
  {
    kind: "liveAgents",
    label: "Agentes activos",
    hint: "Harnesses en pulso",
    group: "live",
  },
  {
    kind: "liveTokens",
    label: "Tokens",
    hint: "Contador + sparkline",
    group: "live",
  },
  {
    kind: "liveLeaderboard",
    label: "Equipos",
    hint: "Clasificación animada",
    group: "live",
  },
  {
    kind: "feed",
    label: "Feed",
    hint: "Publicaciones de los participantes",
    group: "live",
  },
  {
    kind: "sponsorGrid",
    label: "Sponsors",
    hint: "Rejilla de logos",
    group: "sponsors",
  },
  {
    kind: "sponsorTicker",
    label: "Ticker sponsors",
    hint: "Marquesina",
    group: "sponsors",
  },
];

export const TICKER_DURATION: Record<TvTickerSpeed, string> = {
  slow: "40s",
  normal: "24s",
  fast: "12s",
};
