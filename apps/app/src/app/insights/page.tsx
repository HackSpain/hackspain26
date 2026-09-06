"use client";

import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  ChartNoAxesCombined,
  GitCommitHorizontal,
  GitPullRequest,
  Search,
  Terminal,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Tabs } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Panel } from "./panel";
import { EventInsights, TechnologyStacks } from "./event-insights";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ActivityChart, Sparkline, TeamScatter, UsageDonut } from "./charts";
import {
  compact,
  filterSamples,
  getSamples,
  harnessRows,
  HARNESSES,
  number,
  percent,
  PERIODS,
  sumSamples,
  teamRows,
  TRACKS,
} from "./mock-data";
import type {
  HarnessId,
  HarnessRow,
  Metric,
  Period,
  Sample,
  TeamRow,
} from "./mock-data";

const METRICS: { id: Metric; label: string; icon: LucideIcon }[] = [
  { id: "tokens", label: "Tokens", icon: Zap },
  { id: "commits", label: "Commits", icon: GitCommitHorizontal },
  { id: "pullRequests", label: "PRs", icon: GitPullRequest },
];
const NAV = [
  { id: "overview", label: "Resumen", icon: Activity },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "evolution", label: "Evolución", icon: ChartNoAxesCombined },
];

function MetricSwitch({
  value,
  onChange,
  metrics = METRICS,
  label,
}: {
  value: Metric;
  onChange: (metric: Metric) => void;
  metrics?: typeof METRICS;
  label: string;
}) {
  return (
    <div
      className="inline-flex border border-hs-ink/25 p-0.5"
      role="group"
      aria-label={label}
    >
      {metrics.map(({ id, label: metricLabel, icon: Icon }) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex min-h-11 items-center sm:min-h-10 gap-1.5 px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-hs-navy",
            value === id
              ? "bg-hs-ink text-hs-paper"
              : "text-hs-brown hover:bg-hs-sand",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {metricLabel}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  trend: number[];
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-4 border border-hs-ink/15 p-4 sm:p-5",
        highlight && "bg-hs-gold",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-hs-brown">{label}</span>
        <Icon className="size-4 text-hs-brown" aria-hidden />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-1">
        <p className="font-sans text-4xl font-black tracking-[-0.06em] tabular-nums">
          {value}
        </p>
        <Sparkline values={trend} color={highlight ? "#4a2c1f" : "#35858a"} />
      </div>
      <p className="border-t border-hs-ink/15 pt-3 text-[11px] text-hs-brown">
        {detail}
      </p>
    </Card>
  );
}

function ToolMark({ id, small = false }: { id: HarnessId; small?: boolean }) {
  const harness = HARNESSES.find((item) => item.id === id) ?? HARNESSES[0];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-current font-mono font-bold",
        small ? "size-6 text-[9px]" : "size-8 text-[11px]",
      )}
      style={{ color: harness.color, backgroundColor: `${harness.color}12` }}
      aria-hidden
    >
      {harness.mark}
    </span>
  );
}

