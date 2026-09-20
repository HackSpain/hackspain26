"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Diagonal, Face } from "@/components/tv/market";
import { figure, percent } from "@/lib/closing-summary";
import type { ClosingSummary } from "@/lib/closing-summary";
import { cn } from "@/lib/utils";
import { BurnerView } from "./burner";
import { Columns, Empty, HBars, stampOf } from "./slides";

/** How long each rotating box holds a view; the two boxes change half a turn apart. */
const HOLD_MS = 10_000;
const KPI_TONES = [
  "bg-hs-gold",
  "bg-hs-teal text-hs-paper",
  "bg-hs-orange",
  "bg-hs-navy text-hs-paper",
  "bg-hs-red text-hs-paper",
  "bg-hs-paper",
  "bg-hs-gold",
  "bg-hs-teal text-hs-paper",
];
const PAD = "p-[calc(var(--u)*1.2)]";

type View = { title: string; body: ReactNode };

/** `fixed` pins both boxes (for a still capture or a static embed). */
function useHalfTurns(fixed: number | null): number {
  const [turns, setTurns] = useState(0);
  useEffect(() => {
    if (fixed !== null) {
      return;
    }
    const timer = setInterval(() => setTurns((value) => value + 1), HOLD_MS / 2);
    return () => clearInterval(timer);
  }, [fixed]);
  return fixed === null ? turns : fixed * 2;
}

