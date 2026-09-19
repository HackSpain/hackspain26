"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { api } from "@convex/_generated/api";
import { compact, harnessRows, number, percent, timeLabel } from "@/app/insights/mock-data";
import { useLiveInsights } from "@/app/insights/use-live-insights";
import type { LiveInsightData } from "@/app/insights/use-live-insights";
import { HARNESS_ICONS, TECH_ICONS } from "@/lib/tv-icons";
import {
  MARKET_BUCKETS, currentBucket, demoFeed, demoInsights, marketPeople, marketSeries, marketSides, marketTeams, marketTotals,
} from "@/lib/tv-market";
import type { MarketPeopleMetric, MarketPerson, MarketPost, MarketSeries, MarketSide, MarketTeam } from "@/lib/tv-market";
import { cn } from "@/lib/utils";
import { FeedDemoContext } from "./feed-box";
import type { FeedPost } from "./feed-box";
import {
  FLASH_LAYER_CLASS, flashGold, gsap, settle, TV_EASE_OUT, TV_EASE_POP, TV_REDUCED_FADE,
  useBarScale, useCountUp, useGSAP, useHistoryScroll, useRankRows, useStreamShift,
} from "./gsap";
import { LiveCommitPulseBox } from "./live-boxes";
import { Empty, Face, Move, SponsorStrip, StageHeader, TeamTape, ago } from "./market";
import { MilestoneBroadcast } from "./milestone-broadcast";
import { useClock, usePrefersReducedMotion, useTick } from "./motion";

const SLIDE_MS = 12_000;
const HISTORY_MS = 6500;
const SIDE_MS = 10_000;
const RANKING_ROWS = 7;
const FEED_ROWS = 6;
const PEOPLE_ROWS = 8;

type Post = MarketPost & { repo?: string; sha?: string };
type Feed = { posts: Post[] | undefined; commits: Post[] | undefined };

/* ------------------------------------------------------------------ */
/* Sparkline that draws itself once and then morphs between updates.   */

