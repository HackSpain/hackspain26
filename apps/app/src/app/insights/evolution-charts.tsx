"use client";

// Adapted from Amicro Mono Charts: Stream, Composed, Step, Heatmap and Bullet (MIT).
// https://github.com/Subhan-code/Amicro--Micro-transitions-
// License: ./AMICRO-LICENSE.txt
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HARNESSES, compact, number, sumSamples } from "./mock-data";
import type { Sample, TeamRow } from "./mock-data";
import type { concurrencyRows } from "./event-data";
import { elapsed, eventTime, MILESTONES, money, PHASES } from "./event-data";

const TICK = { fill: "#4a2c1f", fontSize: 11 };
const TOOLTIP = {
  background: "#f4ecd8",
  border: "1px solid #1e395826",
  borderRadius: 12,
  fontSize: 12,
};
const STAGE = "rounded-2xl bg-hs-navy/[0.035] px-2 pt-4 sm:px-4";
const HOURS = [0, 120, 240, 360, 480, 600, 720];

function PhaseStrip() {
  return (
    <div className="ml-[50px] mr-5 flex border-b border-hs-ink/10 text-[10px] text-hs-brown">
      {PHASES.map((phase) => (
        <span
          key={phase.id}
          className="border-b-2 py-2 text-center"
          style={{
            borderColor: phase.color,
            width: `${(phase.end - phase.start) / 7.2}%`,
          }}
        >
          {phase.name}
        </span>
      ))}
    </div>
  );
}

