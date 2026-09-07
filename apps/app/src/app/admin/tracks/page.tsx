"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Field, LoadingText, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Frame,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { urlLabel } from "@/lib/urls";
import { perkName, submissionStatusLabel } from "@/lib/utils";

export default function AdminTracksPage() {
  const tracks = useQuery(api.tracks.adminList);
  const settings = useQuery(api.tracks.adminSettings);
  const submissions = useQuery(api.submissions.adminList);
  const ensureDefaults = useMutation(api.tracks.adminEnsureDefaults);
  const update = useMutation(api.tracks.adminUpdate);
  const setOpen = useMutation(api.tracks.adminSetSubmissionsOpen);
  const [drafts, setDrafts] = useState<
    Record<string, { label: string; body: string; note: string }>
  >({});

  useEffect(() => {
    if (tracks === undefined) {
      return;
    }
    const stale =
      tracks.length === 0 ||
      tracks.some(
        (track) =>
          track.active && (track.slug === "ml" || track.slug === "non-tech")
      );
    if (stale) {
      void ensureDefaults({});
    }
  }, [tracks, ensureDefaults]);

  if (!tracks || !settings || submissions === undefined) {
    return <LoadingText />;
  }

  return (
    <Page
      title="Retos y proyectos"
      description="Los retos viven en Convex. Un proyecto puede entrar en todos los retos que elijas."
    >
      <Card>
        <CardHeader>
          <CardTitle>Ventana de envío</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Badge variant={settings.submissionsOpen ? "gold" : "default"}>
            {settings.submissionsOpen ? "Abierta" : "Cerrada"}
          </Badge>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              void setOpen({ submissionsOpen: !settings.submissionsOpen })
            }
          >
            {settings.submissionsOpen ? "Cerrar envíos" : "Abrir envíos"}
          </Button>
        </CardContent>
      </Card>

      {tracks.map((track) => {
        const draft = drafts[track._id] ?? {
          body: track.body,
          label: track.label,
          note: track.note,
        };
        const under = submissions.filter((row) =>
          row.challengeIds.includes(track._id)
        );
        return (
          <Card key={track._id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {track.label}
                <Badge>{track.active ? "Activo" : "Oculto"}</Badge>
                <Badge variant="gold">
                  {under.length} {under.length === 1 ? "proyecto" : "proyectos"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nombre">
                  <Input
                    value={draft.label}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [track._id]: { ...draft, label: event.target.value },
                      }))
                    }
                  />
                </Field>
                <Field label="Nota">
                  <Input
                    value={draft.note}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [track._id]: { ...draft, note: event.target.value },
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Texto">
                <Textarea
                  value={draft.body}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [track._id]: { ...draft, body: event.target.value },
                    }))
                  }
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void update({
                      trackId: track._id as Id<"tracks">,
                      label: draft.label,
                      body: draft.body,
                      note: draft.note,
                    })
                  }
                >
                  Guardar texto
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void update({
                      trackId: track._id as Id<"tracks">,
                      active: !track.active,
                    })
                  }
                >
                  {track.active ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {under.length === 0 ? (
                <p className="text-sm text-hs-brown">
                  Aún no hay proyectos en este reto.
                </p>
              ) : (
                <div className="space-y-3">
                  {under.map((row) => (
                    <Frame key={row._id} tone="navy">
                      <p className="font-bungee text-sm">
                        {row.name || "Sin título"}{" "}
                        <Badge>{submissionStatusLabel(row.status)}</Badge>
                      </p>
                      <p className="text-hs-brown">
                        {row.teamName ?? "Individual"} ·{" "}
                        {row.challenges.map((c) => c.label).join(", ")}
                      </p>
                      {row.perks.length > 0 ? (
                        <p>
                          Usado:{" "}
                          {row.perks
                            .map((perk) => perkName(perk.company, perk.title))
                            .join(", ")}
                        </p>
                      ) : null}
                      {row.urls.map((entry) => (
                        <p key={entry.kind}>
                          {urlLabel(entry.kind)}: {entry.url}
                        </p>
                      ))}
                    </Frame>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Page>
  );
}
