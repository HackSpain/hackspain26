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
export const TV_FONT_SIZES = [0.85, 1.1, 1.5, 2, 2.75] as const;
export type TvFontSize = (typeof TV_FONT_SIZES)[number];
export type TvFontWeight = "normal" | "medium" | "semibold" | "bold";

export const TV_FONT_SIZE_OPTIONS: readonly {
  value: TvFontSize;
  label: string;
}[] = [
  { value: 0.85, label: "Pequeño" },
  { value: 1.1, label: "Normal" },
  { value: 1.5, label: "Grande" },
  { value: 2, label: "Enorme" },
  { value: 2.75, label: "Titular" },
];

export const TV_FONT_WEIGHT_OPTIONS: readonly {
  value: TvFontWeight;
  label: string;
}[] = [
  { value: "normal", label: "Regular" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
];

const TV_FONT_SIZE_CLASS: Record<TvFontSize, string> = {
  0.85: "text-[clamp(0.7rem,1.6cqw,1.2rem)]",
  1.1: "text-[clamp(0.85rem,2.2cqw,1.75rem)]",
  1.5: "text-[clamp(0.9rem,2.6cqw,2rem)]",
  2: "text-[clamp(1rem,3.2cqw,3rem)]",
  2.75: "text-[clamp(1.1rem,4cqw,4.5rem)]",
};

const TV_KIND_SIZE_CLASS: Partial<Record<TvWidgetKind, string>> = {
  banner: "text-[clamp(1.1rem,4cqw,4.5rem)]",
  ticker: "text-[clamp(0.9rem,2.6cqw,2rem)]",
  clock: "text-[clamp(1.4rem,6cqw,5rem)]",
  message: "text-[clamp(0.85rem,2.2cqw,1.75rem)]",
};

const TV_FONT_WEIGHT_CLASS: Record<TvFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

export function isTvFontSize(value: number): value is TvFontSize {
  return (TV_FONT_SIZES as readonly number[]).includes(value);
}

export function isTvFontWeight(value: string): value is TvFontWeight {
  return (
    value === "normal" ||
    value === "medium" ||
    value === "semibold" ||
    value === "bold"
  );
}

export function defaultTvFontSize(kind: TvWidgetKind): TvFontSize {
  if (kind === "banner" || kind === "clock") {
    return 2.75;
  }
  if (kind === "ticker") {
    return 1.5;
  }
  return 1.1;
}

export function defaultTvFontWeight(): TvFontWeight {
  return "normal";
}

export function tvHasBackground(background?: boolean): boolean {
  return background !== false;
}

export function tvFontSizeClass(kind: TvWidgetKind, fontSize?: number): string {
  if (fontSize !== undefined && fontSize >= 8 && fontSize <= 240) {
    return "";
  }
  if (fontSize !== undefined && isTvFontSize(fontSize)) {
    return TV_FONT_SIZE_CLASS[fontSize];
  }
  return TV_KIND_SIZE_CLASS[kind] ?? TV_FONT_SIZE_CLASS[1.1];
}

// New sizes use pixels on a 1920px canvas. Legacy presets keep their rendering.
export function tvFontSizeStyle(fontSize?: number) {
  return fontSize !== undefined && Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 240
    ? { fontSize: `${fontSize / 19.2}cqw` }
    : undefined;
}

export function tvFontSizePixels(kind: TvWidgetKind, value?: number): number {
  if (value !== undefined && value >= 8) return value;
  const legacy: Record<number, number> = { 0.85: 19, 1.1: 28, 1.5: 32, 2: 48, 2.75: 72 };
  return value !== undefined ? legacy[value] ?? 28 : kind === "clock" ? 80 : kind === "banner" ? 72 : kind === "ticker" ? 32 : 28;
}

export function tvFontWeightClass(fontWeight?: TvFontWeight): string | undefined {
  return fontWeight ? TV_FONT_WEIGHT_CLASS[fontWeight] : undefined;
}

export type TvSponsor = {
  name: string;
  logoUrl: string;
  href: string;
  tier: TvSponsorTier;
};

export function sponsorSiteOrigin(href: string): string | null {
  const raw = href.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function sponsorLogoSources(sponsor: {
  logoUrl?: string;
  href?: string;
}): string[] {
  const custom = sponsor.logoUrl?.trim();
  if (custom) {
    return [custom];
  }
  const origin = sponsorSiteOrigin(sponsor.href ?? "");
  if (!origin) {
    return [];
  }
  return [`${origin}/logo.svg`, `${origin}/favicon.ico`];
}

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
  fontSize?: number;
  fontWeight?: TvFontWeight;
  background?: boolean;
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

export const TV_MIN_SIZE = 8;
export const TV_SNAP = 1;

export function clampTv(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function snapTv(value: number) {
  return Math.round(value / TV_SNAP) * TV_SNAP;
}

export function layoutTvBox(input: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const w = clampTv(input.w, TV_MIN_SIZE, 100);
  const h = clampTv(input.h, TV_MIN_SIZE, 100);
  return {
    x: clampTv(input.x, 0, 100 - w),
    y: clampTv(input.y, 0, 100 - h),
    w,
    h,
  };
}
