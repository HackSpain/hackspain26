"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Diagonal, Face } from "@/components/tv/market";
import { figure, percent } from "@/lib/closing-summary";
import type { Bar, ClosingSummary } from "@/lib/closing-summary";
import { cn } from "@/lib/utils";
import { BURNER_CALL, Mugshot, burnerFacts } from "./burner";

const TONES = [
  "bg-hs-paper",
  "bg-hs-gold",
  "bg-hs-teal text-hs-paper",
  "bg-hs-orange",
  "bg-hs-navy text-hs-paper",
  "bg-hs-red text-hs-paper",
];
const PAD = "p-[calc(var(--u)*1.6)]";
const NUMBER = "hsx-title hsx-num whitespace-nowrap";

function tone(index: number): string {
  return TONES[index % TONES.length] ?? "bg-hs-paper";
}

/** One 16:9 slide: the landing's mosaic, sized off its own box so it exports at any resolution. */
function Frame({ title, kicker, stamp, children }: { title: string; kicker: string; stamp: string; children: ReactNode }) {
  return (
    <section className="relative aspect-video w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label={title}>
      <div className="hsx hsx-md grid h-full grid-rows-[15%_minmax(0,1fr)_4.5%] gap-[var(--line)] p-[var(--line)]">
        <header className="grid min-h-0 grid-cols-[8.4%_minmax(0,1fr)_16%_8.4%] gap-[var(--line)]">
          <Diagonal bg="bg-hs-gold" tri="bg-hs-red" corner="tl" />
          <div className="flex min-w-0 flex-col justify-center gap-[calc(var(--u)*0.5)] bg-hs-paper px-[calc(var(--u)*1.8)]">
            <p className="hsx-label">{kicker}</p>
            <h2 className="hsx-title truncate text-[calc(var(--u)*3.4)]">{title}</h2>
          </div>
          <div className="flex items-center justify-center bg-hs-paper">
            <Image src="/logo.svg" alt="HackSpain" width={190} height={63} className="h-[52%] w-auto" />
          </div>
          <Diagonal bg="bg-hs-teal" tri="bg-hs-navy" corner="br" />
        </header>
        <div className="min-h-0">{children}</div>
        <footer className="hsx-label flex items-center justify-between bg-hs-paper px-[calc(var(--u)*1.8)]">
          <span>HackSpain 2026 · Madrid</span>
          <span className="hsx-num">{stamp}</span>
        </footer>
      </div>
    </section>
  );
}

function Stat({ label, value, className, detail }: { label: string; value: string; className?: string; detail?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between", PAD, className)}>
      <p className="hsx-label">{label}</p>
      <div>
        <p className={cn(NUMBER, "text-[calc(var(--u)*4.4)]")}>{value}</p>
        {detail ? <p className="hsx-md mt-[calc(var(--u)*0.5)] font-semibold">{detail}</p> : null}
      </div>
    </div>
  );
}

