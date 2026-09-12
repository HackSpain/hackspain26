"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityChart, Sparkline, TeamScatter } from "@/app/insights/charts";
import { technologyRows } from "@/app/insights/event-data";
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

function TvInsightPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-[0.7cqw] border border-hs-paper/15 bg-hs-paper p-[1cqw] text-hs-ink">
      <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hs-ink/15 pb-[0.6cqw]">
        <h2 className="font-bungee text-[1.05cqw] leading-tight">{title}</h2>
        <p className="text-[0.7cqw] text-hs-brown">{subtitle}</p>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
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
        "flex min-w-0 flex-col justify-between border border-hs-ink/15 bg-hs-paper p-[1cqw]",
        highlight && "bg-hs-gold",
      )}
    >
      <p className="text-[0.85cqw] font-semibold tracking-wide text-hs-brown uppercase">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="font-sans text-[2.8cqw] leading-none font-black tracking-[-0.06em] tabular-nums">
          {value}
        </p>
        <Sparkline values={trend} color={highlight ? "#4a2c1f" : "#35858a"} />
      </div>
      <p className="border-t border-hs-ink/15 pt-[0.45cqw] text-[0.75cqw] text-hs-brown">
        {detail}
      </p>
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
    <div className="grid h-full grid-cols-4 gap-[0.7cqw]">
      <MiniStat
        label="Tokens procesados"
        value={compact(totals.tokens)}
        detail={`${percent(totals.cachedTokens, totals.tokens)} reutilizados desde caché`}
        trend={trend("tokens")}
        highlight
      />
      <MiniStat
        label="Commits publicados"
        value={number(totals.commits)}
        detail={`${teams.length} equipos · ${number(totals.commits / Math.max(teams.length, 1))} commits por equipo`}
        trend={trend("commits")}
      />
      <MiniStat
        label="Sesiones de agentes"
        value={number(totals.sessions)}
        detail={`${tools.filter((tool) => tool.sessions > 0).length} herramientas en uso`}
        trend={trend("sessions")}
      />
      <MiniStat
        label="Pull requests"
        value={number(totals.pullRequests)}
        detail="Contribuciones durante el evento"
        trend={trend("pullRequests")}
      />
    </div>
  );
}

export function InsightsActivityBox() {
  const { samples } = useInsightSnapshot();
  return (
    <TvInsightPanel
      title="El pulso del evento"
      subtitle="Tokens · intervalos de 30 min"
    >
      <ActivityChart samples={samples} metric="tokens" mode="tv" />
    </TvInsightPanel>
  );
}

export function InsightsHarnessBox() {
  const { tools } = useInsightSnapshot();
  const sorted = [...tools].sort((a, b) => b.tokens - a.tokens);
  const total = sorted.reduce((sum, row) => sum + row.tokens, 0);
  return (
    <TvInsightPanel title="Herramientas de IA" subtitle="Cuota de tokens">
      <div className="grid h-full grid-cols-2 content-between gap-x-[2cqw] gap-y-[0.5cqw]">
        {sorted.map((row) => (
          <div key={row.id} className="space-y-[0.25cqw]">
            <div className="flex items-center justify-between text-[0.85cqw]">
              <span className="font-semibold">{row.name}</span>
              <span className="tabular-nums text-hs-brown">
                {percent(row.tokens, total)}
              </span>
            </div>
            <div className="h-[0.25cqw] bg-hs-ink/5">
              <div
                className="h-full"
                style={{
                  width: `${total ? (row.tokens / total) * 100 : 0}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </TvInsightPanel>
  );
}

export function InsightsStacksBox() {
  const { teams } = useInsightSnapshot();
  const rows = technologyRows(
    teams.map((team) => team.id),
    "all",
  ).slice(0, 5);
  return (
    <TvInsightPanel
      title="Con qué construimos"
      subtitle="Tecnologías · equipos"
    >
      <div className="grid h-full grid-cols-2 content-between gap-x-[2cqw] gap-y-[0.5cqw]">
        {rows.map((row) => (
          <div key={row.name} className="space-y-[0.25cqw]">
            <div className="flex items-center justify-between text-[0.85cqw]">
              <span className="font-semibold">{row.name}</span>
              <span className="tabular-nums text-hs-brown">
                {row.teams.length} / {teams.length}
              </span>
            </div>
            <div className="h-[0.3cqw] bg-hs-ink/5">
              <div
                className="h-full"
                style={{
                  width: `${(row.teams.length / Math.max(teams.length, 1)) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
        <p className="self-center text-[0.65cqw] text-hs-brown">
          Cada equipo puede usar varias tecnologías.
        </p>
      </div>
    </TvInsightPanel>
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
