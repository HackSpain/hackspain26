"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FeedTab } from "@convex/lib/feedTabs";
import { isEventOpen } from "@/components/event-closed-banner";
import { FeedComposer } from "@/components/feed-composer";
import {
  FEED_PANEL_ID,
  FeedTabs,
  FeedTimeline,
  feedTabId,
} from "@/components/feed-timeline";
import { Page, Skeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSubmitFeatured } from "@/lib/event";
import { useNow } from "@/lib/use-now";

export default function HomePage() {
  const me = useQuery(api.users.me);
  const now = useNow();
  const [tab, setTab] = useState<FeedTab>("posts");
  const eligible = Boolean(
    me &&
      (me.admin ||
        me.role === "admin" ||
        (me.accepted && me.onboardingComplete))
  );
  const eventOpen = isEventOpen(me?.event);
  const project = useQuery(
    api.submissions.mine,
    eligible && eventOpen ? {} : "skip"
  );
  const canPost = eligible && eventOpen;
  const waiting = me === undefined;
  const featuredSubmit =
    me !== undefined &&
    me !== null &&
    eventOpen &&
    project !== undefined &&
    isSubmitFeatured(me.event.endsAt, now) &&
    project?.status !== "submitted";

  return (
    <Page
      title={
        <h1 className="font-bungee text-2xl leading-tight text-balance break-words sm:text-3xl">
          {me ? (
            `Hola, ${me.name ?? "hacker"}`
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </h1>
      }
      description="Lo que está pasando en la hackathon: avances, fotos y los pushes de cada equipo. También desde la CLI con hackspain feed y hackspain post."
    >
      {featuredSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>Entrega tu proyecto</CardTitle>
            <CardDescription>
              Submit está abierto. Envíalo cuando esté listo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/submit">Ir a Submit</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <section aria-label="Feed" className="min-w-0 space-y-4">
        {canPost && me ? <FeedComposer me={me} /> : null}
        {waiting || canPost ? (
          <>
            {canPost ? (
              <FeedTabs value={tab} onChange={setTab} />
            ) : (
              <Skeleton className="h-11 w-full" />
            )}
            <div
              role="tabpanel"
              id={FEED_PANEL_ID}
              aria-labelledby={feedTabId(tab)}
            >
              <FeedTimeline key={tab} tab={tab} meId={me?._id} />
            </div>
          </>
        ) : eventOpen ? (
          <p className="text-sm font-medium text-hs-brown">
            El feed se abre cuando completes tus datos.
          </p>
        ) : null}
      </section>
    </Page>
  );
}
