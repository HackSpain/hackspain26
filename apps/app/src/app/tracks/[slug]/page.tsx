"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { TrackBrief } from "@/components/markdown";
import { EmptyState, LoadingText, Page } from "@/components/page";
import { ProjectCliDialog } from "@/components/project-cli-dialog";
import { TrackLogo } from "@/components/track-tag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TrackBriefPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const track = useQuery(api.tracks.get, slug ? { slug } : "skip");

  if (track === undefined) {
    return <LoadingText />;
  }
  if (track === null) {
    return (
      <Page title="Reto">
        <EmptyState title="Reto no encontrado">
          Este reto no existe o ya no está visible.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page
      title={
        <h1>
          <TrackLogo track={track} className="h-10 max-w-72 text-2xl sm:text-3xl" />
        </h1>
      }
      description={track.note}
    >
      <Card>
        <CardContent className="max-w-prose py-2">
          <TrackBrief markdown={track.markdown} body={track.body} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ProjectCliDialog>
          <Button className="w-full sm:w-auto">Cómo apuntarse</Button>
        </ProjectCliDialog>
        {track.website ? (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={track.website} target="_blank" rel="noreferrer">
              Conoce al sponsor
            </a>
          </Button>
        ) : null}
        <code className="font-mono text-xs text-hs-brown sm:ml-auto">
          hackspain track register {track.slug}
        </code>
      </div>
    </Page>
  );
}