function HarnessUsage({
  rows,
  onExplore,
}: {
  rows: HarnessRow[];
  onExplore: (id: HarnessId) => void;
}) {
  const [metric, setMetric] = useState<"tokens" | "sessions">("tokens");
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const total = rows.reduce((sum, row) => sum + row[metric], 0);
  return (
    <Panel
      title="Uso de harnesses"
      eyebrow="Cuota por harness"
      action={
        <select
          aria-label="Métrica de uso de harnesses"
          value={metric}
          onChange={(event) =>
            setMetric(event.target.value === "sessions" ? "sessions" : "tokens")
          }
          className="min-h-11 max-w-full sm:min-h-10 border border-hs-ink/25 bg-hs-paper px-2 text-xs"
        >
          <option value="tokens">Tokens</option>
          <option value="sessions">Sesiones</option>
        </select>
      }
    >
      <div className="flex flex-col items-center justify-between gap-4 min-[400px]:flex-row">
        <UsageDonut rows={sorted} metric={metric} onExplore={onExplore} />
        <div className="max-w-28 space-y-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-hs-brown">
            <Terminal className="size-3" aria-hidden /> Más utilizado
          </span>
          <p className="font-bungee text-base leading-snug">
            {sorted[0]?.name}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {percent(sorted[0]?.[metric] ?? 0, total)}
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {sorted.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onExplore(row.id)}
            className="group block min-h-11 w-full py-1 text-left hover:bg-hs-sand/40 outline-none focus-visible:ring-2 focus-visible:ring-hs-navy"
            aria-label={`Ver equipos que usan ${row.name}`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
                <ArrowUpRight
                  className="size-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden
                />
              </span>
              <span className="font-mono tabular-nums">
                {percent(row[metric], total)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hs-navy/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${total ? (row[metric] / total) * 100 : 0}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-hs-brown">
        Selecciona un harness para ver sus equipos en el leaderboard.
      </p>
    </Panel>
  );
}

function downloadCsv(rows: TeamRow[]) {
  const fields = [
    "Equipo",
    "Proyecto",
    "Reto",
    "Tokens",
    "Commits",
    "PRs",
    "Sesiones",
  ];
  const csv = [
    fields,
    ...rows.map((row) => [
      row.name,
      row.project,
      row.track,
      row.tokens,
      row.commits,
      row.pullRequests,
      row.sessions,
    ]),
  ]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "hackspain-insights-demo.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Leaderboard({
  teams,
  samples,
  harness,
  setHarness,
  onSelect,
}: {
  teams: TeamRow[];
  samples: Sample[];
  harness: string;
  setHarness: (harness: string) => void;
  onSelect: (team: TeamRow) => void;
}) {
  const [metric, setMetric] = useState<Metric>("tokens");
  const [search, setSearch] = useState("");
  const filtered = teams
    .filter(
      (team) =>
        (harness === "all" ||
          team.primary === harness ||
          team.secondary === harness) &&
        `${team.name} ${team.project}`
          .toLocaleLowerCase("es")
          .includes(search.toLocaleLowerCase("es")),
    )
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name));
  const max = Math.max(...filtered.map((team) => team[metric]), 1);
  return (
    <Panel
      title="Leaderboard"
      eyebrow="Clasificación por tokens, commits y pull requests"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 border text-xs sm:min-h-10"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv(filtered)}
        >
          <ArrowDownToLine aria-hidden />
          Exportar CSV
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MetricSwitch
          value={metric}
          onChange={setMetric}
          label="Ordenar leaderboard por"
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-3 left-3 size-4 text-hs-brown"
              aria-hidden
            />
            <Input
              aria-label="Buscar equipo o proyecto"
              placeholder="Buscar equipo…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 border pl-9 text-sm sm:h-10 sm:w-44"
            />
          </div>
          <Select value={harness} onValueChange={setHarness}>
            <SelectTrigger
              aria-label="Filtrar equipos por harness"
              className="min-h-11 border text-sm sm:min-h-10 sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los harnesses</SelectItem>
              {HARNESSES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="[&_[data-slot=table-container]]:border [&_[data-slot=table-header]_tr]:border-b [&_[data-slot=table-header]]:bg-hs-sand/60">
        <Table className="min-w-[680px]">
          <caption className="sr-only">
            Equipos ordenados por{" "}
            {METRICS.find((item) => item.id === metric)?.label}. Datos
            simulados, sin puntuación de calidad.
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Equipo / proyecto</TableHead>
              <TableHead>Stack</TableHead>
              {METRICS.map((item) => (
                <TableHead
                  key={item.id}
                  className="text-right"
                  aria-sort={metric === item.id ? "descending" : "none"}
                >
                  <button
                    type="button"
                    onClick={() => setMetric(item.id)}
                    className="inline-flex min-h-11 items-center gap-1"
                    aria-label={`Ordenar por ${item.label}`}
                  >
                    {item.label}
                    {metric === item.id ? (
                      <ArrowDown className="size-3" aria-hidden />
                    ) : null}
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-right">Actividad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((team, index) => (
              <TableRow
                key={team.id}
                className={cn(
                  "group hover:bg-hs-sand/30",
                  index === 0 && "bg-hs-gold/10",
                )}
              >
                <TableCell className="text-center">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center font-mono text-xs",
                      index === 0 ? "bg-hs-gold font-bold" : "text-hs-brown",
                    )}
                  >
                    {index === 0 ? (
                      <Trophy className="size-4" aria-label="Primer puesto" />
                    ) : (
                      index + 1
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="flex min-h-12 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-hs-navy"
                    onClick={() => onSelect(team)}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center border border-hs-ink/15 font-mono text-xs font-bold"
                      style={{
                        backgroundColor: `${team.color}18`,
                        color: team.color,
                      }}
                    >
                      {team.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <span className="block text-[13px] font-bold group-hover:underline">
                        {team.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-hs-brown">
                        {team.project} <span className="px-1">·</span>{" "}
                        {team.track}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {[team.primary, team.secondary].map((id) => (
                      <span
                        key={id}
                        title={HARNESSES.find((item) => item.id === id)?.name}
                      >
                        <ToolMark id={id} small />
                        <span className="sr-only">
                          {HARNESSES.find((item) => item.id === id)?.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </TableCell>
                {METRICS.map((item) => (
                  <TableCell
                    key={item.id}
                    className={cn(
                      "text-right font-mono text-xs tabular-nums",
                      metric === item.id && "font-bold text-hs-navy",
                    )}
                  >
                    <span>
                      {item.id === "tokens"
                        ? compact(team.tokens)
                        : number(team[item.id])}
                    </span>
                    {metric === item.id ? (
                      <span className="mt-1.5 ml-auto block h-1 w-14 bg-hs-sand">
                        <span
                          className="block h-full bg-hs-teal"
                          style={{ width: `${(team[metric] / max) * 100}%` }}
                        />
                      </span>
                    ) : null}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end">
                    <Sparkline
                      color={team.color}
                      values={[
                        ...new Set(samples.map((sample) => sample.bucket)),
                      ]
                        .slice(-8)
                        .map(
                          (bucket) =>
                            sumSamples(
                              samples.filter(
                                (sample) =>
                                  sample.teamId === team.id &&
                                  sample.bucket === bucket,
                              ),
                            )[metric],
                        )}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filtered.length === 0 ? (
        <div className="border border-t-0 border-hs-ink/25 px-5 py-8 text-center">
          <Search className="mx-auto mb-3 size-5 text-hs-brown" aria-hidden />
          <p className="font-semibold">No hay equipos con estos filtros.</p>
          <button
            type="button"
            className="mt-2 min-h-11 text-sm underline underline-offset-4"
            onClick={() => {
              setSearch("");
              setHarness("all");
            }}
          >
            Limpiar búsqueda y harness
          </button>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-hs-brown">
        <span>
          {filtered.length} de {teams.length} equipos · Pulsa un equipo para ver
          su ficha.
        </span>
        <span>Volumen de actividad, no puntuación del jurado.</span>
      </div>
    </Panel>
  );
}

function TeamDetails({ team, samples }: { team: TeamRow; samples: Sample[] }) {
  const tools = harnessRows(
    samples.filter((sample) => sample.teamId === team.id),
  )
    .filter((row) => row.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  return (
    <>
      <DialogHeader>
        <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-hs-brown">
          Ficha de equipo · datos simulados
        </p>
        <DialogTitle>{team.name}</DialogTitle>
        <DialogDescription>
          {team.project} · {team.track} · {team.members} personas
        </DialogDescription>
      </DialogHeader>
      <p className="border-y border-hs-ink/15 py-4 leading-relaxed">
        {team.description}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {METRICS.map((metric) => (
          <div
            key={metric.id}
            className="border border-hs-ink/20 bg-hs-sand/40 p-3"
          >
            <metric.icon className="mb-3 size-4 text-hs-brown" aria-hidden />
            <p className="text-xl font-bold tabular-nums">
              {metric.id === "tokens"
                ? compact(team.tokens)
                : number(team[metric.id])}
            </p>
            <p className="mt-1 text-[11px] text-hs-brown">{metric.label}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-3 text-xs">Harnesses del equipo</h3>
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center gap-3 border-t border-hs-ink/10 py-3"
          >
            <ToolMark id={tool.id} />
            <div className="flex-1">
              <p className="font-semibold">{tool.name}</p>
              <p className="text-xs text-hs-brown">
                {number(tool.sessions)} sesiones · {number(tool.commits)}{" "}
                commits
              </p>
            </div>
            <span className="font-mono text-xs">
              {percent(tool.tokens, team.tokens)}
            </span>
          </div>
        ))}
      </div>
      <p className="bg-hs-sand/60 p-3 text-xs text-hs-brown">
        {percent(team.cachedTokens, team.tokens)} de tokens desde caché. Los
        valores corresponden al periodo seleccionado.
      </p>
    </>
  );
}

export function InsightsView({
  showBackLink = true,
}: {
  showBackLink?: boolean;
}) {
  // TODO: Replace simulated insights with real event data, including usage,
  // concurrent agents, team milestones, and declared technology stacks.
  const [activeTab, setActiveTab] = useState("overview");
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const leaderboardTabRef = useRef<HTMLButtonElement | null>(null);
  const [period, setPeriod] = useState<Period>("event");
  const [track, setTrack] = useState("all");
  const [tick, setTick] = useState(0);
  const [chartMetric, setChartMetric] = useState<Metric>("tokens");
  const [harness, setHarness] = useState("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function syncTabFromHash() {
      const tab = NAV.find((item) => `#${item.id}` === window.location.hash);
      setActiveTab(tab?.id ?? "overview");
    }
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const allSamples = useMemo(() => getSamples(tick), [tick]);
  const samples = useMemo(
    () => filterSamples(allSamples, period, track),
    [allSamples, period, track],
  );
  const eventSamples = useMemo(
    () => filterSamples(allSamples, "event", track),
    [allSamples, track],
  );
  const eventTeams = teamRows(eventSamples);
  const totals = sumSamples(samples);
  const teams = teamRows(samples);
  const tools = harnessRows(samples);
  const detailSamples = activeTab === "evolution" ? eventSamples : samples;
  const selectedTeam = teamRows(detailSamples).find(
    (team) => team.id === selectedTeamId,
  );
  const trend = (metric: Metric | "sessions") =>
    [...new Set(samples.map((sample) => sample.bucket))].map(
      (bucket) =>
        sumSamples(samples.filter((sample) => sample.bucket === bucket))[
          metric
        ],
    );
  const topCommitTeam = [...teams].sort((a, b) => b.commits - a.commits)[0];
  const leadingTool = [...tools].sort((a, b) => b.tokens - a.tokens)[0];

  function openTeam(team: TeamRow) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelectedTeamId(team.id);
  }

  function changeTab(value: string) {
    if (!NAV.some((tab) => tab.id === value)) return;
    setActiveTab(value);
    window.history.replaceState(window.history.state, "", `#${value}`);
  }

  function exploreHarness(id: HarnessId) {
    setHarness(id);
    changeTab("leaderboard");
    leaderboardTabRef.current?.focus({ preventScroll: true });
    tabsRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="space-y-5 pb-4 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-hs-navy">
      {showBackLink ? (
        <Link
          href="/"
          className="inline-flex min-h-11 w-auto min-w-max shrink-0 items-center gap-2 text-sm font-medium whitespace-nowrap text-hs-brown underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-navy"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al dashboard
        </Link>
      ) : null}

      <div className="min-w-0 space-y-5 tabular-nums">
      <section
        className="flex flex-col items-center px-2 pt-5 pb-7 text-center sm:pt-8 sm:pb-10"
        aria-labelledby="insights-title"
      >
        <h1
          id="insights-title"
          className="max-w-4xl text-3xl leading-tight text-balance sm:text-4xl lg:text-5xl"
        >
          Insights en tiempo real
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-pretty text-hs-brown sm:text-base">
          Tokens, commits y herramientas de los equipos de HackSpain.
        </p>
      </section>

      <Tabs.Root
        value={activeTab}
        onValueChange={changeTab}
        ref={tabsRef}
        className="scroll-mt-4 space-y-5"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-hs-ink/20 pb-4 lg:flex-row lg:items-center">
          <Tabs.List
            aria-label="Secciones de insights"
            className="grid grid-cols-3 gap-1 border border-hs-ink/15 bg-hs-sand/40 p-1 sm:inline-flex"
          >
            {NAV.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger
                key={id}
                value={id}
                ref={id === "leaderboard" ? leaderboardTabRef : undefined}
                className="flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-semibold text-hs-brown outline-none hover:bg-hs-sand focus-visible:ring-2 focus-visible:ring-hs-navy data-[state=active]:bg-hs-ink data-[state=active]:text-hs-paper"
              >
                <Icon className="hidden size-4 sm:block" aria-hidden />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger
                aria-label="Filtrar insights por reto"
                className="min-h-11 border text-xs sm:min-h-10 sm:w-36"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los retos</SelectItem>
                {TRACKS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTab === "overview" || activeTab === "leaderboard" ? (
              <Select
                value={period}
                onValueChange={(value) => {
                  const option = PERIODS.find((item) => item.id === value);
                  if (option) setPeriod(option.id);
                }}
              >
                <SelectTrigger
                  aria-label="Periodo de los insights"
                  className="min-h-11 border text-xs sm:min-h-10 sm:w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <Tabs.Content
          value="overview"
          className="space-y-5 outline-none focus-visible:ring-2 focus-visible:ring-hs-navy"
        >
          <section
            aria-label="Resumen del evento"
            className="grid scroll-mt-6 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <StatCard
              label="Tokens procesados"
              value={compact(totals.tokens)}
              detail={`${percent(totals.cachedTokens, totals.tokens)} desde caché · entrada + salida`}
              icon={Zap}
              trend={trend("tokens")}
              highlight
            />
            <StatCard
              label="Commits publicados"
              value={number(totals.commits)}
              detail={`${number(totals.commits / teams.length)} de media por equipo`}
              icon={GitCommitHorizontal}
              trend={trend("commits")}
            />
            <StatCard
              label="Sesiones de agentes"
              value={number(totals.sessions)}
              detail={`${tools.filter((tool) => tool.sessions > 0).length} harnesses en uso en este periodo`}
              icon={Bot}
              trend={trend("sessions")}
            />
            <StatCard
              label="Pull requests abiertas"
              value={number(totals.pullRequests)}
              detail="Flujo de contribuciones durante el evento"
              icon={GitPullRequest}
              trend={trend("pullRequests")}
            />
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <Panel
                title="Actividad del evento"
                eyebrow="Actividad por intervalos de 30 minutos"
                action={
                  <MetricSwitch
                    value={chartMetric}
                    onChange={setChartMetric}
                    metrics={METRICS.slice(0, 2)}
                    label="Métrica del gráfico de actividad"
                  />
                }
              >
                <ActivityChart samples={samples} metric={chartMetric} />
                <div className="mt-5 flex items-start gap-3 bg-hs-teal/10 p-3">
                  <Activity
                    className="mt-0.5 size-4 shrink-0 text-hs-teal"
                    aria-hidden
                  />
                  <p className="text-xs leading-relaxed">
                    <strong>{topCommitTeam?.name}</strong> lidera en commits en
                    este periodo.{" "}
                    <span className="text-hs-brown">
                      {leadingTool?.name} concentra el{" "}
                      {percent(leadingTool?.tokens ?? 0, totals.tokens)} de los
                      tokens.
                    </span>
                  </p>
                </div>
              </Panel>
              <Panel
                title="Tokens vs. commits"
                eyebrow="Consumo y contribuciones por equipo"
              >
                <TeamScatter teams={teams} onSelect={openTeam} />
              </Panel>
            </div>
            <div className="min-w-0 space-y-5">
              <HarnessUsage rows={tools} onExplore={exploreHarness} />
              <TechnologyStacks teams={teams} />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content
          value="leaderboard"
          forceMount
          className="outline-none focus-visible:ring-2 focus-visible:ring-hs-navy data-[state=inactive]:hidden"
        >
          <Leaderboard
            teams={teams}
            samples={samples}
            harness={harness}
            setHarness={setHarness}
            onSelect={openTeam}
          />
        </Tabs.Content>

        <Tabs.Content
          value="evolution"
          className="outline-none focus-visible:ring-2 focus-visible:ring-hs-navy"
        >
          <EventInsights
            samples={eventSamples}
            teams={eventTeams}
            onSelect={openTeam}
          />
        </Tabs.Content>
      </Tabs.Root>

      <footer className="border-t border-hs-ink/20 pt-5 text-xs leading-relaxed text-pretty text-hs-brown">
        Demo con equipos, proyectos y métricas ficticios.
      </footer>

      <Dialog
        open={Boolean(selectedTeam)}
        onOpenChange={(open) => {
          if (!open) setSelectedTeamId(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          {selectedTeam ? (
            <TeamDetails team={selectedTeam} samples={detailSamples} />
          ) : (
            <DialogTitle>Equipo</DialogTitle>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  return <InsightsView />;
}
