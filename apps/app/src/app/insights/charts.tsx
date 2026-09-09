"use client";

// Adapted from Amicro Mono Charts by Syed Subhan Uddin (MIT).
// https://github.com/Subhan-code/Amicro--Micro-transitions-
// License: ./AMICRO-LICENSE.txt
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import {
  compact,
  HARNESSES,
  number,
  percent,
  sumSamples,
  timeLabel,
} from "./mock-data";
import type {
  HarnessId,
  HarnessRow,
  Metric,
  Sample,
  TeamRow,
} from "./mock-data";

const INK = "#1e3958";
const AXIS = { fill: "#4a2c1f", fontSize: 11 };
const GRID = "#1e395814";
const STAGE = "rounded-2xl bg-hs-navy/[0.035] p-3 sm:p-4";

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload.length) {
    return null;
  }
  const point: unknown = payload[0]?.payload;
  const title =
    point &&
    typeof point === "object" &&
    "name" in point &&
    typeof point.name === "string"
      ? point.name
      : label;
  return (
    <div className="min-w-40 rounded-xl border border-hs-navy/10 bg-hs-paper px-3 py-2.5 text-xs shadow-lg">
      {title === null || title === undefined ? null : (
        <p className="mb-2 font-semibold text-hs-ink">{title}</p>
      )}
      <dl className="space-y-1.5">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-5"
          >
            <dt className="flex items-center gap-2 text-hs-brown">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color ?? INK }}
              />
              {entry.name}
            </dt>
            <dd className="font-mono font-semibold tabular-nums">
              {typeof entry.value === "number" ? number(entry.value) : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Sparkline({
  values,
  color = "#35858a",
}: {
  values: number[];
  color?: string;
}) {
  return (
    <div className="h-10 w-24 shrink-0" aria-hidden>
      <LineChart
        width={96}
        height={40}
        data={values.map((value) => ({ value }))}
        margin={{ bottom: 4, left: 2, right: 2, top: 4 }}
        accessibilityLayer={false}
      >
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}

export function ActivityChart({
  samples,
  metric,
  mode = "interactive",
}: {
  samples: Sample[];
  metric: Metric;
  mode?: "interactive" | "tv";
}) {
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const buckets = [...new Set(samples.map((sample) => sample.bucket))];
  const rows = buckets.map((bucket) => {
    const group = samples.filter((sample) => sample.bucket === bucket);
    return {
      bucket,
      label: timeLabel(bucket),
      ...Object.fromEntries(
        HARNESSES.map((harness) => [
          harness.id,
          sumSamples(group.filter((sample) => sample.harness === harness.id))[
            metric
          ],
        ])
      ),
      totals: sumSamples(group),
    };
  });
  const selected =
    rows.find((row) => row.bucket === selectedBucket) ?? rows.at(-1);
  const unit = metric === "tokens" ? "tokens" : "commits";
  const activeTools = HARNESSES.filter((harness) =>
    samples.some(
      (sample) => sample.harness === harness.id && sample[metric] > 0
    )
  );
  return (
    <div className={mode === "tv" ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className={mode === "tv" ? "min-h-0 flex-1" : STAGE}>
        <ResponsiveContainer width="100%" height={mode === "tv" ? "100%" : 248} minWidth={0}>
          <BarChart
            data={rows}
            margin={{ bottom: 0, left: -12, right: 0, top: 12 }}
            barCategoryGap="26%"
            accessibilityLayer
            aria-label={`${unit} por intervalos de 30 minutos. Usa las flechas para explorar.`}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              vertical={false}
              stroke={GRID}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={AXIS}
              minTickGap={35}
              tickMargin={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS}
              tickFormatter={compact}
              width={58}
              tickCount={5}
              allowDecimals={metric === "tokens"}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: "#1e39580a", radius: 6 }}
              isAnimationActive={false}
            />
            {activeTools.map((harness, index) => (
              <Bar
                key={harness.id}
                dataKey={harness.id}
                name={harness.name}
                stackId="harness"
                fill={harness.color}
                maxBarSize={32}
                radius={
                  index === activeTools.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]
                }
                isAnimationActive={false}
                onClick={(_, rowIndex) =>
                  setSelectedBucket(rows[rowIndex]?.bucket ?? null)
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {selected && mode !== "tv" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 text-hs-brown">
            Intervalo
            <select
              className="min-h-10 rounded-lg border-2 border-hs-ink/25 bg-transparent px-2 font-mono text-xs text-hs-ink outline-offset-2 focus-visible:outline-hs-navy"
              value={selected.bucket}
              onChange={(event) =>
                setSelectedBucket(Number(event.target.value))
              }
            >
              {rows.map((row) => (
                <option key={row.bucket} value={row.bucket}>
                  {row.label}–{timeLabel(row.bucket + 1)}
                </option>
              ))}
            </select>
          </label>
          <span className="font-semibold tabular-nums">
            {number(selected.totals[metric])} {unit}{" "}
            <span className="mx-1 text-hs-brown/50">/</span>{" "}
            {number(selected.totals.sessions)} sesiones
          </span>
        </div>
      ) : null}
      <div className={mode === "tv" ? "mt-[0.4cqw] flex shrink-0 flex-wrap gap-x-[0.8cqw] gap-y-1 [&>span]:text-[0.7cqw]" : "mt-3 flex flex-wrap gap-x-4 gap-y-2"}>
        {activeTools.map((harness) => (
          <span
            key={harness.id}
            className="flex items-center gap-1.5 text-[11px] text-hs-brown"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: harness.color }}
            />
            {harness.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UsageDonut({
  rows,
  metric,
  onExplore,
}: {
  rows: HarnessRow[];
  metric: "tokens" | "sessions";
  onExplore: (id: HarnessId) => void;
}) {
  const [hovered, setHovered] = useState<HarnessId | null>(null);
  const data = rows.filter((row) => row[metric] > 0);
  const total = data.reduce((sum, row) => sum + row[metric], 0);
  const active = data.find((row) => row.id === hovered);
  return (
    <div
      className="relative mx-auto size-44 shrink-0"
      role="group"
      aria-label={`Distribución de ${metric}: ${rows.map((row) => `${row.name} ${percent(row[metric], total)}`).join(", ")}`}
    >
      <PieChart width={176} height={176} accessibilityLayer={false}>
        <Pie
          data={data}
          dataKey={metric}
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={57}
          outerRadius={82}
          paddingAngle={4}
          cornerRadius={7}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
          shape={(props) => {
            const row = data[props.index];
            if (!row) {
              return <g />;
            }
            return (
              <Sector
                {...props}
                fill={row.color}
                className="cursor-pointer outline-none focus-visible:stroke-hs-ink focus-visible:stroke-2"
                role="button"
                tabIndex={0}
                aria-label={`Ver equipos que usan ${row.name}`}
                onMouseEnter={() => setHovered(row.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onExplore(row.id)}
                onFocus={() => setHovered(row.id)}
                onBlur={() => setHovered(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onExplore(row.id);
                  }
                }}
              />
            );
          }}
        />
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {active ? percent(active[metric], total) : compact(total)}
        </span>
        <span className="mt-1 max-w-24 text-[11px] text-hs-brown">
          {active ? active.name : metric}
        </span>
      </div>
    </div>
  );
}

function TeamPoint({
  cx,
  cy,
  team,
  onSelect,
}: {
  cx: number;
  cy: number;
  team: TeamRow;
  onSelect: (team: TeamRow) => void;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill={team.color}
      fillOpacity={0.9}
      stroke="var(--color-hs-paper)"
      strokeWidth={2}
      tabIndex={0}
      role="button"
      className="cursor-pointer outline-none hover:fill-opacity-100 focus-visible:stroke-hs-navy focus-visible:stroke-[3px]"
      aria-label={`${team.name}: ${compact(team.tokens)} tokens, ${number(team.commits)} commits. Ver equipo.`}
      onClick={() => onSelect(team)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(team);
        }
      }}
    >
      <title>{team.name}</title>
    </circle>
  );
}

export function TeamScatter({
  teams,
  onSelect,
}: {
  teams: TeamRow[];
  onSelect: (team: TeamRow) => void;
}) {
  return (
    <div>
      <div className={STAGE}>
        <div className="mb-2 flex justify-between text-[11px] text-hs-brown">
          <span>Commits</span>
          <span>Tokens →</span>
        </div>
        <ResponsiveContainer width="100%" height={248} minWidth={0}>
          <ScatterChart
            margin={{ bottom: 0, left: -12, right: 14, top: 12 }}
            accessibilityLayer
            aria-label="Consumo de tokens y commits por equipo"
          >
            <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
            <XAxis
              dataKey="tokens"
              name="Tokens"
              type="number"
              tickLine={false}
              axisLine={false}
              tick={AXIS}
              tickFormatter={compact}
              tickMargin={12}
              minTickGap={30}
              domain={[0, (max: number) => Math.ceil(max * 1.12)]}
            />
            <YAxis
              dataKey="commits"
              name="Commits"
              type="number"
              tickLine={false}
              axisLine={false}
              tick={AXIS}
              width={48}
              allowDecimals={false}
              domain={[0, (max: number) => Math.ceil(max * 1.12)]}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ stroke: "#1e395840", strokeDasharray: "3 3" }}
              isAnimationActive={false}
            />
            <Scatter
              name="Equipos"
              data={teams}
              fill={INK}
              isAnimationActive={false}
              shape={(props: unknown) => {
                if (
                  !props ||
                  typeof props !== "object" ||
                  !("cx" in props) ||
                  !("cy" in props) ||
                  typeof props.cx !== "number" ||
                  typeof props.cy !== "number" ||
                  !("payload" in props)
                ) {
                  return <g />;
                }
                const payload: unknown = props.payload;
                const team =
                  payload && typeof payload === "object" && "id" in payload
                    ? teams.find((item) => item.id === payload.id)
                    : undefined;
                return team ? (
                  <TeamPoint
                    cx={props.cx}
                    cy={props.cy}
                    team={team}
                    onSelect={onSelect}
                  />
                ) : (
                  <g />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-pretty text-hs-brown">
        Cada punto es un equipo. Selecciónalo para explorarlo. Consumo y
        actividad no miden la calidad del proyecto.
      </p>
    </div>
  );
}
