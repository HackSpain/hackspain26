"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { EMPTY_REEL, FRESH_HOLD_MS, NEW_TAG_MS, ROTATION_HOLD_MS, demoMemes, memeAge, memeCaption, reactionTotal, reelAdvance, reelArrive, topReactions } from "@/lib/tv-memes";
import type { Reel, TvMeme } from "@/lib/tv-memes";
import { cn } from "@/lib/utils";
import { Diagonal } from "./market";
import { useClock, usePageVisible, useTick } from "./motion";

const DEMO_STEP_MS = 15_000;
const WALL_CELLS = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

type Pace = { fresh: number; rotation: number };
const LIVE_PACE: Pace = { fresh: FRESH_HOLD_MS, rotation: ROTATION_HOLD_MS };
// The demo runs faster so a new meme and the rotation both show within a minute.
const DEMO_PACE: Pace = { fresh: 10_000, rotation: 5000 };

/** A meme without a picture becomes a poster in one of the landing's cells. */
const POSTER_TONES = ["bg-hs-gold text-hs-ink", "bg-hs-teal text-hs-paper", "bg-hs-orange text-hs-paper", "bg-hs-navy text-hs-paper", "bg-hs-red text-hs-paper"];
function posterTone(id: string) {
  let sum = 0;
  for (const char of id) { sum += char.codePointAt(0) ?? 0; }
  return POSTER_TONES[sum % POSTER_TONES.length];
}

/** The empty wall cells keep the mosaic going until memes fill them. */
const SPARE_CELLS = [
  <Diagonal key="a" bg="bg-hs-teal" tri="bg-hs-gold" corner="tl" />,
  <Diagonal key="b" bg="bg-hs-paper" tri="bg-hs-red" corner="br" />,
  <div key="c" className="bg-hs-navy" />,
  <Diagonal key="d" bg="bg-hs-orange" tri="bg-hs-paper" corner="tl" />,
  <div key="e" className="bg-hs-gold" />,
  <Diagonal key="f" bg="bg-hs-navy" tri="bg-hs-teal" corner="br" />,
];

type ReelState = { snapshot: TvMeme[] | undefined; reel: Reel };

/** Which meme holds the big cell: new arrivals first, then the rotation. */
function useMemeReel(memes: TvMeme[] | undefined, pace: Pace) {
  const visible = usePageVisible();
  const [state, setState] = useState<ReelState>(() => ({ reel: memes ? reelArrive(EMPTY_REEL, undefined, memes) : EMPTY_REEL, snapshot: memes }));
  if (memes && memes !== state.snapshot) {
    setState({ reel: reelArrive(state.reel, state.snapshot, memes), snapshot: memes });
  }
  const { currentId, fresh, turn } = state.reel;
  const hold = fresh ? pace.fresh : pace.rotation;
  useEffect(() => {
    if (!visible || currentId === null) { return; }
    const timer = window.setTimeout(() => setState((now) => ({ ...now, reel: reelAdvance(now.reel, now.snapshot ?? []) })), hold);
    return () => window.clearTimeout(timer);
  }, [visible, currentId, turn, hold]);
  return { hold, reel: state.reel, visible };
}

function Picture({ meme, cover = false, mini = false }: { meme: TvMeme; cover?: boolean; mini?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const caption = memeCaption(meme.text);
  if (meme.imageUrl && failed !== meme.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={meme.imageUrl} alt={caption} referrerPolicy="no-referrer" onError={() => setFailed(meme.imageUrl)} className={cn("size-full", cover ? "object-cover" : "object-contain")} />
    );
  }
  const long = caption.length > 90;
  return (
    <p className={cn("hsx-title flex size-full items-center justify-center text-balance break-words text-center", posterTone(meme._id),
      cover && "hsx-sm p-[calc(var(--u)*1)] leading-[1.15]",
      !cover && (mini ? cn("p-[calc(var(--u)*2)] leading-[1.1]", long ? "hsx-lg" : "hsx-xl") : cn("p-[calc(var(--u)*4)] leading-[1.1]", long ? "hsx-xl" : "hsx-2xl")))}>
      <span className={cover ? "line-clamp-5" : "line-clamp-6"}>{caption || "#meme"}</span>
    </p>
  );
}

