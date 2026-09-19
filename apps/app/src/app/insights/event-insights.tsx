"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Tabs } from "radix-ui";
import { api } from "@convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Panel } from "./panel";
import {
  ConsumptionChart,
  ConcurrencyChart,
  MilestoneChart,
  CostChart,
} from "./evolution-charts";
import {
  compact,
  minuteLabel,
  number,
  percent,
  sumSamples,
  timeLabel,
} from "./mock-data";
import type { Sample, TeamRow, Timeline } from "./mock-data";
import {
  concurrencyRows,
  eventTime,
  MILESTONES,
  money,
  phaseRows,
  SNAPSHOT_MINUTE,
  usageUsd,
} from "./event-data";

const VIEWS = [
  { id: "phases", label: "Consumo por fase" },
  { id: "agents", label: "Agentes simultáneos" },
  { id: "milestones", label: "Primeros hitos" },
  { id: "cost", label: "Gasto por equipo" },
];
function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="gap-2 border border-hs-ink/15 px-4 py-4">
      <p className="text-xs text-hs-brown">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-hs-brown">{detail}</p>
    </Card>
  );
}

const STACK_COLORS = ["#1e3958", "#35858a", "#d96b2a", "#8b6b9f", "#a67516", "#677558"];
const STACK_PAGE_SIZE = 8;

