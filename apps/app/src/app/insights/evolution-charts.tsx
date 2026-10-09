"use client";

// Adapted from Amicro Mono Charts: Stream, Composed, Step, Heatmap and Bullet (MIT).
// https://github.com/Subhan-code/Amicro--Micro-transitions-
// License: MIT, see THIRD_PARTY_NOTICES.md at the repository root.
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HARNESSES,
  bucketSpan,
  compact,
  minuteLabel,
  number,
  sumSamples,
} from "./mock-data";
import type { Sample, Timeline } from "./mock-data";

const TICK = { fill: "#4a2c1f", fontSize: 11 };
const TOOLTIP = {
  background: "#f4ecd8",
  border: "1px solid #1e395826",
  borderRadius: 12,
  fontSize: 12,
};
const STAGE = "rounded-2xl bg-hs-navy/[0.035] px-2 pt-4 sm:px-4";
export function ConsumptionChart({
  samples,
  color,
  timeline,
}: {
  samples: Sample[];
  color: string;
  timeline: Timeline;
}) {
  const [view, setView] = useState("harnesses");
  const bucketMinutes = timeline.bucketMinutes;
  const perHour = 60 / bucketMinutes;
  const totalMinutes = bucketMinutes * 24;
  const ticks = Array.from(
    { length: 7 },
    (_, index) => (totalMinutes / 6) * index
  );
  const clock = (minutes: number) => minuteLabel(minutes, timeline);
  const buckets = Array.from({ length: 24 }, (_, bucket) => {
    const rows = samples.filter((sample) => sample.bucket === bucket);
    return {
      minute: bucket * bucketMinutes + bucketMinutes / 2,
      rate: sumSamples(rows).tokens * perHour,
      ...Object.fromEntries(
        HARNESSES.map((harness) => [
          harness.id,
          sumSamples(rows.filter((sample) => sample.harness === harness.id))
            .tokens * perHour,
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
              domain={[0, totalMinutes]}
              ticks={ticks}
              tickFormatter={clock}
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
            <Tooltip
              contentStyle={TOOLTIP}
              labelFormatter={(value) =>
                `${clock(Number(value) - bucketMinutes / 2)}–${clock(Number(value) + bucketMinutes / 2)}`
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
                  <Cell key={row.minute} fill={color} fillOpacity={0.35} />
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
            <span>Barras · intervalos de {bucketSpan(timeline)}</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-4" style={{ backgroundColor: color }} />
              Línea · media de los tres últimos intervalos disponibles
            </span>
          </>
        )}
      </div>
    </div>
  );
}