function Panel({ title, note, className, children }: { title: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-[calc(var(--u)*1.1)] bg-hs-paper", PAD, className)}>
      <div className="flex items-baseline justify-between gap-[calc(var(--u)*1.2)]">
        <h3 className="hsx-title hsx-lg">{title}</h3>
        {note ? <p className="hsx-sm font-semibold text-hs-brown">{note}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty() {
  return <p className="hsx-lg flex h-full items-center justify-center font-semibold text-hs-brown">Sin datos todavía</p>;
}

/** Ranked magnitudes: one hue; the logo or photo, the name and the number carry the identity. */
export function HBars({ rows, fill, columns = 1, size = "hsx-lg" }: { rows: Bar[]; fill: string; columns?: 1 | 2; size?: string }) {
  if (rows.length === 0) {
    return <Empty />;
  }
  const perColumn = Math.ceil(rows.length / columns);
  // All or nothing, so the bars of one list start on the same edge.
  const faces = rows.some((row) => row.icon || row.photo);
  return (
    <ol
      className={cn(size, "grid h-full grid-flow-col gap-x-[calc(var(--u)*3)]", columns === 2 ? "grid-cols-2" : "grid-cols-1")}
      style={{ gridTemplateRows: `repeat(${perColumn}, minmax(0, 1fr))` }}
    >
      {rows.map((row) => (
        <li key={row.key} className="flex min-w-0 items-center gap-[calc(var(--u)*0.9)]" title={`${row.name}: ${figure(row.value)}`}>
          {faces ? <Face name={row.name} src={row.icon} logo={!row.photo} className="h-[2.2em]" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-[calc(var(--u)*0.45)]">
            <div className="flex items-baseline justify-between gap-[calc(var(--u)*1)]">
              <span className="truncate font-bold">
                {row.name}
                {row.detail ? <span className="hsx-sm ml-[calc(var(--u)*0.7)] font-normal text-hs-brown">{row.detail}</span> : null}
              </span>
              <span className="hsx-num shrink-0 font-bold">{figure(row.value)}</span>
            </div>
            <div className="h-[calc(var(--u)*1)] border-[length:calc(var(--line)*0.5)] border-hs-ink bg-hs-sand">
              <div className={cn("h-full", fill)} style={{ width: `${Math.max(row.share * 100, 1)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Columns over time. Night buckets sit on a darker band; only the peak is labelled. */
export function Columns({ values, labels, night, fill, unit, tickEvery }: {
  values: number[]; labels: string[]; night?: boolean[]; fill: string; unit: string; tickEvery: number;
}) {
  const max = Math.max(...values, 0);
  if (max === 0) {
    return <Empty />;
  }
  const peak = values.indexOf(max);
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 items-stretch border-b-[length:calc(var(--line)*0.5)] border-hs-ink">
        {values.map((value, index) => (
          <div
            key={labels[index]}
            className={cn("relative flex min-w-0 flex-1 flex-col justify-end px-[calc(var(--u)*0.14)] pt-[calc(var(--u)*1.7)]", night?.[index] && "bg-hs-sand")}
            title={`${labels[index]}: ${figure(value)} ${unit}`}
          >
            <div className="relative" style={{ height: `${(value / max) * 100}%` }}>
              {index === peak ? (
                <span className={cn("hsx-sm hsx-num absolute bottom-full mb-[calc(var(--u)*0.25)] font-bold whitespace-nowrap", peak > values.length / 2 ? "right-0" : "left-0")}>
                  {figure(value)} {unit} · {labels[index]}
                </span>
              ) : null}
              <div className={cn("h-full w-full", fill)} />
            </div>
          </div>
        ))}
      </div>
      <div className="hsx-xs hsx-num flex pt-[calc(var(--u)*0.4)] font-semibold text-hs-brown">
        {labels.map((label, index) => (
          <span key={label} className="min-w-0 flex-1 whitespace-nowrap">{index % tickEvery === 0 ? label : ""}</span>
        ))}
      </div>
    </div>
  );
}

export function stampOf(summary: ClosingSummary, demo: boolean): string {
  const at = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(summary.generatedAt);
  return demo ? "Datos de demostración" : `Datos a las ${at}`;
}

function HeroSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  return (
    <Frame title="HackSpain en cifras" kicker={summary.hours > 0 ? `${summary.hours} horas construyendo` : "El finde en números"} stamp={stamp}>
      <div className="grid h-full grid-cols-4 grid-rows-2 gap-[var(--line)]">
        {summary.hero.map((stat, index) => (
          <Stat key={stat.label} label={stat.label} value={figure(stat.value)} className={tone(index + 1)} />
        ))}
      </div>
    </Frame>
  );
}

function PulseSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  const { timeline, usage } = summary;
  return (
    <Frame title="El pulso del finde" kicker="Actividad hora a hora · franja oscura = madrugada" stamp={stamp}>
      <div className="grid h-full grid-cols-[minmax(0,3.4fr)_minmax(0,1fr)] gap-[var(--line)]">
        <div className="grid min-h-0 grid-rows-2 gap-[var(--line)]">
          <Panel title="Tokens de IA" note={`${figure(usage.tokens)} en total`}>
            <Columns values={timeline.tokens} labels={timeline.labels} night={timeline.night} fill="bg-hs-orange" unit="tokens" tickEvery={3} />
          </Panel>
          <Panel title="Pushes y pull requests" note={`${figure(timeline.github.reduce((sum, value) => sum + value, 0))} en total`}>
            <Columns values={timeline.github} labels={timeline.labels} night={timeline.night} fill="bg-hs-navy" unit="eventos" tickEvery={3} />
          </Panel>
        </div>
        <div className="grid min-h-0 grid-rows-3 gap-[var(--line)]">
          <Stat label="De madrugada" value={percent(timeline.nightShare)} detail="de los tokens, entre las 00 y las 07" className="bg-hs-navy text-hs-paper" />
          <Stat label="Sesiones de IA" value={figure(usage.sessions)} detail={`${figure(usage.requests)} peticiones`} className="bg-hs-gold" />
          <Stat label="Desde caché" value={percent(usage.cachedShare)} detail="de todos los tokens" className="bg-hs-teal text-hs-paper" />
        </div>
      </div>
    </Frame>
  );
}

function ToolsSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  return (
    <Frame title="Con qué programasteis" kicker="Tokens por herramienta y por modelo" stamp={stamp}>
      <div className="grid h-full grid-cols-2 gap-[var(--line)]">
        <Panel title="Herramientas"><HBars rows={summary.harnesses} fill="bg-hs-orange" /></Panel>
        <Panel title="Modelos"><HBars rows={summary.models} fill="bg-hs-teal" /></Panel>
      </div>
    </Frame>
  );
}

function StackSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  const { stacks } = summary;
  return (
    <Frame title="De qué están hechos" kicker="Tecnologías por número de proyectos" stamp={stamp}>
      <div className="grid h-full grid-cols-[minmax(0,3.4fr)_minmax(0,1fr)] gap-[var(--line)]">
        <Panel title="El stack de HackSpain"><HBars rows={stacks.rows} fill="bg-hs-navy" columns={2} /></Panel>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-[var(--line)]">
          <Stat label="Proyectos con stack" value={figure(stacks.total)} className="bg-hs-gold" />
          <Stat label="Leídos del repo" value={stacks.total > 0 ? percent(stacks.auto / stacks.total) : "0 %"} detail="detectados automáticamente" className="bg-hs-orange" />
          <Diagonal bg="bg-hs-red" tri="bg-hs-paper" corner="br" />
        </div>
      </div>
    </Frame>
  );
}

function FeedSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  const { feed } = summary;
  const hours = feed.byHour.map((_, hour) => `${String(hour).padStart(2, "0")} h`);
  return (
    <Frame title="El feed no durmió" kicker={`${figure(feed.authors)} personas publicaron`} stamp={stamp}>
      <div className="grid h-full grid-cols-4 grid-rows-[minmax(0,1fr)_minmax(0,1.25fr)] gap-[var(--line)]">
        <Stat label="Posts" value={figure(feed.posts)} className="bg-hs-gold" />
        <Stat label="Memes" value={figure(feed.memes)} className="bg-hs-red text-hs-paper" />
        <Stat label="Reacciones" value={figure(feed.reactions)} className="bg-hs-teal text-hs-paper" />
        <Stat label="Comentarios" value={figure(feed.comments)} className="bg-hs-navy text-hs-paper" />
        <Panel title="A qué hora se publicaba" className="col-span-3">
          <Columns values={feed.byHour} labels={hours} night={hours.map((_, hour) => hour < 7)} fill="bg-hs-red" unit="posts" tickEvery={3} />
        </Panel>
        <Panel title="Reacciones top">
          {feed.emojis.length === 0 ? <Empty /> : (
            <ul className="grid h-full grid-cols-2 gap-[calc(var(--u)*0.6)]" style={{ gridTemplateRows: `repeat(${Math.ceil(feed.emojis.length / 2)}, minmax(0, 1fr))` }}>
              {feed.emojis.map((row) => (
                <li key={row.emoji} className="flex items-center gap-[calc(var(--u)*0.7)]">
                  <span className="text-[calc(var(--u)*2.6)] leading-none">{row.emoji}</span>
                  <span className="hsx-num hsx-lg font-bold">{figure(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Frame>
  );
}

function TracksSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  const { tracks } = summary;
  return (
    <Frame title="Los retos" kicker="Proyectos entregados por reto · un proyecto puede ir a varios" stamp={stamp}>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,3.4fr)] gap-[var(--line)]">
        <div className="grid min-h-0 grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)] gap-[var(--line)]">
          <Stat label="Proyectos entregados" value={figure(tracks.total)} className="bg-hs-gold" />
          <Diagonal bg="bg-hs-teal" tri="bg-hs-orange" corner="tl" />
        </div>
        <Panel title="Entregas por reto"><HBars rows={tracks.rows} fill="bg-hs-teal" columns={tracks.rows.length > 7 ? 2 : 1} /></Panel>
      </div>
    </Frame>
  );
}

function AwardsSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  return (
    <Frame title="Menciones de honor" kicker="Lo que dicen los datos, no el jurado" stamp={stamp}>
      {summary.awards.length === 0 ? <div className="h-full bg-hs-paper"><Empty /></div> : (
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-[var(--line)]">
          {summary.awards.map((award, index) => (
            <div key={award.title} className={cn("flex min-w-0 flex-col justify-between", PAD, tone(index))}>
              <div className="flex items-start justify-between gap-[calc(var(--u)*1)]">
                <p className="hsx-label">{award.title}</p>
                <Face name={award.team} src={award.logoUrl} logo className="h-[calc(var(--u)*5.5)] text-[calc(var(--u)*2.4)] text-hs-ink" />
              </div>
              <div className="min-w-0">
                <p className="hsx-title line-clamp-2 text-[calc(var(--u)*3)] break-words">{award.team}</p>
                <p className="hsx-lg mt-[calc(var(--u)*0.7)] font-semibold">{award.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

function PeopleSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  return (
    <Frame title="Quién quemó más" kicker="Tokens por persona · solo el podio, nadie más sale de aquí" stamp={stamp}>
      <Panel title="Personas por tokens" className="h-full"><HBars rows={summary.people} fill="bg-hs-orange" /></Panel>
    </Frame>
  );
}

function BurnerSlide({ summary, stamp }: { summary: ClosingSummary; stamp: string }) {
  const { burner } = summary;
  if (!burner) {
    return <Frame title="Mención especial" kicker="Máximo quemador de tokens" stamp={stamp}><div className="h-full bg-hs-paper"><Empty /></div></Frame>;
  }
  const facts = burnerFacts(burner);
  return (
    <Frame title={`¿Pero quién es ${burner.name}?`} kicker="Mención especial · máximo quemador de tokens" stamp={stamp}>
      <div className="grid h-full grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_minmax(0,1.05fr)] gap-[var(--line)]">
        <div className="flex min-h-0 items-center justify-center bg-hs-gold">
          <Mugshot burner={burner} className="w-[72%] text-[calc(var(--u)*2.4)]" />
        </div>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-[var(--line)]">
          <div className={cn("flex min-w-0 flex-col justify-between bg-hs-paper", PAD)}>
            <div className="min-w-0">
              <p className="hsx-xl font-bold text-hs-brown">Nadie:</p>
              <p className="hsx-xl font-bold text-hs-brown">Absolutamente nadie:</p>
              <p className="hsx-title mt-[calc(var(--u)*0.9)] line-clamp-2 text-[calc(var(--u)*3.2)] break-words">{burner.name}:</p>
              {burner.team ? <p className="hsx-lg mt-[calc(var(--u)*0.5)] truncate font-semibold text-hs-brown">del equipo {burner.team}</p> : null}
            </div>
            <div>
              <p className={cn(NUMBER, "text-[calc(var(--u)*8.5)]")}>{figure(burner.tokens)}</p>
              <p className="hsx-xl mt-[calc(var(--u)*0.6)] font-bold">tokens. Una sola persona.</p>
            </div>
          </div>
          <p className={cn("hsx-lg bg-hs-red leading-tight font-bold text-hs-paper", PAD)}>{BURNER_CALL}</p>
        </div>
        <div className="grid min-h-0 gap-[var(--line)]" style={{ gridTemplateRows: `repeat(${facts.length}, minmax(0, 1fr))` }}>
          {facts.map((fact, index) => (
            <div key={fact.label} className={cn("flex min-w-0 flex-col justify-center gap-[calc(var(--u)*0.5)]", PAD, tone(index + 2))}>
              <p className={cn(NUMBER, "text-[calc(var(--u)*3.4)]")}>{fact.value}</p>
              <p className="hsx-md leading-tight font-semibold">{fact.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export const CLOSING_SLIDES = [
  { id: "cifras", render: HeroSlide },
  { id: "pulso", render: PulseSlide },
  { id: "herramientas", render: ToolsSlide },
  { id: "stack", render: StackSlide },
  { id: "feed", render: FeedSlide },
  { id: "retos", render: TracksSlide },
  { id: "menciones", render: AwardsSlide },
  { id: "personas", render: PeopleSlide },
  { id: "quemador", render: BurnerSlide },
] as const;

export function ClosingSlide({ index, summary, demo }: { index: number; summary: ClosingSummary; demo: boolean }) {
  const slide = CLOSING_SLIDES[index];
  if (!slide) {
    return null;
  }
  const Render = slide.render;
  return <Render summary={summary} stamp={stampOf(summary, demo)} />;
}