function Box({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-[calc(var(--u)*0.8)] bg-hs-paper", PAD)}>
      <div className="flex items-baseline justify-between gap-[calc(var(--u)*1)]">
        <h3 className="hsx-title hsx-md truncate">{title}</h3>
        {note ? <p className="hsx-xs hsx-num shrink-0 font-semibold text-hs-brown">{note}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Rotator({ views, index, moving }: { views: View[]; index: number; moving: boolean }) {
  const current = index % views.length;
  const view = views[current];
  if (!view) {
    return null;
  }
  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-col gap-[calc(var(--u)*0.8)] bg-hs-paper", PAD)}>
      <div className="flex items-baseline justify-between gap-[calc(var(--u)*1)]">
        <h3 className="hsx-title hsx-md truncate">{view.title}</h3>
        <p className="hsx-xs hsx-num shrink-0 font-semibold text-hs-brown">{current + 1} / {views.length}</p>
      </div>
      <div key={current} className="min-h-0 flex-1 animate-in fade-in duration-500 motion-reduce:animate-none">{view.body}</div>
      {moving ? (
        <div key={`bar-${index}`} aria-hidden className="hsx-progress absolute inset-x-0 bottom-0 h-[calc(var(--u)*0.3)] origin-left bg-hs-ink" style={{ animationDuration: `${HOLD_MS}ms` }} />
      ) : null}
    </div>
  );
}

function FeedView({ feed }: { feed: ClosingSummary["feed"] }) {
  const stats = [
    { label: "Posts", value: feed.posts },
    { label: "Memes", value: feed.memes },
    { label: "Reacciones", value: feed.reactions },
    { label: "Comentarios", value: feed.comments },
  ];
  const hours = feed.byHour.map((_, hour) => `${String(hour).padStart(2, "0")} h`);
  return (
    <div className="flex h-full flex-col justify-between gap-[calc(var(--u)*0.8)]">
      <dl className="grid grid-cols-2 gap-x-[calc(var(--u)*1.5)] gap-y-[calc(var(--u)*0.9)]">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="hsx-label">{stat.label}</dt>
            <dd className="hsx-title hsx-num text-[calc(var(--u)*2.5)]">{figure(stat.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="min-h-0 flex-1">
        <Columns values={feed.byHour} labels={hours} night={hours.map((_, hour) => hour < 7)} fill="bg-hs-red" unit="posts" tickEvery={6} />
      </div>
      <ul className="flex flex-wrap gap-x-[calc(var(--u)*1.3)] gap-y-[calc(var(--u)*0.4)] border-t-[length:calc(var(--line)*0.5)] border-hs-ink/30 pt-[calc(var(--u)*0.8)]">
        {feed.emojis.slice(0, 5).map((row) => (
          <li key={row.emoji} className="flex items-center gap-[calc(var(--u)*0.4)]">
            <span className="text-[calc(var(--u)*1.7)] leading-none">{row.emoji}</span>
            <span className="hsx-num hsx-md font-bold">{figure(row.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AwardsView({ awards }: { awards: ClosingSummary["awards"] }) {
  if (awards.length === 0) {
    return <Empty />;
  }
  return (
    <ol className="grid h-full" style={{ gridTemplateRows: `repeat(${awards.length}, minmax(0, 1fr))` }}>
      {awards.map((award) => (
        <li key={award.title} className="flex min-w-0 items-center gap-[calc(var(--u)*0.9)] border-b-[length:calc(var(--line)*0.5)] border-hs-ink/20 last:border-b-0">
          <Face name={award.team} src={award.logoUrl} logo className="h-[calc(var(--u)*2.6)]" />
          <div className="min-w-0 flex-1">
            <p className="hsx-label">{award.title}</p>
            <p className="hsx-md flex items-baseline justify-between gap-[calc(var(--u)*0.8)]">
              <span className="truncate font-bold">{award.team}</span>
              <span className="hsx-sm hsx-num shrink-0 text-hs-brown">{award.detail}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The whole weekend on one 16:9 screen, built to sit inside a slide as an embed. */
export function ClosingPanel({ summary, demo, step }: { summary: ClosingSummary; demo: boolean; step: number | null }) {
  const turns = useHalfTurns(step);
  const { timeline, usage } = summary;
  const github = timeline.github.reduce((sum, value) => sum + value, 0);
  const tools: View[] = [
    { body: <HBars rows={summary.harnesses} fill="bg-hs-orange" size="hsx-md" />, title: "Herramientas de IA" },
    { body: <HBars rows={summary.models} fill="bg-hs-teal" size="hsx-md" />, title: "Modelos" },
    { body: <HBars rows={summary.stacks.rows.slice(0, 7)} fill="bg-hs-navy" size="hsx-md" />, title: "El stack" },
    { body: <HBars rows={summary.people} fill="bg-hs-orange" size="hsx-md" />, title: "Quién quemó más tokens" },
  ];
  const people: View[] = [
    { body: <FeedView feed={summary.feed} />, title: "El feed" },
    { body: <HBars rows={summary.tracks.rows.slice(0, 7)} fill="bg-hs-teal" size="hsx-md" />, title: "Entregas por reto" },
    { body: <AwardsView awards={summary.awards} />, title: "Menciones de honor" },
    ...(summary.burner ? [{ body: <BurnerView burner={summary.burner} />, title: `¿Quién es ${summary.burner.name}?` }] : []),
  ];
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label="HackSpain en cifras">
      <div className="hsx hsx-md grid h-full grid-rows-[11%_19%_minmax(0,1fr)] gap-[var(--line)] p-[var(--line)]">
        <header className="grid min-h-0 grid-cols-[6.2%_minmax(0,1fr)_15%_17%_6.2%] gap-[var(--line)]">
          <Diagonal bg="bg-hs-gold" tri="bg-hs-red" corner="tl" />
          <div className="flex min-w-0 items-baseline gap-[calc(var(--u)*1.4)] bg-hs-paper px-[calc(var(--u)*1.6)] pt-[calc(var(--u)*1.55)]">
            <h1 className="hsx-title truncate text-[calc(var(--u)*2.6)]">HackSpain en cifras</h1>
            {summary.hours > 0 ? <p className="hsx-label shrink-0">{summary.hours} horas construyendo</p> : null}
          </div>
          <div className="flex items-center justify-center bg-hs-paper">
            <Image src="/logo.svg" alt="HackSpain" width={190} height={63} priority className="h-[58%] w-auto" />
          </div>
          <p className="hsx-label flex items-center justify-center gap-[calc(var(--u)*0.55)] bg-hs-paper text-hs-red">
            <span className="size-[calc(var(--u)*0.65)] rounded-full bg-current" />{stampOf(summary, demo)}
          </p>
          <Diagonal bg="bg-hs-teal" tri="bg-hs-navy" corner="br" />
        </header>
        <div className="grid min-h-0 grid-cols-8 gap-[var(--line)]">
          {summary.hero.map((stat, index) => (
            <div key={stat.label} className={cn("flex min-w-0 flex-col justify-between", PAD, KPI_TONES[index % KPI_TONES.length])}>
              <p className="hsx-label">{stat.label}</p>
              <p className="hsx-title hsx-num text-[calc(var(--u)*2.7)] whitespace-nowrap">{figure(stat.value)}</p>
            </div>
          ))}
        </div>
        <div className="grid min-h-0 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[var(--line)]">
          <div className="grid min-h-0 grid-rows-2 gap-[var(--line)]">
            <Box title="Tokens de IA, hora a hora" note={`${percent(timeline.nightShare)} de madrugada · ${percent(usage.cachedShare)} desde caché · ${figure(usage.sessions)} sesiones`}>
              <Columns values={timeline.tokens} labels={timeline.labels} night={timeline.night} fill="bg-hs-orange" unit="tokens" tickEvery={4} />
            </Box>
            <Box title="Pushes y pull requests" note={`${figure(github)} en total · franja oscura = madrugada`}>
              <Columns values={timeline.github} labels={timeline.labels} night={timeline.night} fill="bg-hs-navy" unit="eventos" tickEvery={4} />
            </Box>
          </div>
          <Rotator views={tools} index={Math.floor(turns / 2)} moving={step === null} />
          <Rotator views={people} index={Math.floor((turns + 1) / 2)} moving={step === null} />
        </div>
      </div>
    </main>
  );
}