function sparkPoints(values: number[]) {
  const max = Math.max(...values, 1);
  return values.length > 1
    ? values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - (value / max) * 26}`).join(" ")
    : "0,28 100,28";
}

function LiveSpark({ values }: { values: number[] }) {
  const reduced = usePrefersReducedMotion();
  const line = useRef<SVGPolylineElement>(null);
  const points = sparkPoints(values);
  const drawn = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = line.current;
    if (!el) {return;}
    const before = drawn.current;
    drawn.current = points;
    if (reduced) {
      el.setAttribute("points", points);
      return;
    }
    if (before === null) {
      el.setAttribute("points", points);
      const length = el.getTotalLength();
      const tween = gsap.fromTo(
        el,
        { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, duration: 1.4, ease: TV_EASE_OUT, delay: 0.6, clearProps: "strokeDasharray,strokeDashoffset" },
      );
      return () => {
        settle(tween);
      };
    }
    if (before.split(" ").length !== points.split(" ").length) {
      el.setAttribute("points", points);
      return;
    }
    const tween = gsap.to(el, { attr: { points }, duration: 0.9, ease: TV_EASE_OUT, overwrite: "auto" });
    return () => {
      settle(tween);
    };
  }, [points, reduced]);

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden className="h-full w-full overflow-visible">
      <polyline ref={line} points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards: count-up figures, a paper sweep and a kick on every jump. */

function KpiCard({ label, value, format, recent, trend, tone, shake }: {
  label: string; value: number; format: (value: number) => string; recent: number; trend: number[]; tone: string; shake?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const figure = useCountUp(value, format, { duration: 1.2 });
  const recentRef = useCountUp<HTMLParagraphElement>(recent, (v) => `+${format(v)} este tramo`);
  const sweep = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = value;
    const el = figure.current;
    if (before === null || reduced || value <= before || !el) {return;}
    const random = gsap.utils.random;
    const timeline = gsap.timeline();
    if (sweep.current) {
      timeline.fromTo(
        sweep.current,
        { xPercent: -130, opacity: 0.55 },
        { xPercent: 130, opacity: 0, duration: 0.9, ease: TV_EASE_OUT },
        0,
      );
    }
    if (shake) {
      timeline.to(
        el,
        {
          keyframes: [
            ...Array.from({ length: 5 }, () => ({ x: random(-6, 6), y: random(-3, 3), rotation: random(-1.5, 1.5), duration: 0.045 })),
            { x: 0, y: 0, rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.35)" },
          ],
        },
        0,
      );
    }
    timeline.fromTo(el, { scale: 1.06 }, { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.4)", transformOrigin: "0% 50%" }, 0.05);
    return () => {
      settle(timeline);
    };
  }, [value, reduced, shake, figure]);

  return (
    <div data-v2 className={cn("relative flex min-w-0 flex-col justify-between gap-[calc(var(--u)*0.4)] overflow-hidden p-[calc(var(--u)*1.1)]", tone)}>
      <span ref={sweep} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-hs-paper to-transparent opacity-0" />
      <p className="hsx-label">{label}</p>
      <p className="hsx-title hsx-2xl whitespace-nowrap"><span ref={figure} className="hsx-num inline-block">{format(value)}</span></p>
      <div className="h-[calc(var(--u)*2.2)]"><LiveSpark values={trend} /></div>
      <p ref={recentRef} className="hsx-num hsx-sm truncate border-t-[length:var(--line)] border-current/30 pt-[calc(var(--u)*0.5)] font-semibold">
        +{format(recent)} este tramo
      </p>
    </div>
  );
}

function Kpis({ series }: { series: MarketSeries }) {
  const totals = marketTotals(series);
  const last = series.at(-1);
  const trend = (metric: keyof MarketSeries[number]) => series.map((row) => row[metric]);
  const cards = [
    { label: "Tokens procesados", value: totals.tokens, format: compact, recent: last?.tokens ?? 0, trend: trend("tokens"), tone: "bg-hs-gold text-hs-ink", shake: true },
    { label: "Pushes a GitHub", value: totals.pushes, format: number, recent: last?.pushes ?? 0, trend: trend("pushes"), tone: "bg-hs-orange text-hs-paper" },
    { label: "Sesiones de agentes", value: totals.sessions, format: number, recent: last?.sessions ?? 0, trend: trend("sessions"), tone: "bg-hs-teal text-hs-paper" },
    { label: "Pull requests", value: totals.pullRequests, format: number, recent: last?.pullRequests ?? 0, trend: trend("pullRequests"), tone: "bg-hs-navy text-hs-paper" },
  ].filter((card) => card.value > 0);
  if (cards.length === 0) {return null;}
  return (
    <div className={cn(
      "grid shrink-0 gap-[var(--line)]",
      cards.length === 1 && "grid-cols-1",
      cards.length === 2 && "grid-cols-2",
      cards.length === 3 && "grid-cols-3",
      cards.length === 4 && "grid-cols-4",
    )}>
      {cards.map((card) => <KpiCard key={card.label} {...card} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board slides.                                                        */

function PulseSlide({ series, data }: { series: MarketSeries; data: LiveInsightData }) {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPolylineElement>(null);
  const area = useRef<SVGPolygonElement>(null);
  const cumulative: number[] = [];
  for (const row of series) {cumulative.push((cumulative.at(-1) ?? 0) + row.tokens);}
  const running = cumulative.at(-1) ?? 0;
  const peak = Math.max(...series.map((row) => row.tokens), 1);
  const x = (bucket: number) => ((bucket + 0.5) / MARKET_BUCKETS) * 1000;
  const y = (value: number) => 250 - (value / Math.max(running, 1)) * 235;
  const linePoints = cumulative.map((value, bucket) => `${x(bucket)},${y(value)}`).join(" ");
  const head = cumulative.length - 1;
  const areaPoints = `${x(0)},250 ${linePoints} ${x(head)},250`;
  const drawn = useRef<string | null>(null);
  const timeline = { bucketMinutes: data.bucketMinutes, startsAt: data.startsAt };

  useLayoutEffect(() => {
    const lineEl = line.current;
    const areaEl = area.current;
    const stage = root.current;
    if (!lineEl || !areaEl || !stage) {return;}
    const before = drawn.current;
    drawn.current = linePoints;
    const bars = stage.querySelectorAll<SVGRectElement>("[data-bar]");
    const now = stage.querySelector<HTMLElement>("[data-now]");
    if (reduced) {
      lineEl.setAttribute("points", linePoints);
      areaEl.setAttribute("points", areaPoints);
      return;
    }
    if (before === null) {
      lineEl.setAttribute("points", linePoints);
      areaEl.setAttribute("points", areaPoints);
      const length = lineEl.getTotalLength();
      const tl = gsap.timeline({ defaults: { ease: TV_EASE_OUT } });
      tl.fromTo(bars, { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.7, stagger: 0.03 }, 0.1);
      tl.fromTo(lineEl, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.6, clearProps: "strokeDasharray,strokeDashoffset" }, 0.2);
      tl.fromTo(areaEl, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.1);
      if (now) {tl.fromTo(now, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: TV_EASE_POP }, 1.5);}
      return () => {
        settle(tl);
      };
    }
    if (before.split(" ").length !== linePoints.split(" ").length) {
      lineEl.setAttribute("points", linePoints);
      areaEl.setAttribute("points", areaPoints);
      return;
    }
    const tl = gsap.timeline({ defaults: { duration: 0.9, ease: TV_EASE_OUT, overwrite: "auto" } });
    tl.to(lineEl, { attr: { points: linePoints } }, 0);
    tl.to(areaEl, { attr: { points: areaPoints } }, 0);
    if (now) {tl.fromTo(now, { scale: 1.25 }, { scale: 1, duration: 0.6, ease: TV_EASE_POP }, 0);}
    return () => {
      settle(tl);
    };
  }, [linePoints, areaPoints, reduced]);

  if (!series.some((row) => row.tokens > 0)) {return <Empty>Sin consumo registrado todavía</Empty>;}
  return (
    <div ref={root} className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((step) => <line key={step} x1="0" x2="1000" y1={y(running * step)} y2={y(running * step)} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />)}
          <polygon ref={area} points={areaPoints} fill="var(--color-hs-orange)" fillOpacity="0.16" />
          <polyline ref={line} points={linePoints} fill="none" stroke="var(--color-hs-orange)" strokeWidth="3.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={x(head)} x2={x(head)} y1="0" y2="400" stroke="var(--color-hs-ink)" strokeOpacity="0.55" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          {series.map((row, bucket) => {
            const height = (row.tokens / peak) * 120;
            return <rect key={bucket} data-bar x={x(bucket) - 14} width="28" y={400 - height} height={height} fill={bucket === head ? "var(--color-hs-gold)" : "var(--color-hs-teal)"} stroke="var(--color-hs-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ transition: "y 0.9s, height 0.9s" }} />;
          })}
        </svg>
        <p className="hsx-num hsx-sm absolute top-0 left-0 font-semibold text-hs-brown">{compact(running)} acumulados</p>
        <p className="hsx-label absolute bottom-[31%] left-0">Tokens por tramo</p>
        <p data-now className="hsx-num hsx-sm absolute -translate-x-1/2 bg-hs-ink px-[calc(var(--u)*0.5)] font-bold text-hs-gold" style={{ left: `${x(head) / 10}%`, top: `${Math.max(0, y(running) / 4 - 9)}%` }}>AHORA</p>
      </div>
      <div className="hsx-num hsx-xs relative mt-[calc(var(--u)*0.5)] h-[calc(var(--u)*1.2)] shrink-0 text-hs-brown">
        {[0, 4, 8, 12, 16, 20].map((bucket) => <span key={bucket} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(bucket) / 10}%` }}>{timeLabel(bucket, timeline)}</span>)}
      </div>
    </div>
  );
}

