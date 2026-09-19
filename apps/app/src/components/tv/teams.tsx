"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { NetworkCanvas } from "@/components/participant-directory/network-canvas";
import "@/components/participant-directory/connection-graph.css";
import { demoFormation, formationEvents, formationStats, toParticipants } from "@/lib/tv-teams";
import type { FormationEvent, FormationPerson } from "@/lib/tv-teams";
import { cn } from "@/lib/utils";
import { Diagonal } from "./market";
import { useClock, useTick } from "./motion";

const DEMO_STEP_MS = 2200;
const SPOTLIGHT_MS = 9000;
const SHOWN_EVENTS = 4;
const EASE = [0.22, 1, 0.36, 1] as const;

// The map is a display here: nothing to select, link or make room for.
const noLinks = () => [];
const noPanel = () => null;
function noSelect() { /* A display has nothing to select. */ }

type Log = { snapshot: FormationPerson[] | undefined; turn: number; events: FormationEvent[] };

/** The latest moves, newest first, worked out from one snapshot to the next. */
function useFormationLog(people: FormationPerson[] | undefined) {
  const [log, setLog] = useState<Log>({ events: [], snapshot: people, turn: 0 });
  if (people && people !== log.snapshot) {
    // The first snapshot is the starting point, not a wave of people joining.
    const fresh = log.snapshot ? formationEvents(log.snapshot, people, log.turn + 1) : [];
    setLog({ events: [...fresh.toReversed(), ...log.events].slice(0, 12), snapshot: people, turn: log.turn + 1 });
  }
  const latest = log.events[0]?.at;
  const [spotTurn, setSpotTurn] = useState<number>();
  useEffect(() => {
    if (latest === undefined) { return; }
    const timer = window.setTimeout(() => setSpotTurn(latest), SPOTLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [latest]);
  const spotlight = useMemo(
    () => (latest === undefined || latest === spotTurn ? null : new Set(log.events.filter((event) => event.at === latest).map((event) => event.personId))),
    [latest, spotTurn, log.events],
  );
  return { events: log.events, spotlight };
}

function Stat({ label, value, tone, children }: { label: string; value: number; tone: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col justify-center gap-[calc(var(--u)*0.4)] px-[calc(var(--u)*1.5)] leading-none", tone)}>
      <p className="hsx-label">{label}</p>
      <p className="hsx-title hsx-xl"><span key={value} className="hsx-flash hsx-num">{value}</span>{children}</p>
    </div>
  );
}

function Moves({ events }: { events: FormationEvent[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="grid h-[8.5%] shrink-0 grid-cols-[auto_minmax(0,1fr)_calc(var(--u)*9)] gap-[var(--line)]">
      <p className="hsx-title hsx-sm flex items-center bg-hs-orange px-[calc(var(--u)*1.4)] text-hs-paper">Últimos<br />movimientos</p>
      <ol className="grid min-w-0 grid-cols-4 gap-[var(--line)] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {events.slice(0, SHOWN_EVENTS).map((event) => (
            <motion.li key={event.key} layout={!reduced} initial={{ opacity: 0, x: reduced ? 0 : -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }} className="flex min-w-0 flex-col justify-center gap-[calc(var(--u)*0.3)] bg-hs-paper px-[calc(var(--u)*1.2)] text-hs-ink">
              <p className="flex min-w-0 items-center gap-[calc(var(--u)*0.6)]">
                <span className={cn("hsx-xs shrink-0 px-[calc(var(--u)*0.45)] py-[calc(var(--u)*0.1)] font-bold", event.kind === "new" ? "bg-hs-gold text-hs-ink" : "bg-hs-teal text-hs-paper")}>{event.kind === "new" ? "NUEVO EQUIPO" : "SE UNE"}</span>
                <span className="truncate font-bold">{event.person}</span>
              </p>
              <p className="hsx-title hsx-md truncate">{event.team}</p>
            </motion.li>
          ))}
        </AnimatePresence>
        {events.length === 0 ? <li className="hsx-label col-span-4 flex items-center bg-hs-paper px-[calc(var(--u)*1.4)] text-hs-ink">Busca equipo o crea el tuyo desde la app, en Equipos. Los movimientos aparecerán aquí.</li> : null}
      </ol>
      <Diagonal bg="bg-hs-gold" tri="bg-hs-red" corner="br" />
    </div>
  );
}

