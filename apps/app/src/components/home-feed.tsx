"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { FeedComposer } from "@/components/feed-composer";
import { FEED_EMPTY_COPY, FeedTimeline } from "@/components/feed-timeline";
import { LoadingText } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HomeFeed() {
  const posts = useQuery(api.feed.list, { limit: 50 });
  const empty = posts !== undefined && posts.length === 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden">
      <Card className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col gap-2 overflow-hidden lg:h-[calc(100%-0.5rem)]">
        <CardHeader className="flex shrink-0 flex-row items-baseline justify-between gap-3">
          <CardTitle>
            <h2 className="text-base leading-snug">Feed</h2>
          </CardTitle>
          <Link
            href="/feed"
            className="text-sm font-medium text-hs-navy underline-offset-4 hover:underline"
          >
            Ver todo
          </Link>
        </CardHeader>
        <CardContent
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col gap-3",
            empty && "justify-between",
          )}
        >
          {empty ? (
            <p className="shrink-0 text-pretty text-sm text-hs-brown">
              {FEED_EMPTY_COPY}
            </p>
          ) : null}
          <div className="shrink-0">
            <FeedComposer framed={false} />
          </div>
          {posts === undefined ? (
            <LoadingText />
          ) : empty ? null : (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
              <FeedTimeline empty="none" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
