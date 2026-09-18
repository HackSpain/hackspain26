import type { Infer } from "convex/values";
import type {
  tvFeedModeValidator,
  tvFeedSourceValidator,
  tvFontWeightValidator,
  tvSponsorValidator,
  tvTickerSpeedValidator,
  tvWidgetKindValidator,
  tvWidgetValidator,
} from "@convex/lib/tvValidators";

export { layoutTvBox } from "../../convex/lib/tvLayout";

export type TvWidgetKind = Infer<typeof tvWidgetKindValidator>;
export type TvSponsor = Infer<typeof tvSponsorValidator>;
export type TvSponsorTier = TvSponsor["tier"];
export type TvTickerSpeed = Infer<typeof tvTickerSpeedValidator>;
export type TvFeedMode = Infer<typeof tvFeedModeValidator>;
export type TvFeedSource = Infer<typeof tvFeedSourceValidator>;
export const TV_FONT_SIZES = [0.85, 1.1, 1.5, 2, 2.75] as const;
export type TvFontSize = (typeof TV_FONT_SIZES)[number];
export type TvFontWeight = Infer<typeof tvFontWeightValidator>;

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

const DEFAULT_TV_SPONSORS: TvSponsor[] = [
  { name: "Cursor", logoUrl: "/sponsors/cursor.svg", href: "https://cursor.com", tier: "gold" },
  { name: "fal.ai", logoUrl: "/sponsors/fal.svg", href: "https://fal.ai", tier: "gold" },
  { name: "Cognition", logoUrl: "/sponsors/cognition.svg", href: "https://cognition.ai", tier: "gold" },
  { name: "HappyRobot", logoUrl: "/sponsors/happyrobot.png", href: "https://www.happyrobot.ai", tier: "gold" },
  { name: "Exa", logoUrl: "/sponsors/exa.svg", href: "https://exa.ai", tier: "silver" },
  { name: "Convex", logoUrl: "/sponsors/convex.svg", href: "https://www.convex.dev", tier: "silver" },
  { name: "Vercel", logoUrl: "/sponsors/vercel.svg", href: "https://vercel.com", tier: "silver" },
  { name: "QuiverAI", logoUrl: "/sponsors/quiver_ai.svg", href: "https://quiver.ai", tier: "silver" },
  { name: "Cloudflare", logoUrl: "/sponsors/cloudflare.svg", href: "https://www.cloudflare.com", tier: "silver" },
  { name: "Tinybird", logoUrl: "/sponsors/tinybird.svg", href: "https://www.tinybird.co", tier: "silver" },
  { name: "Helmcode", logoUrl: "/sponsors/helmcode.svg", href: "https://helmcode.com", tier: "silver" },
  { name: "OneCoWork", logoUrl: "/sponsors/onecowork.svg", href: "https://www.onecowork.com", tier: "community" },
  { name: "Embat", logoUrl: "/sponsors/embat.png", href: "https://www.embat.io", tier: "gold" },
  { name: "THEKER", logoUrl: "/sponsors/theker.svg", href: "https://www.theker.ai", tier: "gold" },
  { name: "Prosper AI", logoUrl: "/sponsors/prosper_ai.svg", href: "https://www.getprosper.ai", tier: "gold" },
  { name: "Maisa", logoUrl: "/sponsors/maisa.png", href: "https://maisa.ai", tier: "gold" },
];

export function resolveTvSponsors(sponsors?: TvSponsor[]): TvSponsor[] {
  const custom = (sponsors ?? []).filter((row) => row.name.trim());
  return custom.length > 0 ? custom : DEFAULT_TV_SPONSORS;
}

export function usingDefaultTvSponsors(sponsors?: TvSponsor[]): boolean {
  return (sponsors ?? []).every((row) => !row.name.trim());
}

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

export type TvWidget = Infer<typeof tvWidgetValidator> & { _id: string };

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
