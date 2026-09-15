"use client";

import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { Sparkline } from "@/app/insights/charts";
import {
  compact,
  filterSamples,
  getSamples,
  HARNESSES,
  harnessRows,
  teamRows,
} from "@/app/insights/mock-data";
import { cn } from "@/lib/utils";
import { usePageVisible, usePrefersReducedMotion } from "./motion";

const MOCK_COMMITS = [
  {
    repo: "tortilla/agentos",
    actor: "ana",
    text: "feat: wire Convex auth",
    sha: "a1b2c3d",
  },
  {
    repo: "siesta/deploy",
    actor: "leo",
    text: "fix: retry failed deploys",
    sha: "c0ffee1",
  },
  {
    repo: "paella/barrio",
    actor: "marta",
    text: "docs: add README",
    sha: "bada55e",
  },
  {
    repo: "gitana/reviewmate",
    actor: "nico",
    text: "refactor: extract review agent",
    sha: "def4567",
  },
  {
    repo: "context/memory",
    actor: "ira",
    text: "feat: persist session memory",
    sha: "feedb0b",
  },
];

function useTick(ms: number) {
  const visible = usePageVisible();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), ms);
    return () => window.clearInterval(timer);
  }, [ms, visible]);
  return tick;
}

type CommitRow = {
  instance: string;
  id: string;
  repo: string;
  actor: string;
  text: string;
  sha: string;
};

export function LiveCommitsBox() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(3200);
  const remote = useQuery(api.tv.listGithubActivity);
  const source = useMemo(
    () =>
      remote && remote.length > 0
        ? remote.map((row) => ({
            id: row._id,
            repo: row.repo || "repo",
            actor: row.actor || "github",
            text: row.text,
            sha: row.sha,
          }))
        : MOCK_COMMITS.map((row, index) => ({
            id: `${row.sha}-${index}`,
            ...row,
          })),
    [remote],
  );
  const queue = useMemo(() => {
    if (source.length === 0) return [];
    const count = Math.min(6, source.length);
    const rows: CommitRow[] = [];
    for (let index = 0; index < count; index += 1) {
      const appearAt = tick - index;
      const srcIndex =
        ((appearAt % source.length) + source.length) % source.length;
      const row = source[srcIndex];
      if (!row) continue;
      rows.push({ ...row, instance: `${row.id}-${appearAt}` });
    }
    return rows;
  }, [source, tick]);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
      <p className="font-bungee text-xs">Commits en vivo</p>
      <ol className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {queue.map((row, index) => (
          <li
            key={row.instance}
            className={cn(
              "border border-hs-ink/15 bg-hs-sand/40 px-2 py-1.5",
              !reduced && index === 0 && tick > 0 && "tv-stream-row",
            )}
            style={{ opacity: Math.max(0.35, 1 - index * 0.12) }}
          >
            <p className="truncate text-[11px] text-hs-brown">
              {row.repo} · {row.actor}
            </p>
            <p className="truncate text-xs font-semibold">{row.text}</p>
            <p className="font-mono text-[10px] tabular-nums text-hs-navy">
              {row.sha}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LiveAgentsBox() {
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const tick = useTick(4000);
  const samples = filterSamples(getSamples(tick), "event", "all");
  const tools = harnessRows(samples)
    .filter((row) =>
      ["claude-code", "codex", "cursor", "opencode", "cline"].includes(row.id),
    )
    .sort((a, b) => b.sessions - a.sessions);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
      <p className="font-bungee text-xs">Agentes activos</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tools.map((tool) => (
          <span
            key={tool.id}
            className={cn(
              "inline-flex items-center gap-2 border border-hs-ink/20 px-2 py-1",
              !reduced && "tv-pulse",
            )}
            style={{
              animationDelay: `${HARNESSES.findIndex((item) => item.id === tool.id) * 80}ms`,
              animationPlayState: visible ? "running" : "paused",
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: tool.color }}
            />
            <span className="text-xs font-semibold">{tool.name}</span>
            <span className="font-mono text-xs tabular-nums">
              {tool.sessions}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Odometer({ value }: { value: number }) {
  const reduced = usePrefersReducedMotion();
  const digits = Math.round(value).toString().padStart(4, "0").split("");
  if (reduced) {
    return (
      <span className="font-sans text-4xl font-black tracking-[-0.06em] tabular-nums">
        {compact(value)}
      </span>
    );
  }
  return (
    <span className="inline-flex overflow-hidden font-sans text-4xl font-black tracking-[-0.06em] tabular-nums">
      {digits.map((digit, index) => {
        const numeric = Number.parseInt(digit, 10);
        const offset = Number.isFinite(numeric) ? numeric : 0;
        return (
          <span
            key={index}
            className="relative inline-block h-[1em] w-[0.65em] overflow-hidden"
          >
            {Number.isFinite(numeric) ? (
              <span
                className="tv-odometer-digit absolute inset-x-0 top-0"
                style={{ transform: `translateY(-${offset}em)` }}
              >
                {"0123456789".split("").map((face) => (
                  <span key={face} className="block h-[1em] leading-none">
                    {face}
                  </span>
                ))}
              </span>
            ) : (
              digit
            )}
          </span>
        );
      })}
    </span>
  );
}

export function LiveTokensBox() {
  const tick = useTick(5000);
  const samples = filterSamples(getSamples(tick), "event", "all");
  const totals = samples.reduce((sum, sample) => sum + sample.tokens, 0);
  const trend = [...new Set(samples.map((sample) => sample.bucket))].map(
    (bucket) =>
      samples
        .filter((sample) => sample.bucket === bucket)
        .reduce((sum, sample) => sum + sample.tokens, 0),
  );
  return (
    <div className="flex h-full flex-col justify-between bg-hs-gold p-3 text-hs-ink">
      <p className="font-bungee text-xs">Tokens</p>
      <div className="flex items-end justify-between gap-3">
        <Odometer value={totals} />
        <Sparkline values={trend} color="#2a170f" />
      </div>
    </div>
  );
}

export function LiveLeaderboardBox() {
  const reduced = usePrefersReducedMotion();
  const tick = useTick(4500);
  const teams = teamRows(filterSamples(getSamples(tick), "event", "all"))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
      <p className="font-bungee text-xs">Equipos</p>
      <ol className="mt-2 space-y-1.5">
        {teams.map((team, index) => (
          <motion.li
            key={team.id}
            layout={!reduced}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="flex items-center gap-2 border-b border-hs-ink/10 pb-1.5"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center font-mono text-[11px]",
                index === 0 ? "bg-hs-gold font-bold" : "text-hs-brown",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {team.name}
            </span>
            <span className="font-mono text-xs tabular-nums">
              {compact(team.tokens)}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