function TeamsStage({ people, demo }: { people: FormationPerson[] | undefined; demo: boolean }) {
  const now = useClock();
  const participants = useMemo(() => toParticipants(people ?? []), [people]);
  const stats = useMemo(() => formationStats(people ?? []), [people]);
  const { events, spotlight } = useFormationLog(people);
  return (
    <main className="h-dvh w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label="Formación de equipos en directo">
      <div className="hsx hsx-md flex h-full flex-col gap-[var(--line)] p-[var(--line)]">
        <header className="grid h-[9%] shrink-0 grid-cols-[calc(var(--u)*7)_minmax(0,1.4fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_calc(var(--u)*7)] gap-[var(--line)]">
          <Diagonal bg="bg-hs-paper" tri="bg-hs-orange" corner="tl" />
          <div className="flex items-center justify-center bg-hs-paper px-[calc(var(--u)*1.4)]">
            <Image src="/logo.svg" alt="HackSpain" width={190} height={63} priority className="h-[74%] w-auto" />
          </div>
          <p className="hsx-title hsx-lg flex items-center justify-center gap-[calc(var(--u)*0.7)] bg-hs-red px-[calc(var(--u)*1)] text-hs-paper">
            <span className="tv-pulse size-[calc(var(--u)*0.9)] shrink-0 rounded-full bg-hs-paper" />{demo ? "Demo · equipos" : "Formando equipos"}
          </p>
          <Stat label="Equipos" value={stats.teams} tone="bg-hs-gold text-hs-ink [--hsx-flash:var(--color-hs-red)]" />
          <div className="flex flex-col justify-center gap-[calc(var(--u)*0.55)] bg-hs-paper px-[calc(var(--u)*1.6)] leading-none">
            <p className="hsx-label flex justify-between"><span>Ya tienen equipo</span><span className="hsx-num font-bold text-hs-ink">{stats.placed} de {stats.total}</span></p>
            <div className="h-[calc(var(--u)*0.9)] border-[length:calc(var(--line)*0.5)] border-hs-ink bg-hs-sand" aria-hidden>
              <div className="h-full origin-left bg-hs-teal transition-transform duration-700 ease-out" style={{ transform: `scaleX(${stats.total ? stats.placed / stats.total : 0})` }} />
            </div>
          </div>
          <Stat label="Sin equipo" value={stats.loose} tone="bg-hs-orange text-hs-paper [--hsx-flash:var(--color-hs-ink)]" />
          <div className="flex flex-col items-center justify-center bg-hs-teal leading-none text-hs-paper">
            <span className="hsx-label">Madrid</span>
            <span className="hsx-title hsx-num hsx-xl mt-[calc(var(--u)*0.4)]">{now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) ?? "--:--"}</span>
          </div>
          <Diagonal bg="bg-hs-teal" tri="bg-hs-orange" corner="br" />
        </header>
        <div className="pg-stage tv-teams pointer-events-none min-h-0 flex-1" style={{ borderBottom: "none", borderTop: "none", height: "auto" }}>
          <NetworkCanvas participants={participants} lens="team" selectedId={null} matches={null} linksOf={noLinks} panelLeft={noPanel} onSelect={noSelect} live spotlight={spotlight} />
          {people && people.length === 0 ? <p className="hsx-label absolute inset-0 flex items-center justify-center">El mapa se llenará cuando llegue la gente</p> : null}
        </div>
        <Moves events={events} />
      </div>
    </main>
  );
}

function LiveTeams() {
  return <TeamsStage people={useQuery(api.tv.teamFormation)} demo={false} />;
}

function DemoTeams() {
  const step = useTick(DEMO_STEP_MS);
  const people = useMemo(() => demoFormation(step), [step]);
  return <TeamsStage people={people} demo />;
}

export function TeamsScreen({ demo = false }: { demo?: boolean }) {
  return demo ? <DemoTeams /> : <LiveTeams />;
}
