"use client";

import { useMemo, useState } from "react";
import { Tabs } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Panel } from "./panel";
import {
  ConsumptionChart,
  ConcurrencyChart,
  MilestoneChart,
  CostChart,
} from "./evolution-charts";
import { compact, number, percent } from "./mock-data";
import type { Sample, TeamRow } from "./mock-data";
import {
  concurrencyRows,
  eventTime,
  MILESTONES,
  money,
  phaseRows,
  SNAPSHOT_MINUTE,
  technologyRows,
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

export function TechnologyStacks({ teams }: { teams: TeamRow[] }) {
  const [category, setCategory] = useState("Frontend");
  const rows = technologyRows(
    teams.map((team) => team.id),
    category
  );
  return (
    <Panel
      title="Stacks más usados"
      eyebrow="Tecnologías declaradas por los equipos"
      action={
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger
            aria-label="Categoría de tecnologías"
            className="min-h-10 border text-xs sm:w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "Frontend", "Backend", "Datos"].map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "Todas" : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold">{row.name}</span>
              <span className="text-hs-brown tabular-nums">
                {row.teams.length} equipos ·{" "}
                {percent(row.teams.length, teams.length)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hs-sand">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: row.color,
                  width: `${(row.teams.length / Math.max(teams.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-hs-brown">
        Un equipo puede utilizar varias tecnologías. No son los harnesses de sus
        agentes.
      </p>
    </Panel>
  );
}

export function EventInsights({
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
      cost: usageUsd(
        scopedSamples.filter((sample) => sample.teamId === team.id)
      ),
      team,
    }))
    .toSorted((a, b) => b.cost - a.cost);
  const meanCost = usageUsd(scopedSamples) / Math.max(scopedTeams.length, 1);
  const ratio = phases[0].hourlyTokens
    ? phases[2].hourlyTokens / phases[0].hourlyTokens
    : 0;
  const color = selectedTeam?.color ?? "#1e3958";
  const benchmark = usageUsd(samples) / Math.max(teams.length, 1);

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
            eyebrow={`${money(meanCost)} de media por equipo · ${money(usageUsd(scopedSamples))} en total`}
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
