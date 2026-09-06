"use client";

import { useQuery } from "convex/react";
import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { TvFeedMode, TvFeedSource } from "@/lib/tv";
import { cn } from "@/lib/utils";
import { usePageVisible, usePrefersReducedMotion } from "./motion";

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

function useNow(ms: number) {
  const visible = usePageVisible();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!visible) return;
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
  if (now === 0) return "";
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const seconds = Math.round((at - now) / 1000);
  if (Math.abs(seconds) < 60) return "ahora mismo";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
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

function FeedCard({
  post,
  now,
  large = false,
  enter = false,
}: {
  post: FeedPost;
  now: number;
  large?: boolean;
  enter?: boolean;
}) {
  return (
    <article
      className={cn(
        "border border-hs-ink/15 bg-hs-sand/40 px-2.5 py-2 text-hs-ink",
        enter && "tv-stream-row",
      )}
    >
      <p className="font-bungee text-[10px] uppercase">{post.authorName}</p>
      <p className="text-[11px] text-hs-brown">
        {post.teamName ? `${post.teamName} · ` : ""}
        {timeAgo(post.createdAt, now)}
      </p>
      {post.text ? (
        <p
          className={cn(
            "mt-1 text-pretty break-words text-hs-ink",
            large
              ? "line-clamp-8 text-[clamp(0.95rem,2.2cqw,1.4rem)] leading-snug"
              : "line-clamp-4 text-xs leading-snug",
          )}
        >
          {post.text}
        </p>
      ) : null}
      {post.hasImage ? (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-hs-brown">
          <ImageIcon className="size-3" aria-hidden />
          Foto
        </span>
      ) : null}
    </article>
  );
}

export function FeedBox({
  mode = "latest",
  source = "participants",
}: {
  mode?: TvFeedMode;
  source?: TvFeedSource;
}) {
  const reduced = usePrefersReducedMotion();
  const posts = useQuery(api.tv.listFeed, { source });
  const now = useNow(30_000);
  const rotateTick = useTick(8000);

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
    const post = posts[rotateTick % posts.length];
    if (!post) return null;
    return (
      <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
        <p className="font-bungee text-xs">Feed</p>
        <div
          key={post._id}
          className={cn("mt-2 min-h-0 flex-1", !reduced && "tv-stream-row")}
        >
          <FeedCard post={post} now={now} large />
        </div>
      </div>
    );
  }

  const shown = posts.slice(0, 6);

  return (
    <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
      <p className="font-bungee text-xs">Feed</p>
      <ol className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {shown.map((post, index) => (
          <li key={post._id}>
            <FeedCard post={post} now={now} enter={!reduced && index === 0} />
          </li>
        ))}
      </ol>
    </div>
  );
}

const MODES: Array<{ id: TvFeedMode; label: string }> = [
  { id: "latest", label: "Últimas" },
  { id: "rotate", label: "Una a una" },
];

const SOURCES: Array<{ id: TvFeedSource; label: string }> = [
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
  onClose: () => void;
}) {
  const [nextMode, setNextMode] = useState<TvFeedMode>(mode ?? "latest");
  const [nextSource, setNextSource] = useState<TvFeedSource>(
    source ?? "participants",
  );

  return (
    <div
      className="absolute inset-2 z-30 overflow-auto border-[3px] border-hs-ink bg-hs-paper p-3 text-hs-ink"
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
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
