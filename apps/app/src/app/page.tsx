"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EventClosedNotice, isEventOpen } from "@/components/event-closed-banner";
import { FeedComposer } from "@/components/feed-composer";
import { FeedTimeline } from "@/components/feed-timeline";
import { LoadingText, Page } from "@/components/page";
import { SectionTiles } from "@/components/section-tiles";

/**
 * Home: the feed next to a launcher of section tiles. Sections open on their
 * own URL and come back here through "Volver al inicio".
 */
export default function HomePage() {
  const me = useQuery(api.users.me);
  if (!me) {return <LoadingText />;}

  const eligible = me.role === "admin" || (me.accepted && me.onboardingComplete);
  // feed.list throws EVENT_CLOSED outside the window, so never mount it then.
  // Missing `event` (older users.me) counts as open, same as unscheduled.
  const eventOpen = isEventOpen(me.event);
  const canPost = eligible && eventOpen;

  return (
    <Page
      title={
        <h1 className="font-bungee text-2xl leading-tight text-balance break-words sm:text-3xl">
          Hola, {me.name ?? "hacker"}
        </h1>
      }
      description="Lo que está pasando en la hackathon: avances, fotos y los pushes de cada equipo. También desde la CLI con hackspain feed y hackspain post."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        {/* Pinned to the viewport on lg. The launcher may be taller than a short
            window: cap it and let it scroll internally so every tile stays
            reachable. The 4 px negative margin + padding gives focus rings room
            inside the scroll container without moving the tiles. */}
        <SectionTiles
          sections={me.sections}
          eventOpen={eventOpen}
          className="lg:sticky lg:top-5 lg:order-2 lg:-m-1 lg:max-h-[calc(100dvh-2.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]"
        />
        <section aria-label="Feed" className="min-w-0 space-y-4 lg:order-1">
          {canPost ? <FeedComposer /> : null}
          {canPost ? (
            <FeedTimeline />
          ) : eventOpen ? (
            <p className="text-sm font-medium text-hs-brown">
              El feed se abre cuando completes tus datos.
            </p>
          ) : me.event ? (
            <EventClosedNotice event={me.event} />
          ) : null}
        </section>
      </div>
    </Page>
  );
}
