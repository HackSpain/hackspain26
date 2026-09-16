"use client";

import { useMutation, useQuery } from "convex/react";
import { GitBranch, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/avatar";
import { LoadingText } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FeedPost = FunctionReturnType<typeof api.feed.list>[number];

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

/** Team, project and challenges: the "who is building what" line under the author. */
function PostContext({ post }: { post: FeedPost }) {
  const { project } = post;
  const repo = post.kind === "github" ? post.github?.repo : undefined;
  if (!post.teamName && !project && !repo) {return null;}
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-hs-brown">
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

function PostCard({ post }: { post: FeedPost }) {
  const remove = useMutation(api.feed.remove);
  const [busy, setBusy] = useState(false);
  const isGithub = post.kind === "github";
  const who = isGithub
    ? (post.teamName ?? post.github?.repo ?? "GitHub")
    : (post.author?.name ?? post.author?.email ?? "Alguien");

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
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
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
                <span className="text-hs-brown">· {timeAgo(post.createdAt)}</span>
              </div>
              <PostContext post={post} />
            </div>
          </div>
          {post.mine ? (
            <button
              type="button"
              aria-label="Borrar publicación"
              className="inline-flex size-11 shrink-0 items-center justify-center text-hs-brown hover:text-hs-red disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove({ postId: post._id });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {post.text ? (
          <p className="text-pretty whitespace-pre-wrap break-words text-sm leading-relaxed">
            {post.text}
          </p>
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
      </CardContent>
    </Card>
  );
}

export const FEED_EMPTY_COPY = "Todavía no hay nada. Sé el primero en publicar.";

export function FeedTimeline({
  limit = 50,
  className,
  empty = "default",
}: {
  limit?: number;
  className?: string;
  empty?: "default" | "none";
}) {
  const posts = useQuery(api.feed.list, { limit });

  if (posts === undefined) {return <LoadingText />;}
  if (posts.length === 0) {
    if (empty === "none") {return null;}
    return (
      <p className="text-pretty text-sm font-medium text-hs-brown">
        {FEED_EMPTY_COPY}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </div>
  );
}
