"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { compact, harnessRows, number, percent, timeLabel } from "@/app/insights/mock-data";
import { useLiveInsights } from "@/app/insights/use-live-insights";
import type { LiveInsightData } from "@/app/insights/use-live-insights";
import { resolveTvSponsors } from "@/lib/tv";
import {
  MARKET_BUCKETS, currentBucket, demoFeed, demoInsights, marketSeries, marketSlides, marketTeams, marketTotals,
} from "@/lib/tv-market";
import type { MarketPost, MarketSeries, MarketSlide, MarketTeam } from "@/lib/tv-market";
import { cn } from "@/lib/utils";
import { useClock, usePageVisible, useTick } from "./motion";
import { MilestoneBroadcast } from "./milestone-broadcast";

const SLIDE_MS = 12_000;
const RANKING_ROWS = 7;
const FEED_ROWS = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

function Spark({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  const points = values.length > 1
    ? values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - (value / max) * 26}`).join(" ")
    : "0,28 100,28";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden className={cn("h-full w-full overflow-visible", className)}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Remounting on a new value replays the flash, which is how a figure says "I just moved". */
function Figure({ value, children }: { value: number; children: ReactNode }) {
  return <span key={value} className="hsx-flash hsx-num">{children}</span>;
}

function Move({ move }: { move: number }) {
  if (move === 0) { return <span className="hsx-num opacity-35">=</span>; }
  return (
    <span className={cn("hsx-num", move > 0 ? "text-[var(--hsx-up)]" : "text-[var(--hsx-down)]")}>
      {move > 0 ? "▲" : "▼"}{Math.abs(move)}
    </span>
  );
}

function Clock({ startsAt, endsAt }: { startsAt?: number; endsAt?: number }) {
  const now = useClock();
  const time = now?.getTime();
  let label = "En marcha";
  let target: number | undefined;
  if (time !== undefined && startsAt !== undefined && endsAt !== undefined) {
    if (time < startsAt) { label = "Empieza en"; target = startsAt; }
    else if (time < endsAt) { label = "Quedan"; target = endsAt; }
    else { label = "Hackathon terminado"; }
  }
  const left = target !== undefined && time !== undefined ? Math.max(0, Math.floor((target - time) / 1000)) : null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <>
      <div className="flex flex-col items-center justify-center bg-hs-gold leading-none text-hs-ink">
        <span className="hsx-label">{label}</span>
        {left !== null ? <span className="hsx-title hsx-num hsx-xl mt-[calc(var(--u)*0.4)]">{pad(Math.floor(left / 3600))}:{pad(Math.floor(left / 60) % 60)}:{pad(left % 60)}</span> : null}
      </div>
      <div className="flex flex-col items-center justify-center bg-hs-teal leading-none text-hs-paper">
        <span className="hsx-label">Madrid</span>
        <span className="hsx-title hsx-num hsx-xl mt-[calc(var(--u)*0.4)]">{now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) ?? "--:--"}</span>
      </div>
    </>
  );
}

/** The landing's ornament: a cell cut corner to corner, with the grid's ink stroke on the cut. */
export function Diagonal({ bg, tri, corner, className }: { bg: string; tri: string; corner: "tl" | "br"; className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden", bg, className)}>
      <div className={cn("absolute inset-0", tri)} style={{ clipPath: corner === "tl" ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(100% 0, 100% 100%, 0 100%)" }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <line x1="100" x2="0" y1="0" y2="100" stroke="var(--color-hs-ink)" strokeWidth="var(--line)" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Marquee({ seconds, children }: { seconds: number; children: ReactNode }) {
  const visible = usePageVisible();
  return (
    <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
      <div className="tv-ticker flex w-max items-center" style={{ animationDuration: `${seconds}s`, animationPlayState: visible ? "running" : "paused" }}>
        {[0, 1].map((copy) => <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">{children}</div>)}
      </div>
    </div>
  );
}

function TeamTape({ teams }: { teams: MarketTeam[] }) {
  return (
    <div className="grid h-[5.6%] shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-[var(--line)]">
      <p className="hsx-title hsx-sm flex items-center bg-hs-gold px-[calc(var(--u)*1.4)] text-hs-ink">Equipos</p>
      <div className="flex min-w-0 bg-hs-ink text-hs-paper [--hsx-down:var(--color-hs-orange)] [--hsx-up:var(--color-hs-slate)]">
        {teams.length ? (
          <Marquee seconds={Math.max(40, teams.length * 6)}>
            {teams.map((team) => (
              <span key={team.id} className="hsx-md flex items-baseline gap-[calc(var(--u)*0.85)] border-r border-hs-paper/15 px-[calc(var(--u)*1.6)] whitespace-nowrap">
                <span className="flex items-baseline gap-[calc(var(--u)*0.45)]">
                  <span className="hsx-num opacity-50">{String(team.rank).padStart(2, "0")}</span>
                  <Move move={team.move} />
                </span>
                <span className="font-bold">{team.name}</span>
                <span className="hsx-num text-hs-gold">{compact(team.tokens)}</span>
              </span>
            ))}
          </Marquee>
        ) : <p className="hsx-label flex items-center px-[calc(var(--u)*1.6)]">A la espera de los primeros equipos</p>}
      </div>
    </div>
  );
}

function Kpi({ label, value, shown, recent, trend, tone }: {
  label: string; value: number; shown: string; recent: string; trend: number[]; tone: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between gap-[calc(var(--u)*0.4)] p-[calc(var(--u)*1.1)] [--hsx-flash:var(--color-hs-paper)]", tone)}>
      <p className="hsx-label">{label}</p>
      <p className="hsx-title hsx-2xl whitespace-nowrap"><Figure value={value}>{shown}</Figure></p>
      <div className="h-[calc(var(--u)*2.2)]"><Spark values={trend} /></div>
      <p className="hsx-num hsx-sm truncate border-t-[length:var(--line)] border-current/30 pt-[calc(var(--u)*0.5)] font-semibold">{recent}</p>
    </div>
  );
}

function Kpis({ series }: { series: MarketSeries }) {
  const totals = marketTotals(series);
  const last = series.at(-1);
  const trend = (metric: keyof MarketSeries[number]) => series.map((row) => row[metric]);
  const cards = [
    { label: "Tokens procesados", value: totals.tokens, shown: compact(totals.tokens), recent: `+${compact(last?.tokens ?? 0)} este tramo`, trend: trend("tokens"), tone: "bg-hs-gold text-hs-ink" },
    { label: "Pushes a GitHub", value: totals.pushes, shown: number(totals.pushes), recent: `+${number(last?.pushes ?? 0)} este tramo`, trend: trend("pushes"), tone: "bg-hs-orange text-hs-paper" },
    { label: "Sesiones de agentes", value: totals.sessions, shown: number(totals.sessions), recent: `+${number(last?.sessions ?? 0)} este tramo`, trend: trend("sessions"), tone: "bg-hs-teal text-hs-paper" },
    { label: "Pull requests", value: totals.pullRequests, shown: number(totals.pullRequests), recent: `+${number(last?.pullRequests ?? 0)} este tramo`, trend: trend("pullRequests"), tone: "bg-hs-navy text-hs-paper" },
  ].filter((card) => card.value > 0);

  if (cards.length === 0) { return null; }

  return (
    <div className={cn(
      "grid shrink-0 gap-[var(--line)]",
      cards.length === 1 && "grid-cols-1",
      cards.length === 2 && "grid-cols-2",
      cards.length === 3 && "grid-cols-3 portrait:grid-cols-2 portrait:[&>*:last-child]:col-span-2",
      cards.length === 4 && "grid-cols-4 portrait:grid-cols-2",
    )}>
      {cards.map((card) => <Kpi key={card.label} {...card} />)}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="hsx-label flex h-full items-center justify-center text-center">{children}</p>;
}

function PulseSlide({ series, data }: { series: MarketSeries; data: LiveInsightData }) {
  if (!series.some((row) => row.tokens > 0)) { return <Empty>Sin consumo registrado todavía</Empty>; }
  const timeline = { bucketMinutes: data.bucketMinutes, startsAt: data.startsAt };
  const cumulative: number[] = [];
  for (const row of series) { cumulative.push((cumulative.at(-1) ?? 0) + row.tokens); }
  const running = cumulative.at(-1) ?? 0;
  const peak = Math.max(...series.map((row) => row.tokens), 1);
  const x = (bucket: number) => ((bucket + 0.5) / MARKET_BUCKETS) * 1000;
  const y = (value: number) => 250 - (value / Math.max(running, 1)) * 235;
  const line = cumulative.map((value, bucket) => `${x(bucket)},${y(value)}`).join(" ");
  const head = cumulative.length - 1;
  return (
    <div className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((step) => <line key={step} x1="0" x2="1000" y1={y(running * step)} y2={y(running * step)} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />)}
          <polygon points={`${x(0)},250 ${line} ${x(head)},250`} fill="var(--color-hs-orange)" fillOpacity="0.16" />
          <polyline points={line} fill="none" stroke="var(--color-hs-orange)" strokeWidth="3.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={x(head)} x2={x(head)} y1="0" y2="400" stroke="var(--color-hs-ink)" strokeOpacity="0.55" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          {series.map((row, bucket) => {
            const height = (row.tokens / peak) * 120;
            return <rect key={bucket} x={x(bucket) - 14} width="28" y={400 - height} height={height} fill={bucket === head ? "var(--color-hs-gold)" : "var(--color-hs-teal)"} stroke="var(--color-hs-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <p className="hsx-num hsx-sm absolute top-0 left-0 font-semibold text-hs-brown">{compact(running)} acumulados</p>
        <p className="hsx-label absolute bottom-[31%] left-0">Tokens por tramo</p>
        <p className="hsx-num hsx-sm absolute -translate-x-1/2 bg-hs-ink px-[calc(var(--u)*0.5)] font-bold text-hs-gold" style={{ left: `${x(head) / 10}%`, top: `${Math.max(0, y(running) / 4 - 9)}%` }}>AHORA</p>
      </div>
      <div className="hsx-num hsx-xs relative mt-[calc(var(--u)*0.5)] h-[calc(var(--u)*1.2)] shrink-0 text-hs-brown">
        {[0, 4, 8, 12, 16, 20].map((bucket) => <span key={bucket} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(bucket) / 10}%` }}>{timeLabel(bucket, timeline)}</span>)}
      </div>
    </div>
  );
}

