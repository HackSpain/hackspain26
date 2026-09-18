"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { Sparkline } from "@/app/insights/charts";
import {
  bucketTotals,
  compact,
  filterSamples,
  harnessRows,
  number,
  percent,
  sumSamples,
  teamRows,
} from "@/app/insights/mock-data";
import type { HarnessRow, TeamRow } from "@/app/insights/mock-data";
import {
  NO_TEAM_ID,
  useLiveInsights,
} from "@/app/insights/use-live-insights";
import { cn } from "@/lib/utils";
import {
  FLASH_LAYER_CLASS,
  flashGold,
  gsap,
  settle,
  TV_EASE_OUT,
  TV_EASE_POP,
  useBarWidth,
  useCountUp,
  useGSAP,
  useRankRows,
  useStreamShift,
} from "./gsap";
import { usePrefersReducedMotion, useTick } from "./motion";

function LiveHeader({
  title,
  aside,
  dark = false,
}: {
  title: string;
  aside?: ReactNode;
  dark?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-baseline justify-between gap-3 border-b pb-[0.5cqw]",
        dark ? "border-hs-ink/25" : "border-hs-ink/15",
      )}
    >
      <p className="font-bungee text-[clamp(0.6rem,1.05cqw,1.4rem)] leading-none">
        {title}
      </p>
      {aside ? (
        <p className="text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-brown tabular-nums">
          {aside}
        </p>
      ) : null}
    </header>
  );
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
  const tick = useTick(3200);
  const remote = useQuery(api.tv.listGithubActivity);
  const listRef = useRef<HTMLOListElement>(null);
  const source = useMemo(
    () =>
      (remote ?? []).map((row) => ({
        id: row._id,
        repo: row.repo || "repo",
        actor: row.actor || "github",
        text: row.text,
        sha: row.sha,
      })),
    [remote],
  );
  const queue = useMemo(() => {
    if (source.length === 0) {return [];}
    const count = Math.min(6, source.length);
    const rows: CommitRow[] = [];
    for (let index = 0; index < count; index += 1) {
      const appearAt = tick - index;
      const srcIndex =
        ((appearAt % source.length) + source.length) % source.length;
      const row = source[srcIndex];
      if (!row) {continue;}
      rows.push({ ...row, instance: `${row.id}-${appearAt}` });
    }
    return rows;
  }, [source, tick]);
  const ids = useMemo(() => queue.map((row) => row.instance), [queue]);
  const repos = useMemo(
    () => new Set(source.map((row) => row.repo)).size,
    [source],
  );

  const onEnter = useCallback((rows: HTMLElement[]) => {
    flashGold(rows);
    for (const row of rows) {
      const sha = row.querySelector<HTMLElement>("[data-sha]");
      if (!sha?.dataset.sha) {continue;}
      gsap.to(sha, {
        duration: 0.9,
        scrambleText: {
          text: sha.dataset.sha,
          chars: "0123456789abcdef",
          speed: 0.5,
        },
      });
    }
  }, []);
  useStreamShift(listRef, ids, onEnter);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-[1cqw] text-hs-ink">
      <LiveHeader title="Commits en vivo" aside={`${repos} repos`} />
      {queue.length === 0 ? (
        <p className="mt-[0.6cqw] text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-brown">
          {remote === undefined ? "Cargando actividad…" : "Sin commits todavía."}
        </p>
      ) : null}
      <ol
        ref={listRef}
        className="mt-[0.6cqw] min-h-0 flex-1 space-y-[0.4cqw] overflow-hidden"
      >
        {queue.map((row, index) => (
          <li
            key={row.instance}
            className="relative border-l-[3px] border-hs-ink/15 bg-hs-sand/40 px-[0.7cqw] py-[0.45cqw]"
            style={{ opacity: Math.max(0.35, 1 - index * 0.12) }}
          >
            <span data-flash aria-hidden className={FLASH_LAYER_CLASS} />
            <p className="truncate text-[clamp(0.5rem,0.7cqw,0.95rem)] text-hs-brown">
              {row.repo} · {row.actor}
            </p>
            <p className="truncate text-[clamp(0.6rem,0.85cqw,1.15rem)] font-semibold">
              {row.text}
            </p>
            <p
              data-sha={row.sha}
              className="font-mono text-[clamp(0.5rem,0.65cqw,0.9rem)] tabular-nums text-hs-navy"
            >
              {row.sha}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AgentRow({
  row,
  share,
  rows,
  rowRef,
}: {
  row: HarnessRow;
  share: number;
  rows: number;
  rowRef: (node: HTMLElement | null) => void;
}) {
  const count = useCountUp(row.sessions, number, { fromZero: true });
  const bar = useBarWidth(share);
  return (
    <li
      ref={rowRef}
      className="absolute inset-x-0 top-0 flex items-center gap-[0.7cqw] pr-[0.2cqw]"
      style={{ height: `${100 / rows}%` }}
    >
      <span
        className="font-bungee flex w-[2.2cqw] shrink-0 items-center justify-center py-[0.25cqw] text-[clamp(0.5rem,0.7cqw,0.95rem)] text-hs-paper"
        style={{ backgroundColor: row.color }}
      >
        {row.mark}
      </span>
      <span className="w-[6.5cqw] shrink-0 truncate text-[clamp(0.6rem,0.85cqw,1.15rem)] font-semibold">
        {row.name}
      </span>
      <span className="relative h-[0.7cqw] min-w-0 flex-1 bg-hs-ink/8">
        <span
          ref={bar}
          className="absolute inset-y-0 left-0 w-0"
          style={{ backgroundColor: row.color }}
        />
      </span>
      <span className="flex w-[3.6cqw] shrink-0 items-center justify-end gap-[0.4cqw]">
        <span
          data-live-dot
          className="size-[0.45cqw] rounded-full"
          style={{ backgroundColor: row.color }}
          aria-hidden
        />
        <span
          ref={count}
          className="font-mono text-[clamp(0.6rem,0.85cqw,1.15rem)] tabular-nums"
        >
          {number(row.sessions)}
        </span>
      </span>
    </li>
  );
}

export function LiveAgentsBox() {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const data = useLiveInsights();
  const samples = filterSamples(data.samples, "event", "all", data.teams);
  const tools = harnessRows(samples)
    .filter((row) => row.sessions > 0)
    .toSorted((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  const max = Math.max(1, ...tools.map((tool) => tool.sessions));
  const total = tools.reduce((sum, tool) => sum + tool.sessions, 0);
  const order = useMemo(() => tools.map((tool) => tool.id), [tools]);
  const register = useRankRows(order);
  const totalRef = useCountUp(total, number, { fromZero: true });

  useGSAP(
    () => {
      if (reduced) {return;}
      gsap.to("[data-live-dot]", {
        scale: 1.7,
        opacity: 0.35,
        duration: 0.9,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.14,
      });
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );

  const byId = useMemo(() => {
    const map = new Map<string, HarnessRow>();
    for (const tool of tools) {map.set(tool.id, tool);}
    return map;
  }, [tools]);
  const stable = useMemo(
    () => tools.toSorted((a, b) => a.id.localeCompare(b.id)),
    [tools],
  );

  return (
    <div
      ref={root}
      className="flex h-full flex-col bg-hs-paper p-[1cqw] text-hs-ink"
    >
      <LiveHeader
        title="Agentes activos"
        aside={
          <>
            <span ref={totalRef}>{number(total)}</span> sesiones
          </>
        }
      />
      <ol className="relative mt-[0.5cqw] min-h-0 flex-1">
        {stable.map((tool) => {
          const live = byId.get(tool.id) ?? tool;
          return (
            <AgentRow
              key={tool.id}
              row={live}
              share={live.sessions / max}
              rows={Math.max(stable.length, 6)}
              rowRef={register(tool.id)}
            />
          );
        })}
      </ol>
    </div>
  );
}

const ODOMETER_FACES = [..."01234567890123456789"];

function odometerParts(value: number): { text: string; unit: string } {
  const locale = (input: number, digits: number) =>
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(input);
  if (value >= 1_000_000_000) {return { text: locale(value / 1_000_000_000, 2), unit: "B" };}
  if (value >= 1_000_000) {return { text: locale(value / 1_000_000, 2), unit: "M" };}
  if (value >= 1000) {return { text: locale(value / 1000, 1), unit: "k" };}
  return { text: locale(value, 0), unit: "" };
}

function OdometerDigit({ digit }: { digit: number }) {
  const reduced = usePrefersReducedMotion();
  const strip = useRef<HTMLSpanElement>(null);
  const position = useRef(digit);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) {return;}
    if (reduced) {
      position.current = digit;
      gsap.set(el, { yPercent: -digit * 5 });
      return;
    }
    let from = position.current;
    if (from >= 10) {
      from -= 10;
      gsap.set(el, { yPercent: -from * 5 });
    }
    // Always roll forward; the strip holds two loops so 9 → 0 keeps moving down.
    const to = digit < from ? digit + 10 : digit;
    position.current = to;
    const tween = gsap.to(el, {
      yPercent: -to * 5,
      duration: 1,
      ease: "power4.out",
      overwrite: "auto",
    });
    return () => {
      settle(tween);
    };
  }, [digit, reduced]);

  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden text-center">
      <span ref={strip} className="absolute inset-x-0 top-0 block will-change-transform">
        {ODOMETER_FACES.map((face, index) => (
          <span key={index} className="block h-[1em] leading-none">
            {face}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Ink and paper shards fly out from the delta chip in random directions and
 * remove themselves when done. Returns the timeline so the caller can sync it.
 */
function burst(root: HTMLElement | null, origin: HTMLElement, count: number) {
  const timeline = gsap.timeline();
  if (!root) {return timeline;}
  const box = root.getBoundingClientRect();
  const from = origin.getBoundingClientRect();
  const x = from.left - box.left + from.width / 2;
  const y = from.top - box.top + from.height / 2;
  const random = gsap.utils.random;
  for (let index = 0; index < count; index += 1) {
    const shard = document.createElement("span");
    shard.setAttribute("aria-hidden", "true");
    shard.className = cn(
      "pointer-events-none absolute left-0 top-0 block",
      index % 3 === 0 ? "bg-hs-paper" : "bg-hs-ink",
    );
    const size = random(4, 10);
    shard.style.width = `${size}px`;
    shard.style.height = `${index % 4 === 0 ? size * 2.2 : size}px`;
    root.append(shard);
    const angle = random(0, Math.PI * 2);
    const distance = random(40, 130);
    timeline.fromTo(
      shard,
      { x, y, opacity: 1, scale: 1, rotation: random(0, 180) },
      {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + 30,
        rotation: `+=${random(90, 360)}`,
        scale: 0.2,
        opacity: 0,
        duration: random(0.55, 0.95),
        ease: "power3.out",
        onComplete: () => shard.remove(),
      },
      random(0, 0.08),
    );
  }
  return timeline;
}

function Odometer({ value }: { value: number }) {
  const { text, unit } = odometerParts(value);
  return (
    <span className="inline-flex items-end font-sans font-black tracking-[-0.06em] tabular-nums">
      <span className="inline-flex text-[clamp(1.6rem,4.6cqw,6.5rem)] leading-none">
        {[...text].map((char, index) =>
          /\d/.test(char) ? (
            <OdometerDigit key={`${index}-d`} digit={Number(char)} />
          ) : (
            <span key={`${index}-s`} className="inline-block w-[0.3em] text-center leading-none">
              {char}
            </span>
          ),
        )}
      </span>
      {unit ? (
        <span className="mb-[0.55cqw] ml-[0.3cqw] font-bungee text-[clamp(0.9rem,2cqw,2.8rem)] leading-none">
          {unit}
        </span>
      ) : null}
    </span>
  );
}

export function LiveTokensBox() {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const data = useLiveInsights();
  const samples = filterSamples(data.samples, "event", "all", data.teams);
  const totals = sumSamples(samples);
  const previous = useRef<number | null>(null);
  const trend = bucketTotals(samples).map((bucket) => bucket.tokens);
  const perMinute = trend.length > 0 ? (trend.at(-1) ?? 0) / Math.max(data.bucketMinutes, 1) : 0;
  const rateRef = useCountUp(perMinute, compact, { fromZero: true });

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = totals.tokens;
    if (before === null || reduced || totals.tokens <= before) {return;}
    const delta = totals.tokens - before;
    const chipEl = chip.current;
    const ringEl = ring.current;
    const odometer = root.current?.querySelector<HTMLElement>("[data-odometer]");
    if (!chipEl || !ringEl || !odometer) {return;}
    chipEl.textContent = `+${compact(delta)}`;
    // Bigger jumps shake harder; the hit is random every time so it never loops.
    const punch = gsap.utils.clamp(0.5, 1.6, Math.log10(Math.max(delta, 10)) / 4);
    const random = gsap.utils.random;
    const timeline = gsap.timeline();
    timeline.to(
      odometer,
      {
        keyframes: [
          ...Array.from({ length: 6 }, () => ({
            x: random(-9, 9) * punch,
            y: random(-5, 5) * punch,
            rotation: random(-2.5, 2.5) * punch,
            duration: 0.045,
          })),
          { x: 0, y: 0, rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.35)" },
        ],
      },
      0,
    );
    timeline.fromTo(
      odometer,
      { scale: 1 + 0.05 * punch },
      { scale: 1, duration: 0.8, ease: "elastic.out(1, 0.4)" },
      0.05,
    );
    timeline.fromTo(
      chipEl,
      { opacity: 0, y: 10, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: TV_EASE_POP },
      0.1,
    );
    timeline.to(chipEl, { opacity: 0, y: -10, duration: 0.25, ease: "power2.in" }, "+=1.4");
    timeline.fromTo(
      ringEl,
      { opacity: 0.9, scale: 0.985 },
      { opacity: 0, scale: 1.015, duration: 1.1, ease: TV_EASE_OUT },
      0,
    );
    const shards = burst(root.current, chipEl, Math.round(6 + 8 * punch));
    timeline.add(shards, 0.02);
    return () => {
      // progress(1) fires each shard's onComplete, which removes it.
      settle(timeline);
    };
  }, [totals.tokens, reduced]);

  return (
    <div
      ref={root}
      className="relative flex h-full flex-col justify-between overflow-hidden bg-hs-gold p-[1cqw] text-hs-ink"
    >
      <span
        ref={ring}
        aria-hidden
        className="pointer-events-none absolute inset-0 border-[0.3cqw] border-hs-paper opacity-0"
      />
      <LiveHeader
        title="Tokens"
        dark
        aside={
          <>
            <span ref={rateRef}>{compact(perMinute)}</span> / min
          </>
        }
      />
      <div className="flex items-end justify-between gap-[1cqw]">
        <div className="min-w-0">
          <div className="flex items-start gap-[0.6cqw]">
            <span data-odometer className="inline-block will-change-transform">
              <Odometer value={totals.tokens} />
            </span>
            <span
              ref={chip}
              aria-hidden
              className="mt-[0.2cqw] shrink-0 bg-hs-ink px-[0.5cqw] py-[0.15cqw] font-mono text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-gold opacity-0 tabular-nums"
            />
          </div>
          <p className="mt-[0.3cqw] text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-brown">
            {percent(totals.cachedTokens, totals.tokens)} reutilizados desde caché
          </p>
        </div>
        <Sparkline values={trend} color="#2a170f" />
      </div>
    </div>
  );
}

function TeamRowView({
  team,
  rank,
  offset = 0,
  rows,
  rowRef,
}: {
  team: TeamRow;
  rank: number;
  offset?: number;
  rows: number;
  rowRef: (node: HTMLElement | null) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const tokens = useCountUp(team.tokens, compact, { fromZero: true });
  const flash = useRef<HTMLSpanElement>(null);
  const previousRank = useRef<number | null>(null);

  useLayoutEffect(() => {
    const before = previousRank.current;
    previousRank.current = rank;
    if (before === null || reduced || rank >= before || !flash.current) {return;}
    const tween = flashGold(flash.current, 1.8);
    return () => {
      if (tween) {settle(tween);}
    };
  }, [rank, reduced]);

  return (
    <li
      ref={rowRef}
      className="absolute inset-x-0 top-0 flex items-center gap-[0.7cqw] border-b border-hs-ink/10"
      style={{ height: `${100 / rows}%` }}
    >
      <span ref={flash} data-flash aria-hidden className={FLASH_LAYER_CLASS} />
      <span
        className={cn(
          "flex size-[1.8cqw] shrink-0 items-center justify-center font-bungee text-[clamp(0.55rem,0.8cqw,1.1rem)]",
          rank + offset === 0 ? "bg-hs-ink text-hs-gold" : "text-hs-brown",
        )}
      >
        {rank + offset + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[clamp(0.6rem,0.9cqw,1.2rem)] font-bold">
          {team.name}
        </span>
        <span className="block truncate text-[clamp(0.5rem,0.65cqw,0.9rem)] text-hs-brown">
          {team.project}
        </span>
      </span>
      <span
        ref={tokens}
        className="font-mono text-[clamp(0.6rem,0.85cqw,1.15rem)] tabular-nums"
      >
        {compact(team.tokens)}
      </span>
    </li>
  );
}

const LEADERBOARD_PAGE = 6;
const LEADERBOARD_PAGE_MS = 9000;

/**
 * Teams paginate like a departures board: the current page folds away from
 * the top, the next one drops its rows in one by one. The `ol` is keyed by
 * visit so the folded node is discarded instead of reset.
 */
export function LiveLeaderboardBox() {
  const reduced = usePrefersReducedMotion();
  const data = useLiveInsights();
  const ranked = teamRows(
    filterSamples(data.samples, "event", "all", data.teams),
    data.teams,
  )
    .filter((team) => team.id !== NO_TEAM_ID)
    .toSorted((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(ranked.length / LEADERBOARD_PAGE));
  const tick = useTick(LEADERBOARD_PAGE_MS);
  const target = tick % pages;
  const [visit, setVisit] = useState({ page: 0, id: 0 });
  const page = Math.min(visit.page, pages - 1);
  const list = useRef<HTMLOListElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target === page) {return;}
    const turn = () => setVisit((current) => ({ page: target, id: current.id + 1 }));
    if (!list.current || reduced) {
      turn();
      return;
    }
    const tween = gsap.to(list.current, {
      rotationX: 18,
      yPercent: -6,
      opacity: 0,
      transformPerspective: 900,
      transformOrigin: "50% 0%",
      duration: 0.32,
      ease: "power2.in",
      onComplete: turn,
    });
    return () => {
      tween.kill();
    };
  }, [target, page, reduced]);

  useGSAP(
    () => {
      if (!bar.current || pages <= 1) {return;}
      gsap.fromTo(
        bar.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: (LEADERBOARD_PAGE_MS - 400) / 1000,
          ease: "none",
          transformOrigin: "0% 50%",
        },
      );
    },
    { dependencies: [visit.id, pages], revertOnUpdate: true },
  );

  const shown = ranked.slice(page * LEADERBOARD_PAGE, (page + 1) * LEADERBOARD_PAGE);
  const order = useMemo(() => shown.map((team) => team.id), [shown]);
  const register = useRankRows(order, visit.id);
  const rankOf = new Map(order.map((id, index) => [id, index]));
  const stable = shown.toSorted((a, b) => a.id.localeCompare(b.id));
  const offset = page * LEADERBOARD_PAGE;

  return (
    <div className="flex h-full flex-col bg-hs-paper p-[1cqw] text-hs-ink">
      <LiveHeader
        title="Equipos"
        aside={pages > 1 ? `${page + 1} / ${pages} · por tokens` : "por tokens"}
      />
      {pages > 1 ? (
        <div className="mt-[0.4cqw] h-[0.25cqw] shrink-0 bg-hs-ink/10">
          <div ref={bar} className="h-full w-full origin-left scale-x-0 bg-hs-gold" />
        </div>
      ) : null}
      <ol
        key={visit.id}
        ref={list}
        className="relative mt-[0.5cqw] min-h-0 flex-1 will-change-transform"
      >
        {stable.map((team) => (
          <TeamRowView
            key={team.id}
            team={team}
            rank={rankOf.get(team.id) ?? 0}
            offset={offset}
            rows={stable.length}
            rowRef={register(team.id)}
          />
        ))}
      </ol>
    </div>
  );
}
