"use client";

import { FeedComposer } from "@/components/feed-composer";
import { FeedTimeline } from "@/components/feed-timeline";
import { Page } from "@/components/page";

export default function FeedPage() {
  return (
    <Page
      title="Feed"
      description="Lo que está pasando en la hackathon: avances, fotos y los pushes de cada equipo. También desde la CLI con hackspain feed y hackspain post."
    >
      <FeedComposer />
      <FeedTimeline />
    </Page>
  );
}