const RANKING_GRID = "grid grid-cols-[2.4em_3.2em_minmax(0,1fr)_8em_6em_7.5em_4.4em_3.2em] items-center whitespace-nowrap gap-x-[calc(var(--u)*1.1)]";

function RankingRow({ team, rows, rowRef }: { team: MarketTeam; rows: number; rowRef: (node: HTMLElement | null) => void }) {
  const reduced = usePrefersReducedMotion();
  const tokens = useCountUp(team.tokens, compact);
  const flash = useRef<HTMLSpanElement>(null);
  const previousRank = useRef(team.rank);

  useLayoutEffect(() => {
    const before = previousRank.current;
    previousRank.current = team.rank;
    if (reduced || team.rank >= before || !flash.current) {return;}
    const tween = flashGold(flash.current, 1.6);
    return () => {
      if (tween) {settle(tween);}
    };
  }, [team.rank, reduced]);

  return (
    <li ref={rowRef} className={cn(RANKING_GRID, "absolute inset-x-0 top-0 border-b border-hs-ink/15")} style={{ height: `${100 / rows}%` }}>
      <span ref={flash} data-flash aria-hidden className={FLASH_LAYER_CLASS} />
      <span className={cn("hsx-title hsx-num flex aspect-square items-center justify-center", team.rank === 1 ? "bg-hs-gold" : team.rank <= 3 ? "bg-hs-sand" : "text-hs-brown")}>{team.rank}</span>
      <Move move={team.move} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-bold">{team.name}</span>
        {team.project ? <span className="hsx-xs block truncate text-hs-brown">{team.project}</span> : null}
      </span>
      <span className={cn("h-[calc(var(--u)*1.7)]", team.move < 0 ? "text-[var(--hsx-down)]" : "text-[var(--hsx-up)]")}><LiveSpark values={team.trend} /></span>
      <span ref={tokens} className="hsx-num text-right font-bold">{compact(team.tokens)}</span>
      <span className="hsx-num text-right font-semibold text-[var(--hsx-up)]">{team.recent > 0 ? `+${compact(team.recent)}` : "·"}</span>
      <span className="hsx-num text-right text-hs-brown">{number(team.pushes)}</span>
      <span className="hsx-num text-right text-hs-brown">{number(team.pullRequests)}</span>
    </li>
  );
}