const RANKING_GRID = "grid grid-cols-[2.4em_3.2em_minmax(0,1fr)_8em_6em_7.5em_4.4em_3.2em] items-center whitespace-nowrap gap-x-[calc(var(--u)*1.1)]";

function RankingSlide({ teams, page }: { teams: MarketTeam[]; page: number }) {
  const rows = teams.slice(page * RANKING_ROWS, (page + 1) * RANKING_ROWS);
  if (!rows.length) { return <Empty>Sin equipos en el tablero todavía</Empty>; }
  return (
    <div className="hsx-md flex h-full flex-col">
      <div className={cn(RANKING_GRID, "hsx-label shrink-0 border-b-[length:var(--line)] border-hs-ink pb-[calc(var(--u)*0.5)]")}>
        <span>#</span><span>Mov.</span><span>Equipo</span><span>Evolución</span>
        <span className="text-right">Tokens</span><span className="text-right">Este tramo</span><span className="text-right">Pushes</span><span className="text-right">PR</span>
      </div>
      <ol className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${RANKING_ROWS}, minmax(0, 1fr))` }}>
        {rows.map((team, index) => (
          <motion.li key={team.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.045, duration: 0.4, ease: EASE }}
            className={cn(RANKING_GRID, "border-b border-hs-ink/15")}>
            <span className={cn("hsx-title hsx-num flex aspect-square items-center justify-center", team.rank === 1 ? "bg-hs-gold" : team.rank <= 3 ? "bg-hs-sand" : "text-hs-brown")}>{team.rank}</span>
            <Move move={team.move} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-bold">{team.name}</span>
              {team.project ? <span className="hsx-xs block truncate text-hs-brown">{team.project}</span> : null}
            </span>
            <span className={cn("h-[calc(var(--u)*1.7)]", team.move < 0 ? "text-[var(--hsx-down)]" : "text-[var(--hsx-up)]")}><Spark values={team.trend} /></span>
            <span className="hsx-num text-right font-bold"><Figure value={team.tokens}>{compact(team.tokens)}</Figure></span>
            <span className="hsx-num text-right font-semibold text-[var(--hsx-up)]">{team.recent > 0 ? `+${compact(team.recent)}` : "·"}</span>
            <span className="hsx-num text-right text-hs-brown">{number(team.pushes)}</span>
            <span className="hsx-num text-right text-hs-brown">{number(team.pullRequests)}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function Bars({ rows }: { rows: { key: string; name: string; detail: string; share: number; value: string; color: string }[] }) {
  return (
    <ol className="hsx-md grid h-full grid-flow-col grid-cols-2 gap-x-[calc(var(--u)*2.4)]" style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(rows.length / 2))}, minmax(0, 1fr))` }}>
      {rows.map((row, index) => (
        <li key={row.key} className="flex flex-col justify-center gap-[calc(var(--u)*0.4)]">
          <div className="flex items-baseline justify-between gap-[calc(var(--u)*0.8)]">
            <span className="truncate font-bold">{row.name}<span className="hsx-xs ml-[calc(var(--u)*0.6)] font-normal text-hs-brown">{row.detail}</span></span>
            <span className="hsx-num shrink-0 font-semibold">{row.value}</span>
          </div>
          <div className="h-[calc(var(--u)*0.7)] border-[length:calc(var(--line)*0.5)] border-hs-ink bg-hs-sand">
            <motion.div className="h-full origin-left" style={{ backgroundColor: row.color, width: `${Math.max(row.share * 100, 1)}%` }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1 + index * 0.05, duration: 0.7, ease: EASE }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const STACK_COLORS = ["#1e3958", "#35858a", "#d96b2a", "#cc291f", "#eab619"];

function Board({ data, series, teams }: { data: LiveInsightData; series: MarketSeries; teams: MarketTeam[] }) {
  const reduced = useReducedMotion();
  const tick = useTick(SLIDE_MS);
  const slides = useMemo(() => marketSlides(teams.length, RANKING_ROWS), [teams.length]);
  const slide: MarketSlide = slides[tick % slides.length] ?? { kind: "pulso" };
  const tools = harnessRows(data.samples).filter((row) => row.tokens > 0).toSorted((a, b) => b.tokens - a.tokens);
  const toolTokens = tools.reduce((sum, row) => sum + row.tokens, 0);
  const stacks = data.stacks.rows.slice(0, 12);
  const { cachedTokens: cached, tokens } = marketTotals(series);
  const heading: Record<MarketSlide["kind"], [title: string, detail: string]> = {
    herramientas: ["Herramientas de IA", "Cuota de tokens · sesiones"],
    pulso: ["El pulso del evento", `Tokens acumulados y por tramo · ${percent(cached, tokens)} desde caché`],
    ranking: ["Clasificación de equipos", slide.kind === "ranking" ? `Por tokens · página ${slide.page + 1} de ${slide.pages}` : ""],
    stacks: ["Con qué construimos", `${data.stacks.auto} de ${data.stacks.total} stacks detectados desde GitHub`],
  };
  const [title, detail] = heading[slide.kind];
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-hs-paper text-hs-ink">
      <header className="flex shrink-0 items-center justify-between gap-[calc(var(--u)*1.5)] border-b-[length:var(--line)] border-hs-ink px-[calc(var(--u)*1.3)] py-[calc(var(--u)*0.8)]">
        <div className="flex min-w-0 items-baseline gap-[calc(var(--u)*1.1)]">
          <h2 className="hsx-title hsx-lg shrink-0">{title}</h2>
          <p className="hsx-label truncate">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-[calc(var(--u)*0.35)]" aria-hidden>
          {slides.map((item, index) => (
            <span key={`${item.kind}-${index}`} className="h-[calc(var(--u)*0.5)] w-[calc(var(--u)*1.8)] overflow-hidden bg-hs-ink/15">
              {index === tick % slides.length ? <span key={tick} className="hsx-progress block h-full origin-left bg-hs-orange" style={{ animationDuration: `${SLIDE_MS}ms` }} /> : null}
            </span>
          ))}
        </div>
      </header>
      <div className="relative min-h-0 flex-1 p-[calc(var(--u)*1.3)]">
        <AnimatePresence mode="wait">
          <motion.div key={`${slide.kind}-${slide.kind === "ranking" ? slide.page : 0}`} className="h-full"
            initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -10 }} transition={{ duration: reduced ? 0.15 : 0.4, ease: EASE }}>
            {slide.kind === "pulso" ? <PulseSlide series={series} data={data} /> : null}
            {slide.kind === "ranking" ? <RankingSlide teams={teams} page={slide.page} /> : null}
            {slide.kind === "herramientas" ? (tools.length ? <Bars rows={tools.map((row) => ({
              color: row.color, detail: `${number(row.sessions)} sesiones · ${row.teams} equipos`, key: row.id, name: row.name,
              share: row.tokens / Math.max(tools[0]?.tokens ?? 1, 1), value: percent(row.tokens, toolTokens),
            }))} /> : <Empty>Sin herramientas en uso todavía</Empty>) : null}
            {slide.kind === "stacks" ? (stacks.length ? <Bars rows={stacks.map((row, index) => ({
              color: STACK_COLORS[index % STACK_COLORS.length] ?? "#eab619", detail: row.category, key: row.name, name: row.name,
              share: row.count / Math.max(stacks[0]?.count ?? 1, 1), value: `${row.count} / ${data.stacks.total}`,
            }))} /> : <Empty>Sin tecnologías detectadas todavía</Empty>) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function ago(now: number, then: number): string {
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) { return "ahora"; }
  if (minutes < 60) { return `${minutes} min`; }
  return minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`;
}

function Feed({ posts }: { posts: MarketPost[] | undefined }) {
  const reduced = useReducedMotion();
  const minute = useClock();
  const rows = posts?.slice(0, FEED_ROWS) ?? [];
  return (
    <section className="flex min-h-0 flex-col gap-[var(--line)]">
      <header className="flex shrink-0 items-center justify-between bg-hs-red px-[calc(var(--u)*1.3)] py-[calc(var(--u)*0.9)] text-hs-paper">
        <h2 className="hsx-title hsx-lg">Última hora</h2>
        <p className="hsx-label">Feed y GitHub</p>
      </header>
      {rows.length === 0 ? <div className="min-h-0 flex-1 bg-hs-paper text-hs-ink"><Empty>{posts ? "La actividad aparecerá aquí" : "Cargando actividad"}</Empty></div> : (
        <ol className="grid min-h-0 flex-1 gap-[var(--line)] overflow-hidden" style={{ gridTemplateRows: `repeat(${FEED_ROWS}, minmax(0, 1fr))` }}>
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((post) => (
              <motion.li key={post._id} layout={!reduced} initial={{ opacity: 0, y: reduced ? 0 : -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }} className="flex min-h-0 flex-col justify-center gap-[calc(var(--u)*0.35)] bg-hs-paper px-[calc(var(--u)*1.3)] text-hs-ink">
                <p className="hsx-sm flex items-center gap-[calc(var(--u)*0.6)]">
                  <span className={cn("hsx-num hsx-xs px-[calc(var(--u)*0.45)] py-[calc(var(--u)*0.1)] font-bold text-hs-paper", post.kind === "github" ? "bg-hs-navy" : "bg-hs-orange")}>{post.kind === "github" ? "GIT" : "POST"}</span>
                  <span className="truncate font-bold">{post.authorName}</span>
                  {post.teamName ? <span className="truncate text-hs-brown">{post.teamName}</span> : null}
                  <span className="hsx-num hsx-xs ml-auto shrink-0 text-hs-brown">{minute ? ago(minute.getTime(), post.createdAt) : ""}</span>
                </p>
                <p className="line-clamp-2 text-[length:calc(var(--u)*1.3)] leading-snug break-words">{post.text}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

function SponsorStrip() {
  const sponsors = resolveTvSponsors();
  return (
    <div className="grid h-[9%] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-[var(--line)]">
      <p className="hsx-title hsx-sm flex items-center bg-hs-orange px-[calc(var(--u)*1.4)] text-hs-paper">Patrocinan</p>
      <div className="flex min-w-0 bg-hs-paper">
        <Marquee seconds={sponsors.length * 4.5}>
          {sponsors.map((sponsor) => (
            <span key={sponsor.name} className="flex h-[calc(var(--u)*3.2)] items-center px-[calc(var(--u)*2.6)]">
              <Image src={sponsor.logoUrl} alt={sponsor.name} width={250} height={100} className="h-full w-auto max-w-[calc(var(--u)*13)] object-contain brightness-0" />
            </span>
          ))}
        </Marquee>
      </div>
      <p className="flex flex-col items-center justify-center bg-hs-navy px-[calc(var(--u)*1.7)] leading-none text-hs-paper">
        <span className="hsx-label">Powered by</span>
        <span className="hsx-title hsx-sm mt-[calc(var(--u)*0.4)]">RawTree</span>
      </p>
    </div>
  );
}

function MarketStage({ data, posts, demo }: { data: LiveInsightData; posts: MarketPost[] | undefined; demo: boolean }) {
  const series = useMemo(() => marketSeries(data.samples), [data.samples]);
  const teams = useMemo(() => marketTeams(data.samples, data.teams), [data.samples, data.teams]);
  const bucket = currentBucket(data.samples);
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label="HackSpain en directo">
      <div className="hsx hsx-md flex h-full flex-col gap-[var(--line)] px-[var(--line)] pt-[var(--line)] pb-[calc(var(--u)*1.2)]">
        <header className="grid h-[9%] shrink-0 grid-cols-[minmax(0,1.45fr)_minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-[var(--line)] portrait:h-[11%] portrait:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)] portrait:grid-rows-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center justify-between gap-[calc(var(--u)*1.5)] bg-hs-paper px-[calc(var(--u)*1.6)]">
            <Image src="/logo.svg" alt="HackSpain" width={190} height={63} priority className="h-[62%] w-auto min-w-0" />
            <p className="hsx-label flex shrink-0 items-center gap-[calc(var(--u)*0.55)] border-l-[length:var(--line)] border-hs-ink/20 pl-[calc(var(--u)*1.2)] text-hs-red">
              <span className="size-[calc(var(--u)*0.65)] rounded-full bg-current" />{demo ? "Demo" : "En directo"}
            </p>
          </div>
          <div className="flex flex-col justify-center gap-[calc(var(--u)*0.65)] bg-hs-paper px-[calc(var(--u)*1.8)] leading-none portrait:col-span-3 portrait:row-start-2">
            <p className="hsx-label flex justify-between"><span>Tramo del hackathon</span><span className="hsx-num font-bold text-hs-ink">{bucket + 1} / {MARKET_BUCKETS}</span></p>
            <div className="relative h-[calc(var(--u)*0.85)] overflow-hidden border-[length:calc(var(--line)*0.5)] border-hs-ink bg-hs-sand" aria-hidden>
              <span className="absolute inset-y-0 left-0 bg-hs-teal" style={{ width: `${(bucket / MARKET_BUCKETS) * 100}%` }} />
              <span className="absolute inset-y-0 bg-hs-gold" style={{ left: `${(bucket / MARKET_BUCKETS) * 100}%`, width: `${100 / MARKET_BUCKETS}%` }} />
            </div>
          </div>
          <Clock startsAt={data.startsAt} endsAt={data.endsAt} />
        </header>
        <TeamTape teams={teams} />
        <div className="relative min-h-0 flex-1">
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)] gap-[var(--line)] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-[var(--line)]">
              <Kpis series={series} />
              <Board data={data} series={series} teams={teams} />
            </div>
            <Feed posts={posts} />
          </div>
          <MilestoneBroadcast data={data} replayInitial={demo} />
        </div>
        <SponsorStrip />
      </div>
    </main>
  );
}

function LiveMarket() {
  const data = useLiveInsights();
  const posts = useQuery(api.tv.listFeed, { source: "all" });
  return <MarketStage data={data} posts={posts} demo={false} />;
}

function DemoMarket() {
  const [startedAt] = useState(() => Date.now());
  const step = useTick(4000);
  const data = useMemo(() => demoInsights(step, startedAt), [step, startedAt]);
  const posts = useMemo(() => demoFeed(startedAt), [startedAt]);
  return <MarketStage data={data} posts={posts} demo />;
}

export function MarketScreen({ demo = false }: { demo?: boolean }) {
  return demo ? <DemoMarket /> : <LiveMarket />;
}
