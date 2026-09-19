"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import { LoadingText, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TracksPage() {
  const tracks = useQuery(api.tracks.list);
  const mine = useQuery(api.submissions.mine);

  if (tracks === undefined || mine === undefined) {
    return <LoadingText />;
  }

  const submitted = new Set((mine?.submittedTracks ?? []).map((row) => row._id));

  return (
    <Page
      title="Retos"
      description="Un proyecto puede entrar en varios. La entrega es en Submit, un reto detrás de otro."
    >
      {tracks.length === 0 ? (
        <p className="text-hs-brown">Cargando retos…</p>
      ) : (
        <div className="hs-stagger grid gap-4 md:grid-cols-2">
          {tracks.map((track) => (
            <Card key={track._id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <span>{track.label}</span>
                  {submitted.has(track._id) ? (
                    <Badge variant="gold" className="whitespace-nowrap">
                      Enviado
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>{track.note}</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{track.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button asChild>
        <Link href="/submit">Ir a Submit</Link>
      </Button>
    </Page>
  );
}
