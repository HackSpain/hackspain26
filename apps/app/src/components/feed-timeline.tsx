"use client";

import { useQuery } from "convex/react";
import { GitBranch } from "lucide-react";
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { FeedTab } from "@convex/lib/feedTabs";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/avatar";
import { MentionText } from "@/components/mention-textarea";
import { LoadingText } from "@/components/page";
import { PostSocial } from "@/components/post-social";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FeedPost = FunctionReturnType<typeof api.feed.list>[number] & {
  /** Set on optimistic rows inserted by the composer before the server confirms. */
  pending?: boolean;
};

function timeAgo(at: number, now = Date.now()): string {
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

function hasPostContext(post: FeedPost): boolean {
  const repo = post.kind === "github" ? post.github?.repo : undefined;
  return Boolean(post.teamName || post.project || repo);
}

/** Team, project and challenges: the "who is building what" line under the author. */
function PostContext({ post }: { post: FeedPost }) {
  const { project } = post;
  const repo = post.kind === "github" ? post.github?.repo : undefined;
  if (!hasPostContext(post)) {return null;}
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-hs-brown">
      {post.teamName ? (
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={post.teamName} src={post.teamLogoUrl} className="size-4 border text-[8px]" />
          Equipo <span className="font-semibold text-hs-ink">{post.teamName}</span>
        </span>
      ) : null}
      {project ? (
        <span>
          {post.teamName ? "· " : ""}Proyecto{" "}
          <span className="font-semibold text-hs-ink">
            {project.name || "sin nombre"}
          </span>
          {project.status === "submitted" ? " (enviado)" : ""}
        </span>
      ) : null}
      {project?.challenges.map((label) => (
        <span
          key={label}
          className="border border-hs-ink/30 px-1.5 py-px text-[11px] uppercase tracking-wide"
        >
          {label}
        </span>
      ))}
      {repo ? (
        <span>
          {post.teamName || project ? "· " : ""}
          <span className="font-mono">{repo}</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Optimistic rows and their confirmed twin share the composer's `clientId`, so
 * React keeps the same card while `pending` flips and the opacity can ease
 * instead of the node being replaced.
 */
function postKey(post: FeedPost): string {
  return post.clientId ?? post._id;
}

function PostCard({ post, fresh, meId }: { post: FeedPost; fresh: boolean; meId: Id<"users"> | undefined }) {
  const isGithub = post.kind === "github";
  const who = isGithub
    ? (post.teamName ?? post.github?.repo ?? "GitHub")
    : (post.author?.name ?? "Alguien");

  // The enter animation lives on a wrapper: `hs-enter` fills `opacity` forwards
  // and would otherwise override the pending dim on the card itself.
  return (
    <div className={fresh ? "hs-enter" : undefined}>
    <Card
      className={cn(
        "gap-0 motion-safe:transition-opacity motion-safe:duration-[var(--duration-enter)] motion-safe:ease-[var(--ease-out)]",
        post.pending && "opacity-60",
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {isGithub ? (
            <span
              className="flex size-10 shrink-0 items-center justify-center border-[3px] border-hs-ink bg-hs-gold"
              aria-hidden
            >
              <GitBranch className="size-5" />
            </span>
          ) : (
            <Avatar
              name={post.author?.name}
              src={post.author?.avatarUrl}
              className="size-10 text-sm"
            />
          )}
          {/* Two lines: pinned to the avatar's top and bottom edges. One line
              (no team/project/repo): centred on the picture instead. */}
          <div
            className={cn(
              "flex min-h-10 min-w-0 flex-col",
              hasPostContext(post) ? "justify-between" : "justify-center",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5">
              <span className="font-semibold break-words">{who}</span>
              {isGithub ? (
                <Badge variant="gold" className="gap-1">
                  <GitBranch className="size-3" aria-hidden /> GitHub
                </Badge>
              ) : post.author?.userType ? (
                <Badge>{post.author.userType}</Badge>
              ) : null}
              {isGithub && post.github?.actor ? (
                <span className="text-hs-brown">· {post.github.actor}</span>
              ) : null}
              <span className="text-hs-brown">
                · {post.pending ? "publicando…" : timeAgo(post.createdAt)}
              </span>
            </div>
            <PostContext post={post} />
          </div>
        </div>
        {post.text ? (
          <MentionText
            text={post.text}
            mentions={post.mentions}
            meId={meId}
            className="text-pretty whitespace-pre-wrap break-words text-sm leading-relaxed"
          />
        ) : null}
        {post.imagePath ? (
          <a href={post.imagePath} target="_blank" rel="noreferrer">
            {/* Served by /api/files on our own origin; plain img keeps it out of next/image's optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imagePath}
              alt=""
              className="max-h-96 w-auto border-[3px] border-hs-ink object-contain outline outline-1 outline-black/10"
            />
          </a>
        ) : null}
        {isGithub && post.github ? (
          <a
            href={post.github.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-hs-navy underline-offset-4 hover:underline"
          >
            Ver en GitHub
          </a>
        ) : null}
        {/* An optimistic row has no server id yet, so nothing to react to. */}
        {post.pending ? null : <PostSocial postId={post._id} meId={meId} />}
      </CardContent>
    </Card>
    </div>
  );
}

const FEED_TABS: { empty: string; label: string; value: FeedTab }[] = [
  {
    empty: "Todavía no hay nada. Sé el primero en publicar.",
    label: "Posts",
    value: "posts",
  },
  {
    empty: "Todavía no hay actividad. Los pushes aparecen cuando un equipo vincula su repo.",
    label: "GitHub",
    value: "github",
  },
  {
    empty: "Todavía no hay memes. Publica con #meme y saldrá aquí.",
    label: "#meme",
    value: "meme",
  },
];

export function feedTabId(tab: FeedTab): string {
  return `feed-tab-${tab}`;
}

export const FEED_PANEL_ID = "feed-panel";

/** Same look as the judging view toggle; arrow keys move between tabs. */
export function FeedTabs({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (value: FeedTab) => void;
}) {
  const list = useRef<HTMLDivElement | null>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = FEED_TABS.findIndex((tab) => tab.value === value);
    let next;
    if (event.key === "ArrowRight") {
      next = FEED_TABS[(index + 1) % FEED_TABS.length];
    } else if (event.key === "ArrowLeft") {
      next = FEED_TABS[(index - 1 + FEED_TABS.length) % FEED_TABS.length];
    } else if (event.key === "Home") {
      next = FEED_TABS[0];
    } else if (event.key === "End") {
      next = FEED_TABS.at(-1);
    }
    if (!next) {return;}
    event.preventDefault();
    onChange(next.value);
    list.current
      ?.querySelector<HTMLButtonElement>(`#${feedTabId(next.value)}`)
      ?.focus();
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Filtrar el feed"
      onKeyDown={onKeyDown}
      className="box-border grid h-11 grid-cols-3 border-[3px] border-hs-ink [&>:not(:last-child)]:border-r-[3px] [&>:not(:last-child)]:border-hs-ink"
    >
      {FEED_TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={feedTabId(tab.value)}
            aria-selected={selected}
            aria-controls={FEED_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "h-full min-w-0 truncate px-3 font-bungee text-xs uppercase outline-none focus-visible:border-[3px] focus-visible:border-hs-navy",
              selected
                ? "bg-hs-gold text-hs-ink"
                : "bg-hs-paper text-hs-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand",
            )}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Mount with `key={tab}` so the enter-animation baseline resets per tab. */
export function FeedTimeline({
  tab,
  limit = 50,
  className,
}: {
  tab: FeedTab;
  limit?: number;
  className?: string;
}) {
  const posts = useQuery(api.feed.list, { limit, tab });
  const meId = useQuery(api.users.me)?._id;
  // Keys present when the list first loaded never animate in; only posts that
  // arrive afterwards (yours, someone else's, GitHub) get the enter transition.
  // The set is frozen on purpose: a later post keeps `hs-enter` for its whole
  // life, so confirming the optimistic row ~100 ms later cannot cut the motion.
  const [initial, setInitial] = useState<ReadonlySet<string> | null>(null);
  if (posts && initial === null) {
    setInitial(new Set(posts.map(postKey)));
  }

  if (posts === undefined) {return <LoadingText />;}
  if (posts.length === 0) {
    return (
      <p className="text-pretty text-sm font-medium text-hs-brown">
        {FEED_TABS.find((entry) => entry.value === tab)?.empty}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {posts.map((post) => {
        const key = postKey(post);
        return (
          <PostCard
            key={key}
            post={post}
            fresh={initial !== null && !initial.has(key)}
            meId={meId}
          />
        );
      })}
    </div>
  );
}