function RankingSlide({ teams, page }: { teams: MarketTeam[]; page: number }) {
  const rows = useMemo(() => teams.slice(page * RANKING_ROWS, (page + 1) * RANKING_ROWS), [teams, page]);
  const order = useMemo(() => rows.map((team) => team.id), [rows]);
  const register = useRankRows(order, { epoch: page });
  if (!rows.length) {return <Empty>Sin equipos en el tablero todavía</Empty>;}
  return (
    <div className="hsx-md flex h-full flex-col">
      <div className={cn(RANKING_GRID, "hsx-label shrink-0 border-b-[length:var(--line)] border-hs-ink pb-[calc(var(--u)*0.5)]")}>
        <span>#</span><span>Mov.</span><span>Equipo</span><span>Evolución</span>
        <span className="text-right">Tokens</span><span className="text-right">Este tramo</span><span className="text-right">Pushes</span><span className="text-right">PR</span>
      </div>
      <ol className="relative min-h-0 flex-1">
        {rows.map((team) => <RankingRow key={team.id} team={team} rows={RANKING_ROWS} rowRef={register(team.id)} />)}
      </ol>
    </div>
  );
}

type BarRow = { key: string; name: string; detail: string; share: number; value: string; color: string; icon?: string; mark?: string };

function BarRowView({ row }: { row: BarRow }) {
  const reduced = usePrefersReducedMotion();
  const bar = useBarScale(row.share);
  const shine = useRef<HTMLSpanElement>(null);
  const previous = useRef(row.share);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = row.share;
    if (reduced || row.share <= before || !shine.current) {return;}
    const tween = gsap.fromTo(shine.current, { xPercent: -120, opacity: 0.85 }, { xPercent: 120, opacity: 0, duration: 0.9, ease: TV_EASE_OUT });
    return () => {
      settle(tween);
    };
  }, [row.share, reduced]);

  return (
    <li data-row className="flex min-w-0 items-center gap-[calc(var(--u)*0.9)]">
      <Face name={row.name} src={row.icon} mark={row.mark} logo className="h-[calc(var(--u)*2.6)]" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[calc(var(--u)*0.4)]">
        <div className="flex items-baseline justify-between gap-[calc(var(--u)*0.8)]">
          <span className="truncate font-bold">{row.name}<span className="hsx-xs ml-[calc(var(--u)*0.6)] font-normal text-hs-brown">{row.detail}</span></span>
          <span className="hsx-num shrink-0 font-semibold">{row.value}</span>
        </div>
        <div className="h-[calc(var(--u)*0.7)] border-[length:calc(var(--line)*0.5)] border-hs-ink bg-hs-sand">
          <div ref={bar} className="relative h-full origin-left overflow-hidden" style={{ backgroundColor: row.color, transform: "scaleX(0)" }}>
            <span ref={shine} aria-hidden className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-hs-paper to-transparent opacity-0" />
          </div>
        </div>
      </div>
    </li>
  );
}