export function LiveTechnologyStacks() {
  const histogram = useQuery(api.stack.histogram);
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const rows = (histogram?.rows ?? []).filter(
    (row) => category === "all" || row.category === category
  );
  const total = histogram?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(rows.length / STACK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * STACK_PAGE_SIZE;
  const visibleRows = rows.slice(pageStart, pageStart + STACK_PAGE_SIZE);
  return (
    <Panel
      title="Stacks más usados"
      eyebrow="Detectado automáticamente de los repos"
    >
      {histogram === undefined ? (
        <p className="text-sm text-hs-brown">Cargando stacks…</p>
      ) : total === 0 ? (
        <p className="text-sm text-hs-brown">
          Aún no hay stacks. Se leen solos del repo (también en monorepos) al
          vincularlo con{" "}
          <code className="font-mono text-xs">hackspain team repo</code> o al
          ponerlo en el proyecto.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(0);
              }}
            >
              <SelectTrigger
                aria-label="Categoría de tecnologías"
                className="min-h-10 border text-xs sm:w-32"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["all", "Frontend", "Backend", "Datos", "Otras"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "Todas" : item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid content-start gap-x-6 gap-y-4 sm:min-h-60 sm:grid-cols-2">
            {visibleRows.map((row, index) => (
              <div key={row.name} className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 break-words font-semibold">{row.name}</span>
                  <span className="shrink-0 text-hs-brown tabular-nums">
                    {row.count} {row.count === 1 ? "equipo" : "equipos"} ·{" "}
                    {percent(row.count, total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-hs-sand">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        STACK_COLORS[(pageStart + index) % STACK_COLORS.length],
                      width: `${(row.count / Math.max(total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-hs-brown">
              Aún no hay tecnologías en esta categoría.
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hs-ink/15 pt-3">
              <p aria-live="polite" className="text-xs text-hs-brown tabular-nums">
                {pageStart + 1}–{pageStart + visibleRows.length} de {rows.length} tecnologías
              </p>
              {pageCount > 1 ? (
                <nav aria-label="Páginas de tecnologías" className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Siguiente
                  </Button>
                </nav>
              ) : null}
            </div>
          )}
        </>
      )}
      <p className="mt-5 text-[11px] leading-relaxed text-hs-brown">
        {total === 0
          ? "Datos reales del repo."
          : `${histogram?.auto ?? 0} de ${total} stacks de proyecto detectados desde GitHub; no es un recuento de repos vinculados.`}
      </p>
    </Panel>
  );
}

/**
 * What the real data supports, and nothing else. The phases, the overlapping
 * sessions, the milestones and the cost below are built for the static
 * layout (a 12-hour day, synthetic session intervals, a made-up price); on
 * real telemetry they would be inventions next to real numbers.
 */
function RealEvolution({
  samples,
  teams,
  timeline,
}: {
  samples: Sample[];
  teams: TeamRow[];
  timeline: Timeline;
}) {
  const [teamId, setTeamId] = useState("all");
  const selectedTeam = teams.find((team) => team.id === teamId);
  const scope = selectedTeam?.id ?? "all";
  const scoped = samples.filter(
    (sample) => scope === "all" || sample.teamId === scope
  );
  const totals = sumSamples(scoped);
  const perBucket = new Map<number, number>();
  for (const sample of scoped) {
    perBucket.set(
      sample.bucket,
      (perBucket.get(sample.bucket) ?? 0) + sample.tokens
    );
  }
  const [peakBucket, peakTokens] = [...perBucket].toSorted(
    (a, b) => b[1] - a[1]
  )[0] ?? [0, 0];
  const perHour = 60 / timeline.bucketMinutes;
  const active = new Set(scoped.map((sample) => sample.harness)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Evolución del evento</h2>
          <p className="mt-1 text-xs text-hs-brown">
            Desde {minuteLabel(0, timeline)} hasta{" "}
            {minuteLabel(timeline.bucketMinutes * 24, timeline)}, en tramos de{" "}
            {Math.round(timeline.bucketMinutes)} minutos. Uso reportado por
            hackspain watch.
          </p>
        </div>
        <Select value={scope} onValueChange={setTeamId}>
          <SelectTrigger
            aria-label="Equipo para analizar"
            className="min-h-11 border sm:w-56"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          label="Tokens procesados"
          value={compact(totals.tokens)}
          detail={`${compact(totals.cachedTokens)} servidos desde caché`}
        />
        <SummaryMetric
          label="Tramo más intenso"
          value={`${compact(peakTokens * perHour)}/h`}
          detail={
            peakTokens
              ? `${timeLabel(peakBucket, timeline)}–${timeLabel(peakBucket + 1, timeline)}`
              : "Sin actividad todavía"
          }
        />
        <SummaryMetric
          label="Sesiones de agentes"
          value={number(totals.sessions)}
          detail={`${active} herramientas en uso`}
        />
        <SummaryMetric
          label="Pushes y pull requests"
          value={`${number(totals.commits)} · ${number(totals.pullRequests)}`}
          detail="Actividad en los repos de los equipos"
        />
      </div>
      <Panel
        title="Ritmo de consumo"
        eyebrow={
          selectedTeam ? selectedTeam.name : "Consumo conjunto de los equipos"
        }
      >
        <ConsumptionChart
          samples={scoped}
          color={selectedTeam?.color ?? "#1e3958"}
          timeline={timeline}
        />
      </Panel>
    </div>
  );
}

export function EventInsights({
  samples,
  teams,
  onSelect,
  timeline,
}: {
  samples: Sample[];
  teams: TeamRow[];
  onSelect: (team: TeamRow) => void;
  /** A real timeline switches to the view that only shows real numbers. */
  timeline?: Timeline;
}) {
  if (timeline?.startsAt !== undefined) {
    if (samples.length === 0) {
      return (
        <Panel title="Evolución del evento" eyebrow="Actividad del evento">
          <p className="text-sm text-hs-brown">
            Sin datos de actividad todavía.
          </p>
        </Panel>
      );
    }
    return <RealEvolution samples={samples} teams={teams} timeline={timeline} />;
  }
  return <StaticEvolution samples={samples} teams={teams} onSelect={onSelect} />;
}

function StaticEvolution({
  samples,
  teams,
  onSelect,
}: {
  samples: Sample[];
  teams: TeamRow[];
  onSelect: (team: TeamRow) => void;
}) {
  const [teamId, setTeamId] = useState("all");
  const selectedTeam = teams.find((team) => team.id === teamId);
  const scope = selectedTeam?.id ?? "all";
  const scopedSamples = useMemo(
    () =>
      samples.filter((sample) => scope === "all" || sample.teamId === scope),
    [samples, scope]
  );
  const scopedTeams = teams.filter(
    (team) => scope === "all" || team.id === scope
  );
  const phases = phaseRows(scopedSamples);
  const concurrency = useMemo(
    () => concurrencyRows(scopedSamples),
    [scopedSamples]
  );
  if (samples.length === 0) {
    return (
      <Panel title="Evolución del evento" eyebrow="Actividad del evento">
        <p className="text-sm text-hs-brown">Sin datos de actividad todavía.</p>
      </Panel>
    );
  }
  const peak = Math.max(...concurrency.map((row) => row.total), 0);
  const snapshot = concurrency[SNAPSHOT_MINUTE]?.total ?? 0;
  const milestones = MILESTONES.filter((milestone) =>
    scopedTeams.some((team) => team.id === milestone.teamId)
  );
  const deployed = milestones.filter(
    (milestone) => milestone.firstDemo !== null
  );
  const costRows = scopedTeams
    .map((team) => ({
      cost: usageUsd(team),
      team,
    }))
    .toSorted((a, b) => b.cost - a.cost);
  const totalCost = usageUsd(sumSamples(scopedSamples));
  const meanCost = totalCost / Math.max(scopedTeams.length, 1);
  const ratio = phases[0].hourlyTokens
    ? phases[2].hourlyTokens / phases[0].hourlyTokens
    : 0;
  const color = selectedTeam?.color ?? "#1e3958";
  const benchmark = usageUsd(sumSamples(samples)) / Math.max(teams.length, 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Evolución del evento</h2>
          <p className="mt-1 text-xs text-hs-brown">
            Desde el inicio a las 09:00 hasta la deadline a las 21:00. Datos
            simulados.
          </p>
        </div>
        <Select value={scope} onValueChange={setTeamId}>
          <SelectTrigger
            aria-label="Equipo para analizar"
            className="min-h-11 border sm:w-56"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          label="Consumo cerca de la deadline"
          value={`${ratio.toFixed(1).replace(".", ",")}×`}
          detail="Tokens/h en demo frente al arranque"
        />
        <SummaryMetric
          label="Pico de agentes simultáneos"
          value={number(peak)}
          detail={`${number(snapshot)} activos a las ${eventTime(SNAPSHOT_MINUTE)}`}
        />
        <SummaryMetric
          label="Primera demo desplegada"
          value={`${deployed.length} / ${scopedTeams.length}`}
          detail="Equipos con un despliegue correcto"
        />
        <SummaryMetric
          label="Usage medio por equipo"
          value={money(meanCost)}
          detail="Estimación de todo el evento"
        />
      </div>
      <Tabs.Root defaultValue="phases" className="space-y-4">
        <Tabs.List
          aria-label="Métricas de evolución"
          className="flex flex-wrap gap-1 border-b border-hs-ink/15 pb-2"
        >
          {VIEWS.map((view) => (
            <Tabs.Trigger
              key={view.id}
              value={view.id}
              className="min-h-11 px-3 text-xs font-semibold text-hs-brown hover:bg-hs-sand data-[state=active]:bg-hs-ink data-[state=active]:text-hs-paper"
            >
              {view.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="phases" className="space-y-4">
          <Panel
            title="Consumo por fase"
            eyebrow={
              selectedTeam
                ? selectedTeam.name
                : "Consumo conjunto de los equipos"
            }
          >
            <ConsumptionChart samples={scopedSamples} color={color} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {phases.map((phase) => (
                <div
                  key={phase.id}
                  className="border-t-2 pt-3"
                  style={{ borderColor: phase.color }}
                >
                  <p className="text-xs font-semibold">
                    {phase.name}{" "}
                    <span className="font-normal text-hs-brown">
                      · {eventTime(phase.start)}–{eventTime(phase.end)}
                    </span>
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {compact(phase.hourlyTokens)}{" "}
                    <span className="text-xs font-normal text-hs-brown">
                      tokens/h
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-hs-brown">
                    {compact(phase.tokens)} tokens · {money(phase.cost)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-hs-brown">
              El ritmo se normaliza por hora para comparar fases de 2, 7 y 3
              horas.
            </p>
          </Panel>
        </Tabs.Content>
        <Tabs.Content value="agents">
          <Panel
            title="Agentes trabajando a la vez"
            eyebrow="Sesiones cuyos intervalos de ejecución se solapan; no sesiones acumuladas"
          >
            <ConcurrencyChart
              rows={concurrency}
              color={color}
              teams={scopedTeams}
              onSelect={setTeamId}
            />
          </Panel>
        </Tabs.Content>
        <Tabs.Content value="milestones">
          <Panel
            title="Tiempo hasta el primer hito"
            eyebrow="Tiempo transcurrido desde el inicio del evento, no desde el primer uso de una herramienta"
          >
            <MilestoneChart teams={scopedTeams} onSelect={onSelect} />
          </Panel>
        </Tabs.Content>
        <Tabs.Content value="cost">
          <Panel
            title="Gasto estimado de usage"
            eyebrow={`${money(meanCost)} de media por equipo · ${money(totalCost)} en total`}
          >
            <CostChart
              rows={costRows}
              benchmark={benchmark}
              onSelect={onSelect}
            />
          </Panel>
        </Tabs.Content>
      </Tabs.Root>
      <p className="text-[11px] leading-relaxed text-hs-brown">
        Usage simulado: 4 US$ por millón de tokens sin caché y 0,50 US$ con
        caché. No incluye suscripciones; no son tarifas de proveedores.
      </p>
    </div>
  );
}
