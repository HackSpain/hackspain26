"use client";

import { useQuery } from "convex/react";
import { ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { TvFeedMode, TvFeedSource } from "@/lib/tv";
import {
  FLASH_LAYER_CLASS,
  flashGold,
  gsap,
  settle,
  SplitText,
  TV_EASE_OUT,
  TV_EASE_POP,
  TV_REDUCED_FADE,
  useGSAP,
  useStreamShift,
} from "./gsap";
import { usePageVisible, usePrefersReducedMotion } from "./motion";

const ROTATE_MS = 8000;

function useTick(ms: number) {
  const visible = usePageVisible();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible) {return;}
    const timer = window.setInterval(() => setTick((value) => value + 1), ms);
    return () => window.clearInterval(timer);
  }, [ms, visible]);
  return tick;
}

function useNow(ms: number) {
  const visible = usePageVisible();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!visible) {return;}
    const boot = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(timer);
    };
  }, [ms, visible]);
  return now;
}

function timeAgo(at: number, now: number): string {
  if (now === 0) {return "";}
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const seconds = Math.round((at - now) / 1000);
  if (Math.abs(seconds) < 60) {return "ahora mismo";}
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {return rtf.format(minutes, "minute");}
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {return rtf.format(hours, "hour");}
  return new Date(at).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type FeedPost = {
  _id: string;
  kind: "post" | "github";
  authorName: string;
  teamName: string;
  text: string;
  hasImage: boolean;
  createdAt: number;
};

function FeedHeader({ aside }: { aside?: string }) {
  return (
    <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hs-ink/15 pb-[0.5cqw]">
      <p className="font-bungee text-[clamp(0.6rem,1.05cqw,1.4rem)] leading-none">
        Feed
      </p>
      {aside ? (
        <p className="text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-brown tabular-nums">
          {aside}
        </p>
      ) : null}
    </header>
  );
}

function FeedCard({ post, now }: { post: FeedPost; now: number }) {
  return (
    <article className="relative border-l-[3px] border-hs-ink/15 bg-hs-sand/40 px-[0.7cqw] py-[0.5cqw] text-hs-ink">
      <span data-flash aria-hidden className={FLASH_LAYER_CLASS} />
      <p className="font-bungee text-[clamp(0.5rem,0.7cqw,0.95rem)] uppercase">
        {post.authorName}
      </p>
      <p className="text-[clamp(0.5rem,0.7cqw,0.95rem)] text-hs-brown">
        {post.teamName ? `${post.teamName} · ` : ""}
        {timeAgo(post.createdAt, now)}
      </p>
      {post.text ? (
        <p className="mt-[0.25cqw] line-clamp-4 text-pretty break-words text-[clamp(0.6rem,0.85cqw,1.15rem)] leading-snug text-hs-ink">
          {post.text}
        </p>
      ) : null}
      {post.hasImage ? (
        <span className="mt-[0.35cqw] inline-flex items-center gap-1 text-[clamp(0.5rem,0.65cqw,0.9rem)] text-hs-brown">
          <ImageIcon className="size-[0.8cqw]" aria-hidden />
          Foto
        </span>
      ) : null}
    </article>
  );
}

function FeedStream({ posts, now }: { posts: FeedPost[]; now: number }) {
  const listRef = useRef<HTMLOListElement>(null);
  const shown = posts.slice(0, 6);
  const ids = useMemo(() => shown.map((post) => post._id), [shown]);
  const onEnter = useCallback((rows: HTMLElement[]) => {
    flashGold(rows, 1.8);
  }, []);
  useStreamShift(listRef, ids, onEnter);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-[1cqw] text-hs-ink">
      <FeedHeader aside={`${posts.length} publicaciones`} />
      <ol
        ref={listRef}
        className="mt-[0.6cqw] min-h-0 flex-1 space-y-[0.4cqw] overflow-hidden"
      >
        {shown.map((post) => (
          <li key={post._id}>
            <FeedCard post={post} now={now} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One post at a time. The outgoing card fades up, the incoming one reveals
 * author by character and body by masked line; a gold bar counts down to the
 * next rotation.
 */
function FeedSpotlight({
  posts,
  index,
  now,
}: {
  posts: FeedPost[];
  index: number;
  now: number;
}) {
  const reduced = usePrefersReducedMotion();
  const target = posts[index % posts.length];
  const [shown, setShown] = useState<FeedPost | undefined>(target);
  const card = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const targetId = target?._id;
  const shownId = shown?._id;

  useEffect(() => {
    if (!target || targetId === shownId) {return;}
    if (!card.current) {
      setShown(target);
      return;
    }
    // Exit is shorter than the entrance; blur hides the two texts overlapping.
    const tween = gsap.to(
      card.current,
      reduced
        ? { opacity: 0, duration: TV_REDUCED_FADE * 0.75, ease: "none", onComplete: () => setShown(target) }
        : {
            yPercent: -4,
            opacity: 0,
            filter: "blur(3px)",
            duration: 0.28,
            ease: "power2.in",
            onComplete: () => setShown(target),
          },
    );
    return () => {
      settle(tween);
    };
  }, [target, targetId, shownId, reduced]);

  useGSAP(
    () => {
      const el = card.current;
      if (!el) {return;}
      const timeline = gsap.timeline();
      if (bar.current) {
        timeline.fromTo(
          bar.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: (ROTATE_MS - 400) / 1000,
            ease: "none",
            transformOrigin: "0% 50%",
          },
          0,
        );
      }
      if (reduced) {
        timeline.fromTo(
          el,
          { opacity: 0 },
          { opacity: 1, duration: TV_REDUCED_FADE, ease: "none" },
          0,
        );
        return;
      }
      timeline.fromTo(
        el,
        { yPercent: 4, opacity: 0, filter: "blur(3px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.5,
          ease: TV_EASE_OUT,
          clearProps: "filter",
        },
        0,
      );
      const author = el.querySelector<HTMLElement>("[data-author]");
      const body = el.querySelector<HTMLElement>("[data-body]");
      if (author) {
        SplitText.create(author, {
          type: "chars",
          onSplit: (self) =>
            gsap.from(self.chars, {
              yPercent: 100,
              opacity: 0,
              duration: 0.5,
              ease: TV_EASE_POP,
              stagger: 0.025,
              delay: 0.1,
            }),
        });
      }
      if (body) {
        SplitText.create(body, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 100,
              opacity: 0,
              duration: 0.7,
              ease: TV_EASE_OUT,
              stagger: 0.07,
              delay: 0.2,
            }),
        });
      }
    },
    { dependencies: [shownId, reduced], revertOnUpdate: true },
  );

  if (!shown) {return null;}
  const position = posts.findIndex((post) => post._id === shown._id);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-[1cqw] text-hs-ink">
      <FeedHeader
        aside={`${Math.max(position, 0) + 1} / ${posts.length}`}
      />
      <div className="mt-[0.5cqw] h-[0.3cqw] shrink-0 bg-hs-ink/10">
        <div ref={bar} className="h-full w-full origin-left scale-x-0 bg-hs-gold" />
      </div>
      <div
        key={shown._id}
        ref={card}
        className="mt-[0.9cqw] flex min-h-0 flex-1 flex-col"
      >
        <p
          data-author
          className="font-bungee text-[clamp(0.8rem,1.5cqw,2rem)] leading-none uppercase"
        >
          {shown.authorName}
        </p>
        <p className="mt-[0.3cqw] text-[clamp(0.55rem,0.8cqw,1.1rem)] text-hs-brown">
          {shown.teamName ? `${shown.teamName} · ` : ""}
          {timeAgo(shown.createdAt, now)}
        </p>
        <div className="mt-[0.8cqw] min-h-0 flex-1 overflow-hidden border-l-[0.35cqw] border-hs-gold pl-[0.9cqw]">
          {shown.text ? (
            <p
              data-body
              className="text-pretty break-words text-[clamp(0.9rem,2cqw,1.7rem)] leading-snug"
            >
              {shown.text}
            </p>
          ) : null}
        </div>
        {shown.hasImage ? (
          <span className="mt-[0.5cqw] inline-flex shrink-0 items-center gap-1 text-[clamp(0.55rem,0.75cqw,1rem)] text-hs-brown">
            <ImageIcon className="size-[0.9cqw]" aria-hidden />
            Foto adjunta
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function FeedBox({
  mode = "latest",
  source = "participants",
}: {
  mode?: TvFeedMode;
  source?: TvFeedSource;
}) {
  const posts = useQuery(api.tv.listFeed, { source });
  const now = useNow(30_000);
  const rotateTick = useTick(ROTATE_MS);

  if (posts === undefined) {
    return <div className="h-full bg-hs-paper" />;
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-hs-paper p-3 text-hs-ink">
        <p className="text-sm text-hs-brown">Todavía no hay publicaciones</p>
      </div>
    );
  }

  if (mode === "rotate") {
    return <FeedSpotlight posts={posts} index={rotateTick} now={now} />;
  }

  return <FeedStream posts={posts} now={now} />;
}

const MODES: { id: TvFeedMode; label: string }[] = [
  { id: "latest", label: "Últimas" },
  { id: "rotate", label: "Una a una" },
];

const SOURCES: { id: TvFeedSource; label: string }[] = [
  { id: "participants", label: "Participantes" },
  { id: "github", label: "GitHub" },
  { id: "all", label: "Todas" },
];

export function FeedEditor({
  mode,
  source,
  onSave,
  onClose,
}: {
  mode?: TvFeedMode;
  source?: TvFeedSource;
  onSave: (next: { feedMode: TvFeedMode; feedSource: TvFeedSource }) => void;
  onClose?: () => void;
}) {
  const [nextMode, setNextMode] = useState<TvFeedMode>(mode ?? "latest");
  const [nextSource, setNextSource] = useState<TvFeedSource>(
    source ?? "participants",
  );

  return (
    <div
      className="text-hs-ink"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="font-bungee text-sm">Feed</p>
      <label className="mt-3 block text-xs text-hs-brown">
        Modo
        <select
          value={nextMode}
          onChange={(event) => setNextMode(event.target.value as TvFeedMode)}
          className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink"
        >
          {MODES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs text-hs-brown">
        Fuente
        <select
          value={nextSource}
          onChange={(event) =>
            setNextSource(event.target.value as TvFeedSource)
          }
          className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink"
        >
          {SOURCES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onSave({ feedMode: nextMode, feedSource: nextSource })}
        >
          Guardar
        </Button>
        {onClose ? (
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