function Bars({ rows }: { rows: BarRow[] }) {
  return (
    <ol className="hsx-md grid h-full grid-flow-col grid-cols-2 gap-x-[calc(var(--u)*2.4)]" style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(rows.length / 2))}, minmax(0, 1fr))` }}>
      {rows.map((row) => <BarRowView key={row.key} row={row} />)}
    </ol>
  );
}

const STACK_COLORS = ["#1e3958", "#35858a", "#d96b2a", "#cc291f", "#eab619"];
const FAMILY_COLORS: Record<string, string> = { claude: "#d96b2a", gpt: "#35858a", gemini: "#1e3958", qwen: "#8b6b9f" };

type Slide =
  | { kind: "pulso" } | { kind: "herramientas" } | { kind: "modelos" } | { kind: "stacks" }
  | { kind: "ranking"; page: number; pages: number };

function buildSlides(teamCount: number): Slide[] {
  const pages = Math.max(1, Math.ceil(teamCount / RANKING_ROWS));
  const charts: Slide[] = [{ kind: "pulso" }, { kind: "herramientas" }, { kind: "modelos" }, { kind: "stacks" }];
  const slides: Slide[] = [];
  for (let page = 0; page < Math.max(pages, charts.length); page += 1) {
    const chart = charts[page];
    if (chart) {slides.push(chart);}
    if (page < pages) {slides.push({ kind: "ranking", page, pages });}
  }
  return slides;
}

function slideKey(slide: Slide) {
  return slide.kind === "ranking" ? `ranking-${slide.page}` : slide.kind;
}

function Board({ data, series, teams }: { data: LiveInsightData; series: MarketSeries; teams: MarketTeam[] }) {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(SLIDE_MS);
  const slides = useMemo(() => buildSlides(teams.length), [teams.length]);
  const target: Slide = slides[tick % slides.length] ?? { kind: "pulso" };
  const [shown, setShown] = useState<Slide>(target);
  const stage = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const targetKey = slideKey(target);
  const shownKey = slideKey(shown);

  // Exit the current slide, then swap; the entrance plays when `shown` lands.
  useEffect(() => {
    if (targetKey === shownKey) {return;}
    const el = stage.current;
    if (reduced || !el) {
      setShown(target);
      return;
    }
    const tween = gsap.to(el, {
      clipPath: "inset(0% 0% 0% 100%)",
      x: -18,
      duration: 0.38,
      ease: "power3.in",
      onComplete: () => setShown(target),
    });
    return () => {
      tween.kill();
    };
  }, [targetKey, shownKey, target, reduced]);

  useGSAP(
    () => {
      const el = stage.current;
      if (!el) {return;}
      if (reduced) {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: TV_REDUCED_FADE, ease: "none", clearProps: "opacity" });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(
        el,
        { clipPath: "inset(0% 100% 0% 0%)", x: 24 },
        { clipPath: "inset(0% 0% 0% 0%)", x: 0, duration: 0.7, ease: TV_EASE_OUT, clearProps: "clipPath,transform" },
      );
      const rows = el.querySelectorAll("[data-row]");
      if (rows.length) {
        tl.fromTo(rows, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.05, ease: TV_EASE_OUT, clearProps: "opacity,transform" }, 0.15);
      }
    },
    { dependencies: [shownKey, reduced] },
  );

  useGSAP(
    () => {
      if (!progress.current) {return;}
      gsap.fromTo(progress.current, { scaleX: 0 }, { scaleX: 1, duration: SLIDE_MS / 1000, ease: "none", transformOrigin: "0% 50%" });
    },
    { dependencies: [tick] },
  );

  const tools = harnessRows(data.samples).filter((row) => row.tokens > 0).toSorted((a, b) => b.tokens - a.tokens);
  const toolTokens = tools.reduce((sum, row) => sum + row.tokens, 0);
  const models = data.models.filter((row) => row.tokens > 0).toSorted((a, b) => b.tokens - a.tokens).slice(0, 10);
  const modelTokens = models.reduce((sum, row) => sum + row.tokens, 0);
  const stacks = data.stacks.rows.slice(0, 12);
  const { cachedTokens: cached, tokens } = marketTotals(series);
  const heading: Record<Slide["kind"], [title: string, detail: string]> = {
    herramientas: ["Herramientas de IA", "Cuota de tokens · sesiones"],
    modelos: ["Modelos en uso", `${models.length} modelos · cuota de tokens`],
    pulso: ["El pulso del evento", `Tokens acumulados y por tramo · ${percent(cached, tokens)} desde caché`],
    ranking: ["Clasificación de equipos", shown.kind === "ranking" ? `Por tokens · página ${shown.page + 1} de ${shown.pages}` : ""],
    stacks: ["Con qué construimos", `${data.stacks.auto} de ${data.stacks.total} stacks detectados desde GitHub`],
  };
  const [title, detail] = heading[shown.kind];
  const active = tick % slides.length;

  return (
    <section data-v2 className="flex min-h-0 flex-1 flex-col bg-hs-paper text-hs-ink">
      <header className="flex shrink-0 items-center justify-between gap-[calc(var(--u)*1.5)] border-b-[length:var(--line)] border-hs-ink px-[calc(var(--u)*1.3)] py-[calc(var(--u)*0.8)]">
        <div className="flex min-w-0 items-baseline gap-[calc(var(--u)*1.1)]">
          <h2 className="hsx-title hsx-lg shrink-0">{title}</h2>
          <p className="hsx-label truncate">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-[calc(var(--u)*0.35)]" aria-hidden>
          {slides.map((item, index) => (
            <span key={`${slideKey(item)}-${index}`} className="h-[calc(var(--u)*0.5)] w-[calc(var(--u)*1.8)] overflow-hidden bg-hs-ink/15">
              {index === active ? <span ref={progress} className="block h-full origin-left bg-hs-orange" /> : null}
            </span>
          ))}
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden p-[calc(var(--u)*1.3)]">
        <div ref={stage} key={shownKey} className="h-full">
          {shown.kind === "pulso" ? <PulseSlide series={series} data={data} /> : null}
          {shown.kind === "ranking" ? <RankingSlide teams={teams} page={shown.page} /> : null}
          {shown.kind === "herramientas" ? (tools.length ? <Bars rows={tools.map((row) => ({
            color: row.color, detail: `${number(row.sessions)} sesiones · ${row.teams} equipos`, icon: HARNESS_ICONS[row.id], key: row.id, mark: row.mark, name: row.name,
            share: row.tokens / Math.max(tools[0]?.tokens ?? 1, 1), value: percent(row.tokens, toolTokens),
          }))} /> : <Empty>Sin herramientas en uso todavía</Empty>) : null}
          {shown.kind === "modelos" ? (models.length ? <Bars rows={models.map((row) => ({
            color: FAMILY_COLORS[row.family] ?? "#8a7a6a", detail: `${number(row.requests)} peticiones`, key: row.name, name: row.name,
            share: row.tokens / Math.max(models[0]?.tokens ?? 1, 1), value: `${compact(row.tokens)} · ${percent(row.tokens, modelTokens)}`,
          }))} /> : <Empty>Sin modelos registrados todavía</Empty>) : null}
          {shown.kind === "stacks" ? (stacks.length ? <Bars rows={stacks.map((row, index) => ({
            color: STACK_COLORS[index % STACK_COLORS.length] ?? "#eab619", detail: row.category, icon: TECH_ICONS[row.name], key: row.name, name: row.name,
            share: row.count / Math.max(stacks[0]?.count ?? 1, 1), value: `${row.count} / ${data.stacks.total}`,
          }))} /> : <Empty>Sin tecnologías detectadas todavía</Empty>) : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feed: v1 cards, GSAP stream shift, history walk and SHA scramble.    */

function FeedCard({ post, now }: { post: Post; now: number | undefined }) {
  const git = post.kind === "github";
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-[calc(var(--u)*0.35)] bg-hs-paper px-[calc(var(--u)*1.3)] text-hs-ink">
      <p className="hsx-sm flex items-center gap-[calc(var(--u)*0.6)]">
        <span className={cn("hsx-num hsx-xs px-[calc(var(--u)*0.45)] py-[calc(var(--u)*0.1)] font-bold text-hs-paper", git ? "bg-hs-navy" : "bg-hs-orange")}>{git ? "GIT" : "POST"}</span>
        <span className="truncate font-bold">{post.authorName}</span>
        {post.teamName ? <span className="truncate text-hs-brown">{post.teamName}</span> : null}
        {git && post.sha ? <span data-sha={post.sha} className="hsx-num hsx-xs font-mono text-hs-brown">{post.sha}</span> : null}
        <span className="hsx-num hsx-xs ml-auto shrink-0 text-hs-brown">{now ? ago(now, post.createdAt) : ""}</span>
      </p>
      <p className="line-clamp-2 text-[length:calc(var(--u)*1.3)] leading-snug break-words">{post.text}</p>
    </div>
  );
}

function FeedRows({ posts, waiting }: { posts: Post[]; waiting: boolean }) {
  const minute = useClock();
  const listRef = useRef<HTMLOListElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => posts.map((post) => post._id), [posts]);
  const onEnter = useCallback((rows: HTMLElement[]) => {
    flashGold(rows, 1.8);
    for (const row of rows) {
      const sha = row.querySelector<HTMLElement>("[data-sha]");
      if (!sha?.dataset.sha) {continue;}
      gsap.to(sha, { duration: 0.9, scrambleText: { text: sha.dataset.sha, chars: "0123456789abcdef", speed: 0.5 } });
    }
  }, []);
  useStreamShift(listRef, ids, onEnter);
  useHistoryScroll({ list: listRef, scroller, viewport }, ids.join("|"), useTick(HISTORY_MS));

  // Rows split the viewport into FEED_ROWS equal cells (like the v1 grid) but
  // keep natural flow so the history walk can scroll through the rest.
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = viewport.current;
    const list = listRef.current;
    if (!box || !list) {return;}
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
      setRowHeight((box.clientHeight - gap * (FEED_ROWS - 1)) / FEED_ROWS);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [posts.length]);

  if (posts.length === 0) {
    return <div className="h-full bg-hs-paper text-hs-ink"><Empty>{waiting ? "Cargando actividad" : "La actividad aparecerá aquí"}</Empty></div>;
  }
  return (
    <div ref={viewport} className="h-full overflow-hidden">
      <div ref={scroller}>
        <ol ref={listRef} className="relative flex flex-col gap-[var(--line)]">
          {posts.map((post) => (
            <li key={post._id} className="relative shrink-0 overflow-hidden" style={{ height: rowHeight ?? `calc(100% / ${FEED_ROWS})` }}>
              <span data-flash aria-hidden className={FLASH_LAYER_CLASS} />
              <FeedCard post={post} now={minute?.getTime()} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const PEOPLE_GRID = "grid grid-cols-[calc(var(--u)*2.4)_minmax(0,1fr)_calc(var(--u)*4.6)_calc(var(--u)*3.6)_calc(var(--u)*2)] items-center whitespace-nowrap gap-x-[calc(var(--u)*0.9)]";

function PersonRow({ person, index, metric, rows, rowRef }: {
  person: MarketPerson; index: number; metric: MarketPeopleMetric; rows: number; rowRef: (node: HTMLElement | null) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const tokens = useCountUp(person.tokens, compact);
  const pushes = useCountUp(person.pushes, number);
  const flash = useRef<HTMLSpanElement>(null);
  const previous = useRef(index);
  const lead = (on: boolean) => (on ? "font-bold" : "text-hs-brown");

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = index;
    if (reduced || index >= before || !flash.current) {return;}
    const tween = flashGold(flash.current, 1.6);
    return () => {
      if (tween) {settle(tween);}
    };
  }, [index, reduced]);

  return (
    <li ref={rowRef} className={cn(PEOPLE_GRID, "absolute inset-x-0 top-0 border-b border-hs-ink/15")} style={{ height: `${100 / rows}%` }}>
      <span ref={flash} data-flash aria-hidden className={FLASH_LAYER_CLASS} />
      <span className={cn("hsx-title hsx-num flex aspect-square items-center justify-center", index === 0 ? "bg-hs-gold" : index < 3 ? "bg-hs-sand" : "text-hs-brown")}>{index + 1}</span>
      <span className="flex min-w-0 items-center gap-[calc(var(--u)*0.7)]">
        <Face name={person.name} src={person.photoUrl} className="h-[calc(var(--u)*2.6)]" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-bold">{person.name}</span>
          {person.team ? <span className="hsx-xs block truncate text-hs-brown">{person.team}</span> : null}
        </span>
      </span>
      <span className={cn("hsx-num text-right", lead(metric === "tokens"))}>{person.tokens > 0 ? <span ref={tokens}>{compact(person.tokens)}</span> : "·"}</span>
      <span className={cn("hsx-num text-right", lead(metric === "git"))}>{person.pushes > 0 ? <span ref={pushes}>{number(person.pushes)}</span> : "·"}</span>
      <span className={cn("hsx-num text-right", lead(metric === "git"))}>{person.pullRequests > 0 ? number(person.pullRequests) : "·"}</span>
    </li>
  );
}

function PeopleRows({ people, metric }: { people: MarketPerson[]; metric: MarketPeopleMetric }) {
  const rows = useMemo(() => marketPeople(people, metric, PEOPLE_ROWS), [people, metric]);
  const order = useMemo(() => rows.map((person) => person.id), [rows]);
  const register = useRankRows(order);
  return (
    <div className="hsx-md flex h-full flex-col bg-hs-paper px-[calc(var(--u)*1.3)] pt-[calc(var(--u)*0.9)] text-hs-ink">
      <div className={cn(PEOPLE_GRID, "hsx-label shrink-0 border-b-[length:var(--line)] border-hs-ink pb-[calc(var(--u)*0.5)]")}>
        <span>#</span><span>Persona</span><span className="text-right">Tokens</span><span className="text-right">Pushes</span><span className="text-right">PR</span>
      </div>
      <ol className="relative min-h-0 flex-1">
        {rows.map((person, index) => (
          <PersonRow key={person.id} person={person} index={index} metric={metric} rows={PEOPLE_ROWS} rowRef={register(person.id)} />
        ))}
      </ol>
    </div>
  );
}

const SIDE_HEAD: Record<MarketSide, { title: string; detail: string; tone: string }> = {
  commits: { detail: "Pushes y PR al momento", title: "En GitHub", tone: "bg-hs-navy text-hs-paper" },
  git: { detail: "Pushes y PR por persona", title: "Top GitHub", tone: "bg-hs-orange text-hs-paper" },
  posts: { detail: "Publicaciones", title: "Última hora", tone: "bg-hs-red text-hs-paper" },
  tokens: { detail: "Tokens por persona", title: "Top tokens", tone: "bg-hs-gold text-hs-ink" },
};

/** Side column: posts, GitHub and the individual rankings take turns, wiping between them. */
function Side({ feed, people }: { feed: Feed; people: MarketPerson[] }) {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(SIDE_MS);
  const posts = feed.posts?.length ?? 0;
  const commits = feed.commits?.length ?? 0;
  const sides = useMemo(() => marketSides({ commits, posts }, people), [commits, posts, people]);
  const target = sides[tick % sides.length] ?? "posts";
  const [shown, setShown] = useState<MarketSide>(target);
  const stage = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const head = SIDE_HEAD[shown];

  useEffect(() => {
    if (target === shown) {return;}
    const el = stage.current;
    if (reduced || !el) {
      setShown(target);
      return;
    }
    const tween = gsap.to(el, { clipPath: "inset(100% 0% 0% 0%)", y: -14, duration: 0.36, ease: "power3.in", onComplete: () => setShown(target) });
    return () => {
      tween.kill();
    };
  }, [target, shown, reduced]);

  useGSAP(
    () => {
      const el = stage.current;
      if (!el) {return;}
      if (reduced) {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: TV_REDUCED_FADE, ease: "none", clearProps: "opacity" });
        return;
      }
      gsap.fromTo(
        el,
        { clipPath: "inset(0% 0% 100% 0%)", y: 18 },
        { clipPath: "inset(0% 0% 0% 0%)", y: 0, duration: 0.65, ease: TV_EASE_OUT, clearProps: "clipPath,transform" },
      );
    },
    { dependencies: [shown, reduced] },
  );

  useGSAP(
    () => {
      if (!progress.current || sides.length < 2) {return;}
      gsap.fromTo(progress.current, { scaleX: 0 }, { scaleX: 1, duration: SIDE_MS / 1000, ease: "none", transformOrigin: "0% 50%" });
    },
    { dependencies: [tick, sides.length] },
  );

  return (
    <section data-v2 className="flex min-h-0 flex-col gap-[var(--line)]">
      <header className={cn("relative flex shrink-0 items-center justify-between gap-[calc(var(--u)*1)] px-[calc(var(--u)*1.3)] py-[calc(var(--u)*0.9)] transition-colors duration-300", head.tone)}>
        <h2 className="hsx-title hsx-lg shrink-0">{head.title}</h2>
        <p className="hsx-label truncate">{head.detail}</p>
        {sides.length > 1 ? <span ref={progress} aria-hidden className="absolute inset-x-0 bottom-0 h-[calc(var(--u)*0.3)] origin-left bg-current opacity-45" /> : null}
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={stage} key={shown} className="h-full">
          {shown === "posts" || shown === "commits"
            ? <FeedRows posts={feed[shown] ?? []} waiting={feed[shown] === undefined} />
            : <PeopleRows people={people} metric={shown} />}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function useStageEntrance(root: RefObject<HTMLElement | null>) {
  const reduced = usePrefersReducedMotion();
  useGSAP(
    () => {
      const stage = root.current;
      if (!stage) {return;}
      const cells = [
        ...stage.querySelectorAll<HTMLElement>("header > *"),
        ...stage.querySelectorAll<HTMLElement>("[data-v2]"),
      ];
      if (reduced) {
        gsap.fromTo(cells, { opacity: 0 }, { opacity: 1, duration: TV_REDUCED_FADE, ease: "none", clearProps: "opacity" });
        return;
      }
      gsap.fromTo(
        cells,
        { clipPath: "inset(0% 0% 100% 0%)", y: 40, rotationX: -12, transformPerspective: 1400, transformOrigin: "50% 100%", opacity: 0 },
        { clipPath: "inset(0% 0% 0% 0%)", y: 0, rotationX: 0, opacity: 1, duration: 0.85, stagger: 0.055, ease: TV_EASE_OUT, clearProps: "clipPath,opacity,transform" },
      );
    },
    { scope: root, dependencies: [reduced] },
  );
}

function PanelV2Stage({ data, feed, demo }: { data: LiveInsightData; feed: Feed; demo: boolean }) {
  const root = useRef<HTMLElement>(null);
  const series = useMemo(() => marketSeries(data.samples), [data.samples]);
  const teams = useMemo(() => marketTeams(data.samples, data.teams), [data.samples, data.teams]);
  const bucket = currentBucket(data.samples);
  useStageEntrance(root);
  return (
    <main ref={root} className="relative h-dvh w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label="HackSpain en directo">
      <div className="hsx hsx-md flex h-full flex-col gap-[var(--line)] px-[var(--line)] pt-[var(--line)] pb-[calc(var(--u)*1.2)]">
        <StageHeader data={data} bucket={bucket} demo={demo} />
        <div data-v2 className="contents"><TeamTape teams={teams} /></div>
        <div className="relative min-h-0 flex-1">
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)] gap-[var(--line)]">
            <div className="flex min-h-0 flex-col gap-[var(--line)]">
              <Kpis series={series} />
              <div data-v2 className="h-[calc(var(--u)*5.2)] shrink-0"><LiveCommitPulseBox /></div>
              <Board data={data} series={series} teams={teams} />
            </div>
            <Side feed={feed} people={data.people} />
          </div>
          <MilestoneBroadcast data={data} replayInitial={demo} />
        </div>
        <div data-v2 className="contents"><SponsorStrip /></div>
      </div>
    </main>
  );
}

function LivePanel() {
  const data = useLiveInsights();
  const posts = useQuery(api.tv.listFeed, { source: "participants" });
  const commits = useQuery(api.tv.listFeed, { source: "github" });
  const feed = useMemo(() => ({ commits, posts }), [commits, posts]);
  return <PanelV2Stage data={data} feed={feed} demo={false} />;
}

function DemoPanel() {
  const [startedAt] = useState(() => Date.now());
  const step = useTick(4000);
  const data = useMemo(() => demoInsights(step, startedAt), [step, startedAt]);
  const posts = useMemo<FeedPost[]>(
    () =>
      demoFeed(startedAt).map((post, index) => ({
        ...post,
        hasImage: false,
        ...(post.kind === "github"
          ? { repo: post.teamName.toLowerCase().replaceAll(" ", "-"), sha: ((index + 1) * 2_654_435_761).toString(16).slice(0, 7) }
          : {}),
      })),
    [startedAt],
  );
  const feed = useMemo(
    () => ({ commits: posts.filter((post) => post.kind === "github"), posts: posts.filter((post) => post.kind === "post") }),
    [posts],
  );
  return (
    <FeedDemoContext value={posts}>
      <PanelV2Stage data={data} feed={feed} demo />
    </FeedDemoContext>
  );
}

export function PanelV2Screen({ demo = false }: { demo?: boolean }) {
  return demo ? <DemoPanel /> : <LivePanel />;
}