export function ConsumptionChart({
  samples,
  color,
}: {
  samples: Sample[];
  color: string;
}) {
  const [view, setView] = useState("harnesses");
  const buckets = Array.from({ length: 24 }, (_, bucket) => {
    const rows = samples.filter((sample) => sample.bucket === bucket);
    return {
      minute: bucket * 30 + 15,
      rate: sumSamples(rows).tokens * 2,
      ...Object.fromEntries(
        HARNESSES.map((harness) => [
          harness.id,
          sumSamples(rows.filter((sample) => sample.harness === harness.id))
            .tokens * 2,
        ])
      ),
    };
  });
  const rows = buckets.map((row, index) => {
    const window = buckets.slice(Math.max(0, index - 2), index + 1);
    return {
      ...row,
      trend:
        window.reduce((total, item) => total + item.rate, 0) / window.length,
    };
  });
  const harnesses = HARNESSES.filter((harness) =>
    samples.some((sample) => sample.harness === harness.id)
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-hs-brown">Tokens por hora</p>
        <div
          role="group"
          aria-label="Vista de consumo"
          className="inline-flex rounded-lg border border-hs-ink/15 p-1"
        >
          {[
            { id: "harnesses", label: "Por harness" },
            { id: "pace", label: "Ritmo y tendencia" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={view === option.id}
              onClick={() => setView(option.id)}
              className="min-h-9 rounded-md px-3 text-xs font-medium hover:bg-hs-sand aria-pressed:bg-hs-ink aria-pressed:text-hs-paper"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className={STAGE}>
        <PhaseStrip />
        <ResponsiveContainer width="100%" height={290} minWidth={0}>
          <ComposedChart
            data={rows}
            margin={{ bottom: 12, left: -8, right: 20, top: 20 }}
            accessibilityLayer
            aria-label={
              view === "harnesses"
                ? "Evolución de tokens por harness"
                : "Ritmo de consumo y media móvil"
            }
          >
            <CartesianGrid
              stroke="#1e395814"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              type="number"
              domain={[0, 720]}
              ticks={HOURS}
              tickFormatter={eventTime}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
              width={58}
            />
            {PHASES.map((phase) => (
              <ReferenceArea
                key={phase.id}
                x1={phase.start}
                x2={phase.end}
                fill={phase.color}
                fillOpacity={0.035}
                strokeOpacity={0}
              />
            ))}
            <Tooltip
              contentStyle={TOOLTIP}
              labelFormatter={(value) =>
                `${eventTime(Number(value) - 15)}–${eventTime(Number(value) + 15)}`
              }
              formatter={(value, name) => [
                `${number(Number(value))} tokens/h`,
                name,
              ]}
              isAnimationActive={false}
            />
            {view === "harnesses" ? (
              harnesses.map((harness) => (
                <Area
                  key={harness.id}
                  dataKey={harness.id}
                  name={harness.name}
                  type="monotone"
                  stackId="tokens"
                  stroke={harness.color}
                  fill={harness.color}
                  fillOpacity={0.55}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  isAnimationActive={false}
                />
              ))
            ) : (
              <Bar
                dataKey="rate"
                name="Ritmo del intervalo"
                radius={[6, 6, 6, 6]}
                maxBarSize={24}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.minute}
                    fill={
                      PHASES.find((phase) => row.minute < phase.end)?.color ??
                      color
                    }
                    fillOpacity={0.35}
                  />
                ))}
              </Bar>
            )}
            {view === "pace" ? (
              <Line
                dataKey="trend"
                name="Media móvil"
                type="monotone"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-hs-brown">
        {view === "harnesses" ? (
          harnesses.map((harness) => (
            <span key={harness.id} className="inline-flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: harness.color }}
              />
              {harness.name}
            </span>
          ))
        ) : (
          <>
            <span>Barras · intervalos de 30 min</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-4" style={{ backgroundColor: color }} />
              Línea · media de los últimos 90 min disponibles
            </span>
          </>
        )}
      </div>
    </div>
  );
}

type ConcurrencyRow = ReturnType<typeof concurrencyRows>[number];

export function ConcurrencyChart({
  rows,
  color,
  teams,
  onSelect,
}: {
  rows: ConcurrencyRow[];
  color: string;
  teams: TeamRow[];
  onSelect: (id: string) => void;
}) {
  const peak = Math.max(...rows.map((row) => row.total), 0);
  const matrix = teams.map((team) => ({
    team,
    values: Array.from({ length: 24 }, (_, bucket) =>
      Math.max(
        0,
        ...rows
          .slice(bucket * 30, (bucket + 1) * 30)
          .map((row) => row.counts[team.id] ?? 0)
      )
    ),
  }));
  const cellMax = Math.max(1, ...matrix.flatMap((row) => row.values));
  return (
    <div className="space-y-6">
      <div className={STAGE}>
        <div className="flex justify-between px-3 text-[11px] text-hs-brown">
          <span>Agentes activos · minuto a minuto</span>
          <span className="tabular-nums">Pico {peak}</span>
        </div>
        <ResponsiveContainer width="100%" height={260} minWidth={0}>
          <LineChart
            data={rows}
            margin={{ bottom: 12, left: -8, right: 20, top: 20 }}
            accessibilityLayer
            aria-label="Agentes simultáneos en cada minuto del evento"
          >
            <CartesianGrid
              stroke="#1e395814"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              type="number"
              domain={[0, 720]}
              ticks={HOURS}
              tickFormatter={eventTime}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={58}
              allowDecimals={false}
            />
            <ReferenceLine
              y={peak}
              stroke={color}
              strokeOpacity={0.4}
              strokeDasharray="3 4"
            />
            <Tooltip
              contentStyle={TOOLTIP}
              labelFormatter={(value) => eventTime(Number(value))}
              formatter={(value) => [number(Number(value)), "Agentes activos"]}
              isAnimationActive={false}
            />
            <Line
              dataKey="total"
              type="stepAfter"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs">
          <p className="font-semibold">Paralelismo por equipo</p>
          <p className="text-hs-brown">Máximo simultáneo en cada media hora</p>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[690px] space-y-1.5">
            <div className="ml-44 grid grid-cols-12 gap-1 pr-1 text-[10px] text-hs-brown">
              {Array.from({ length: 12 }, (_, hour) => (
                <span key={hour}>{eventTime(hour * 60)}</span>
              ))}
            </div>
            {matrix.map(({ team, values }) => (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelect(team.id)}
                className="flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-hs-sand/60"
                aria-label={`Ver evolución de ${team.name}. Pico: ${Math.max(...values)} agentes simultáneos`}
              >
                <span className="w-40 shrink-0 truncate text-[11px] font-medium">
                  {team.name}
                </span>
                <span
                  className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-1"
                  aria-hidden
                >
                  {values.map((value, bucket) => (
                    <span
                      key={bucket}
                      className="flex h-7 items-center justify-center rounded-md text-[10px] tabular-nums"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${team.color} ${8 + (value / cellMax) * 38}%, transparent)`,
                      }}
                      title={`${eventTime(bucket * 30)}–${eventTime((bucket + 1) * 30)} · ${value} agentes`}
                    >
                      {value}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-hs-brown">
          Selecciona un equipo para ver su evolución en detalle. La intensidad
          usa la misma escala para todos.
        </p>
      </div>
    </div>
  );
}

const MILESTONE_KEYS = [
  { color: "#35858a", key: "firstCommit", label: "Primer commit" },
  { color: "#1e3958", key: "firstBuild", label: "Primer build correcto" },
  { color: "#d96b2a", key: "firstDemo", label: "Primera demo desplegada" },
] as const;

export function MilestoneChart({
  teams,
  onSelect,
}: {
  teams: TeamRow[];
  onSelect: (team: TeamRow) => void;
}) {
  const rows = MILESTONES.flatMap((milestone) => {
    const team = teams.find((item) => item.id === milestone.teamId);
    return team ? [{ ...milestone, team }] : [];
  }).toSorted((a, b) => (a.firstDemo ?? Infinity) - (b.firstDemo ?? Infinity));
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {MILESTONE_KEYS.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[660px]">
          <div className="ml-44 mr-3 flex justify-between border-b border-hs-ink/10 pb-3 text-[10px] text-hs-brown">
            {HOURS.map((minute) => (
              <span key={minute}>{elapsed(minute)}</span>
            ))}
          </div>
          {rows.map((row) => (
            <button
              key={row.team.id}
              type="button"
              onClick={() => onSelect(row.team)}
              aria-label={`${row.team.name}. ${MILESTONE_KEYS.map((item) => {
                const minute = row[item.key];
                return `${item.label}: ${minute === null ? "pendiente" : elapsed(minute)}`;
              }).join(". ")}. Ver equipo.`}
              className="flex w-full items-center gap-4 rounded-lg py-3 pr-3 text-left hover:bg-hs-sand/50"
            >
              <span className="w-40 shrink-0">
                <span
                  className="block truncate text-xs font-semibold"
                  style={{ color: row.team.color }}
                >
                  {row.team.name}
                </span>
                <span className="mt-1 block text-[10px] text-hs-brown">
                  {row.firstDemo === null
                    ? "Demo pendiente"
                    : `Demo en ${elapsed(row.firstDemo)}`}
                </span>
              </span>
              <span className="relative h-10 flex-1">
                <span className="absolute inset-x-0 top-4 border-t border-dashed border-hs-ink/15" />
                <span
                  className="absolute top-3 h-2 rounded-full"
                  style={{
                    backgroundColor: `${row.team.color}28`,
                    left: `${row.firstCommit / 7.2}%`,
                    width: `${((row.firstDemo ?? row.firstBuild) - row.firstCommit) / 7.2}%`,
                  }}
                />
                {MILESTONE_KEYS.map((item) => {
                  const minute = row[item.key];
                  return minute === null ? null : (
                    <span
                      key={item.key}
                      className="absolute top-2.5 -translate-x-1/2"
                      style={{ left: `${minute / 7.2}%` }}
                      title={`${item.label}: ${elapsed(minute)}`}
                    >
                      <span
                        className="block size-3 rounded-full border-2 border-hs-paper"
                        style={{ backgroundColor: item.color }}
                      />
                      <span
                        className={`absolute left-1/2 whitespace-nowrap text-[10px] tabular-nums ${item.key === "firstCommit" ? "top-[-13px]" : "top-5 -translate-x-1/2"}`}
                        style={{ color: item.color }}
                      >
                        <span className="sr-only">{item.label}: </span>
                        {elapsed(minute)}
                      </span>
                    </span>
                  );
                })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CostChart({
  rows,
  benchmark,
  onSelect,
}: {
  rows: { team: TeamRow; cost: number }[];
  benchmark: number;
  onSelect: (team: TeamRow) => void;
}) {
  const max = Math.max(benchmark, ...rows.map((row) => row.cost), 1) * 1.08;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-hs-navy/5 px-4 py-3 text-xs">
        <span>Referencia · media entre equipos</span>
        <strong className="tabular-nums">{money(benchmark)}</strong>
      </div>
      {rows.map(({ team, cost }) => (
        <button
          key={team.id}
          type="button"
          aria-label={`Ver detalle de costes de ${team.name}`}
          onClick={() => onSelect(team)}
          className="block w-full rounded-lg p-2 text-left hover:bg-hs-sand/40"
        >
          <span className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold">{team.name}</span>
            <span className="flex shrink-0 items-center gap-4 tabular-nums">
              <span className="hidden text-hs-brown sm:inline">
                {cost >= benchmark ? "+" : "−"}
                {money(Math.abs(cost - benchmark))} vs. media
              </span>
              <strong>{money(cost)}</strong>
            </span>
          </span>
          <span className="relative block h-5 rounded-full bg-hs-sand/60">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                backgroundColor: team.color,
                width: `${(cost / max) * 100}%`,
              }}
            />
            <span
              className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-hs-ink"
              style={{ left: `${(benchmark / max) * 100}%` }}
            />
          </span>
        </button>
      ))}
      <p className="text-[11px] text-hs-brown">
        La marca vertical mantiene la media al consultar un solo equipo. Un
        mayor gasto no implica un mejor resultado.
      </p>
    </div>
  );
}