/** The meme's reactions, most used first. Counts flash when they move; a new emoji pops in. */
function Reactions({ meme, limit, className }: { meme: TvMeme; limit: number; className?: string }) {
  const reduced = useReducedMotion();
  const { shown, rest } = topReactions(meme, limit);
  return (
    <ul aria-label="Reacciones" className={cn("flex min-w-0 items-center gap-[calc(var(--u)*0.5)] [--hsx-flash:var(--color-hs-red)]", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((reaction) => (
          <motion.li key={reaction.emoji} layout={!reduced} initial={{ opacity: 0, scale: reduced ? 1 : 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex shrink-0 items-center gap-[calc(var(--u)*0.35)] border-[length:calc(var(--line)*0.6)] border-hs-ink bg-hs-paper px-[calc(var(--u)*0.6)] py-[calc(var(--u)*0.3)] leading-none text-hs-ink">
            <span className="hsx-lg">{reaction.emoji}</span>
            <span key={reaction.count} className="hsx-title hsx-num hsx-md hsx-flash">{reaction.count}</span>
          </motion.li>
        ))}
      </AnimatePresence>
      {rest > 0 ? <li className="hsx-title hsx-num hsx-sm shrink-0 leading-none">+{rest}</li> : null}
    </ul>
  );
}

function Feature({ meme, fresh, hold, turn, position, visible, now, mini = false }: { meme: TvMeme | undefined; fresh: boolean; hold: number; turn: number; position: string; visible: boolean; now: number | undefined; mini?: boolean }) {
  const reduced = useReducedMotion();
  if (!meme) {
    return (
      <section className="flex min-h-0 flex-col items-center justify-center gap-[calc(var(--u)*1.6)] bg-hs-paper p-[calc(var(--u)*4)] text-center">
        <p className={cn("hsx-title text-balance", mini ? "hsx-xl" : "hsx-2xl")}>Aún no hay memes</p>
        <p className={cn("text-balance", mini ? "hsx-md" : "hsx-lg max-w-[70%]")}>Publica el tuyo en el feed de la app con <strong className="bg-hs-gold px-[0.3em]">#meme</strong> y estrena esta pantalla.</p>
      </section>
    );
  }
  const caption = memeCaption(meme.text);
  const reacted = reactionTotal(meme) > 0;
  return (
    <section className="flex min-h-0 flex-col gap-[var(--line)]" aria-live="polite">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-hs-paper">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={meme._id} className="absolute inset-0"
            initial={reduced ? { opacity: 0 } : fresh ? { opacity: 0, scale: 0.9, y: "8%" } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: fresh ? 0.7 : 0.45, ease: EASE }}>
            <Picture meme={meme} mini={mini} />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {fresh ? (
            <motion.p key={meme._id} className="hsx-title hsx-xl absolute top-[calc(var(--u)*1.4)] left-[calc(var(--u)*1.4)] flex origin-top-left items-center gap-[calc(var(--u)*0.7)] border-[length:var(--line)] border-hs-ink bg-hs-red px-[calc(var(--u)*1.1)] py-[calc(var(--u)*0.7)] text-hs-paper"
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -10, scale: 1.5 }} animate={{ opacity: 1, rotate: -4, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: reduced ? 0 : 0.35, duration: 0.4, ease: EASE }}>
              <span className="tv-pulse size-[calc(var(--u)*0.9)] shrink-0 rounded-full bg-hs-paper" />Nuevo meme
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <div className={cn("grid shrink-0 gap-[var(--line)]", mini ? "h-[22%] grid-cols-[minmax(0,1fr)_auto_auto]" : "h-[15%] grid-cols-[minmax(0,1fr)_auto_auto_calc(var(--u)*8)]")}>
        <div className={cn("relative flex min-w-0 flex-col justify-center gap-[calc(var(--u)*0.5)] overflow-hidden px-[calc(var(--u)*1.6)] transition-colors duration-500", fresh ? "bg-hs-gold" : "bg-hs-paper")}>
          <p className="flex min-w-0 items-baseline gap-[calc(var(--u)*0.8)] leading-none">
            <span className="hsx-title hsx-lg truncate">{meme.authorName}</span>
            {meme.teamName ? <span className="hsx-label truncate">{meme.teamName}</span> : null}
          </p>
          {meme.imageUrl && caption ? <p className={cn("line-clamp-2 leading-snug", mini ? "hsx-sm" : "hsx-md")}>{caption}</p> : null}
          <div className="absolute inset-x-0 bottom-0 h-[calc(var(--u)*0.45)] bg-hs-ink/15" aria-hidden>
            <div key={`${turn}-${visible}`} className="hsx-progress h-full origin-left bg-hs-orange" style={{ animationDuration: `${hold}ms`, animationPlayState: visible ? "running" : "paused" }} />
          </div>
        </div>
        {/* The full screen always keeps the cell, so the first reaction does not reflow the bar. */}
        {mini && !reacted ? null : (
          <div className={cn("flex min-w-0 flex-col justify-center gap-[calc(var(--u)*0.45)] bg-hs-teal px-[calc(var(--u)*1.2)] leading-none text-hs-paper", mini ? "max-w-[38cqw]" : "max-w-[34cqw]")}>
            {mini ? null : <p className="hsx-label">{reacted ? "Reacciones" : "Reacciona desde el feed"}</p>}
            {reacted ? <Reactions meme={meme} limit={mini ? 3 : 5} /> : <p className="hsx-title hsx-lg" aria-hidden>+ 😂 🔥 💀</p>}
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-[calc(var(--u)*0.4)] bg-hs-navy px-[calc(var(--u)*1.6)] leading-none text-hs-paper">
          <span className="hsx-label">{now === undefined ? "Publicado" : memeAge(meme.createdAt, now)}</span>
          <span className="hsx-title hsx-num hsx-lg">{position}</span>
        </div>
        {mini ? null : <Diagonal bg={fresh ? "bg-hs-red" : "bg-hs-teal"} tri={fresh ? "bg-hs-paper" : "bg-hs-gold"} corner="br" />}
      </div>
    </section>
  );
}

function Wall({ memes, currentId, now }: { memes: TvMeme[]; currentId: string | null; now: number | undefined }) {
  const reduced = useReducedMotion();
  const shown = memes.slice(0, WALL_CELLS);
  return (
    <ol className="grid min-h-0 grid-cols-2 grid-rows-3 gap-[var(--line)] portrait:grid-cols-3 portrait:grid-rows-2" aria-label="Últimos memes">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((meme) => (
          <motion.li key={meme._id} layout={!reduced} initial={{ opacity: 0, scale: reduced ? 1 : 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }} className="relative min-h-0 min-w-0 overflow-hidden bg-hs-paper">
            <Picture meme={meme} cover />
            <p className="hsx-xs absolute inset-x-0 bottom-0 flex items-center gap-[calc(var(--u)*0.6)] bg-hs-ink px-[calc(var(--u)*0.7)] py-[calc(var(--u)*0.35)] font-bold text-hs-paper [--hsx-flash:var(--color-hs-gold)]">
              <span className="min-w-0 flex-1 truncate">{meme.authorName}{meme.teamName ? ` · ${meme.teamName}` : ""}</span>
              {reactionTotal(meme) > 0 ? (
                <span className="hsx-num shrink-0">{topReactions(meme, 2).shown.map((reaction) => reaction.emoji).join("")} <span key={reactionTotal(meme)} className="hsx-flash">{reactionTotal(meme)}</span></span>
              ) : null}
            </p>
            {now !== undefined && now - meme.createdAt < NEW_TAG_MS ? <span className="hsx-title hsx-xs absolute top-0 left-0 bg-hs-gold px-[calc(var(--u)*0.6)] py-[calc(var(--u)*0.35)] text-hs-ink">Nuevo</span> : null}
            {meme._id === currentId ? <span aria-hidden className="pointer-events-none absolute inset-0 border-[length:calc(var(--line)*2.2)] border-hs-gold" /> : null}
          </motion.li>
        ))}
      </AnimatePresence>
      {SPARE_CELLS.slice(shown.length).map((cell) => <li key={cell.key} aria-hidden className="grid min-h-0 min-w-0 [&>*]:size-full">{cell}</li>)}
    </ol>
  );
}

function MemesStage({ memes, demo, pace, mini }: { memes: TvMeme[] | undefined; demo: boolean; pace: Pace; mini: boolean }) {
  const clock = useClock();
  const now = clock?.getTime();
  const { hold, reel, visible } = useMemeReel(memes, pace);
  const list = memes ?? [];
  const index = list.findIndex((meme) => meme._id === reel.currentId);
  const latest = list[0];
  const time = clock?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) ?? "--:--";
  const feature = memes
    ? <Feature meme={list[index]} fresh={reel.fresh} hold={hold} turn={reel.turn} position={`${index + 1} / ${list.length}`} visible={visible} now={now} mini={mini} />
    : <div className="min-h-0 flex-1 bg-hs-paper" />;
  if (mini) {
    // Small venue screens: one meme at a time inside a safe margin, no wall.
    return (
      <main className="h-dvh w-full overflow-hidden bg-hs-ink px-[5vw] py-[5vh] text-hs-ink [container-type:size]" aria-label="Memes de HackSpain en directo · mini">
        <div className="hsx hsx-mini flex h-full flex-col gap-[var(--line)] p-[var(--line)]">
          <header className="grid h-[14%] shrink-0 grid-cols-[minmax(0,1.1fr)_minmax(0,2.2fr)_minmax(0,0.8fr)] gap-[var(--line)]">
            <div className="flex min-w-0 items-center justify-center bg-hs-paper px-[var(--u)]">
              <Image src="/logo.svg" alt="HackSpain" width={190} height={63} priority className="h-auto max-h-[68%] w-auto min-w-0 object-contain" />
            </div>
            <p className="hsx-md flex min-w-0 items-center gap-[calc(var(--u)*0.6)] bg-hs-gold px-[var(--u)] leading-tight font-bold">
              <span className="tv-pulse size-[calc(var(--u)*0.6)] shrink-0 rounded-full bg-hs-red" />
              <span>{demo ? "Demo · publica" : "Publica"} con <strong className="hsx-title bg-hs-ink px-[0.3em] text-hs-gold">#meme</strong></span>
            </p>
            <p className="hsx-title hsx-num hsx-lg flex items-center justify-center bg-hs-teal text-hs-paper">{time}</p>
          </header>
          <div className="flex min-h-0 flex-1 flex-col [&>section]:flex-1">{feature}</div>
        </div>
      </main>
    );
  }
  return (
    <main className="h-dvh w-full overflow-hidden bg-hs-ink text-hs-ink [container-type:size]" aria-label="Memes de HackSpain en directo">
      <div className="hsx hsx-md flex h-full flex-col gap-[var(--line)] p-[var(--line)]">
        <header className="grid h-[9%] shrink-0 grid-cols-[calc(var(--u)*7)_minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,3fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_calc(var(--u)*7)] gap-[var(--line)]">
          <Diagonal bg="bg-hs-paper" tri="bg-hs-orange" corner="tl" />
          <div className="flex items-center justify-center bg-hs-paper px-[calc(var(--u)*1.4)]">
            <Image src="/logo.svg" alt="HackSpain" width={190} height={63} priority className="h-[74%] w-auto" />
          </div>
          <p className="hsx-title hsx-lg flex items-center justify-center gap-[calc(var(--u)*0.7)] bg-hs-red px-[calc(var(--u)*1)] text-hs-paper">
            <span className="tv-pulse size-[calc(var(--u)*0.9)] shrink-0 rounded-full bg-hs-paper" />{demo ? "Demo · memes" : "Memes"}
          </p>
          <p className="hsx-lg flex items-center bg-hs-paper px-[calc(var(--u)*1.6)] leading-tight">
            <span>Publica en el feed con <strong className="hsx-title bg-hs-gold px-[0.3em]">#meme</strong> y sal en esta pantalla</span>
          </p>
          <div className="flex flex-col justify-center gap-[calc(var(--u)*0.4)] bg-hs-gold px-[calc(var(--u)*1.5)] leading-none [--hsx-flash:var(--color-hs-red)]">
            <p className="hsx-label">Último meme</p>
            <p className="hsx-title hsx-lg truncate"><span key={latest?._id} className="hsx-flash">{latest && now !== undefined ? memeAge(latest.createdAt, now) : "--"}</span></p>
          </div>
          <div className="flex flex-col items-center justify-center bg-hs-teal leading-none text-hs-paper">
            <span className="hsx-label">Madrid</span>
            <span className="hsx-title hsx-num hsx-xl mt-[calc(var(--u)*0.4)]">{time}</span>
          </div>
          <Diagonal bg="bg-hs-teal" tri="bg-hs-orange" corner="br" />
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-[var(--line)] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {feature}
          <Wall memes={list} currentId={reel.currentId} now={now} />
        </div>
      </div>
    </main>
  );
}

function LiveMemes({ mini }: { mini: boolean }) {
  return <MemesStage memes={useQuery(api.tv.listMemes)} demo={false} pace={LIVE_PACE} mini={mini} />;
}

function DemoMemes({ mini }: { mini: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const step = useTick(DEMO_STEP_MS);
  const memes = useMemo(() => demoMemes(step, startedAt, DEMO_STEP_MS), [step, startedAt]);
  return <MemesStage memes={memes} demo pace={DEMO_PACE} mini={mini} />;
}

export function MemesScreen({ demo = false, mini = false }: { demo?: boolean; mini?: boolean }) {
  return demo ? <DemoMemes mini={mini} /> : <LiveMemes mini={mini} />;
}
