"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityChart, Sparkline, TeamScatter, UsageDonut } from "@/app/insights/charts";
import { TechnologyStacks } from "@/app/insights/event-insights";
import { ConsumptionChart } from "@/app/insights/evolution-charts";
import { Panel } from "@/app/insights/panel";
import {
  compact,
  filterSamples,
  getSamples,
  harnessRows,
  number,
  percent,
  sumSamples,
  teamRows,
} from "@/app/insights/mock-data";
import { cn } from "@/lib/utils";

function useInsightSnapshot() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    const samples = filterSamples(getSamples(tick), "event", "all");
    return {
      samples,
      teams: teamRows(samples),
      tools: harnessRows(samples),
      totals: sumSamples(samples),
    };
  }, [tick]);
}

function MiniStat({
  label,
  value,
  detail,
  trend,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  trend: number[];
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between border-[3px] border-hs-ink/20 bg-hs-paper p-3",
        highlight && "border-hs-ink bg-hs-gold",
      )}
    >
      <p className="text-[10px] font-semibold tracking-wide text-hs-brown uppercase">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-sans text-2xl font-black tracking-[-0.06em] tabular-nums lg:text-3xl">
          {value}
        </p>
        <Sparkline values={trend} color={highlight ? "#4a2c1f" : "#35858a"} />
      </div>
      <p className="mt-2 text-[10px] text-hs-brown">{detail}</p>
    </div>
  );
}

export function InsightsStatsBox() {
  const { samples, teams, tools, totals } = useInsightSnapshot();
  const trend = (metric: "tokens" | "commits" | "sessions" | "pullRequests") =>
    [...new Set(samples.map((sample) => sample.bucket))].map(
      (bucket) =>
        sumSamples(samples.filter((sample) => sample.bucket === bucket))[
          metric
        ],
    );
  return (
    <div className="grid h-full grid-cols-2 gap-2 lg:grid-cols-4">
      <MiniStat
        label="Tokens"
        value={compact(totals.tokens)}
        detail={`${percent(totals.cachedTokens, totals.tokens)} caché`}
        trend={trend("tokens")}
        highlight
      />
      <MiniStat
        label="Commits"
        value={number(totals.commits)}
        detail={`${number(totals.commits / Math.max(teams.length, 1))} / equipo`}
        trend={trend("commits")}
      />
      <MiniStat
        label="Sesiones"
        value={number(totals.sessions)}
        detail={`${tools.filter((tool) => tool.sessions > 0).length} harnesses`}
        trend={trend("sessions")}
      />
      <MiniStat
        label="PRs"
        value={number(totals.pullRequests)}
        detail="Flujo del evento"
        trend={trend("pullRequests")}
      />
    </div>
  );
}

export function InsightsActivityBox() {
  const { samples } = useInsightSnapshot();
  return (
    <Panel
      title="Actividad del evento"
      eyebrow="Intervalos de 30 minutos"
      className="h-full overflow-hidden border-hs-ink/20 py-3"
    >
      <ActivityChart samples={samples} metric="tokens" />
    </Panel>
  );
}

export function InsightsHarnessBox() {
  const { tools } = useInsightSnapshot();
  const sorted = [...tools].sort((a, b) => b.tokens - a.tokens);
  const total = sorted.reduce((sum, row) => sum + row.tokens, 0);
  return (
    <Panel
      title="Uso de harnesses"
      eyebrow="Cuota por herramienta"
      className="h-full overflow-hidden border-hs-ink/20 py-3"
    >
      <div className="flex flex-col items-center gap-3">
        <UsageDonut rows={sorted} metric="tokens" onExplore={() => undefined} />
        <p className="font-bungee text-sm leading-snug">{sorted[0]?.name}</p>
        <p className="text-xl font-bold tabular-nums">
          {percent(sorted[0]?.tokens ?? 0, total)}
        </p>
      </div>
    </Panel>
  );
}

export function InsightsStacksBox() {
  const { teams } = useInsightSnapshot();
  return (
    <div className="h-full overflow-hidden">
      <TechnologyStacks teams={teams} />
    </div>
  );
}

export function InsightsScatterBox() {
  const { teams } = useInsightSnapshot();
  return (
    <Panel
      title="Tokens vs. commits"
      eyebrow="Consumo y contribuciones"
      className="h-full overflow-hidden border-hs-ink/20 py-3"
    >
      <TeamScatter teams={teams} onSelect={() => undefined} />
    </Panel>
  );
}

export function InsightsLeaderboardBox() {
  const { teams } = useInsightSnapshot();
  const ranked = [...teams]
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name))
    .slice(0, 8);
  return (
    <Panel
      title="Leaderboard"
      eyebrow="Por tokens · datos simulados"
      className="h-full overflow-hidden border-hs-ink/20 py-3"
    >
      <ol className="space-y-2">
        {ranked.map((team, index) => (
          <li
            key={team.id}
            className="flex items-center gap-3 border-b border-hs-ink/10 pb-2 last:border-b-0"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center font-mono text-xs",
                index === 0 ? "bg-hs-gold font-bold" : "text-hs-brown",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{team.name}</span>
              <span className="block truncate text-[11px] text-hs-brown">
                {team.project}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums">
              {compact(team.tokens)}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function InsightsEvolutionBox() {
  const { samples } = useInsightSnapshot();
  return (
    <Panel
      title="Evolución del evento"
      eyebrow="Consumo por fase · datos simulados"
      className="h-full overflow-hidden border-hs-ink/20 py-3"
    >
      <ConsumptionChart samples={samples} color="#1e3958" />
    </Panel>
  );
}

