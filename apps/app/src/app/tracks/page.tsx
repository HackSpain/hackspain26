"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Field, FormError, FormNotice, LoadingText, Page, errorMessage } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { urlOf, type UrlEntry } from "@/lib/urls";
import { perkName } from "@/lib/utils";

type TrackRow = {
  _id: Id<"tracks">;
  slug: string;
  label: string;
  body: string;
  note: string;
};

const PLACEHOLDER_SLUGS = new Set(["ml", "non-tech"]);

type SubmissionRow = {
  name: string;
  description: string;
  urls: UrlEntry[];
  challengeIds: Id<"tracks">[];
  perkIds: Id<"perks">[];
  status: "draft" | "submitted";
};

type CatalogRow = {
  perk: { _id: Id<"perks">; company: string; title: string };
};

export default function TracksPage() {
  const tracks = useQuery(api.tracks.list);
  const settings = useQuery(api.tracks.settings);
  const mine = useQuery(api.submissions.mine);
  const catalog = useQuery(api.perks.listCatalog);
  const ensureCatalog = useMutation(api.tracks.ensureCatalog);

  useEffect(() => {
    if (tracks === undefined) return;
    const stale =
      tracks.length === 0 || tracks.some((track) => PLACEHOLDER_SLUGS.has(track.slug));
    if (stale) {
      void ensureCatalog({});
    }
  }, [tracks, ensureCatalog]);

  if (tracks === undefined || settings === undefined || mine === undefined) {
    return <LoadingText />;
  }

  return (
    <TracksReady
      tracks={tracks}
      catalog={catalog}
      mine={mine}
      submissionsOpen={settings.submissionsOpen}
    />
  );
}

function TracksReady({
  tracks,
  catalog,
  mine,
  submissionsOpen,
}: {
  tracks: TrackRow[];
  catalog: CatalogRow[] | undefined;
  mine: SubmissionRow | null;
  submissionsOpen: boolean;
}) {
  const saveDraft = useMutation(api.submissions.saveDraft);
  const submit = useMutation(api.submissions.submit);
  const [name, setName] = useState(mine?.name ?? "");
  const [description, setDescription] = useState(mine?.description ?? "");
  const [repoUrl, setRepoUrl] = useState(urlOf(mine?.urls, "repo") ?? "");
  const [demoUrl, setDemoUrl] = useState(urlOf(mine?.urls, "demo") ?? "");
  const [challengeIds, setChallengeIds] = useState<Id<"tracks">[]>(
    mine?.challengeIds ?? [],
  );
  const [perkIds, setPerkIds] = useState<Id<"perks">[]>(mine?.perkIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const locked = mine?.status === "submitted";
  const entered = new Set(mine?.challengeIds ?? []);

  function toggleChallenge(id: Id<"tracks">) {
    setChallengeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function togglePerk(id: Id<"perks">) {
    setPerkIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const payload = {
    name,
    description,
    repoUrl: repoUrl || undefined,
    demoUrl: demoUrl || undefined,
    challengeIds,
    perkIds,
  };

  return (
    <Page
      title="Retos"
      description="Un proyecto. Entra en tantos retos como quieras."
    >
      <FormError message={error} />
      <FormNotice message={message} />

      {tracks.length === 0 ? (
        <p className="text-hs-brown">Cargando retos…</p>
      ) : (
        <div className="hs-stagger grid gap-4 md:grid-cols-2">
          {tracks.map((track) => (
            <Card key={track._id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <span>{track.label}</span>
                  {entered.has(track._id) ? (
                    <Badge variant="gold" className="whitespace-nowrap">
                      {mine?.status === "submitted" ? "Enviado" : "En el borrador"}
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

      <Card>
        <CardHeader>
          <CardTitle>Proyecto</CardTitle>
          <CardDescription>
            Rellena el proyecto una vez y elige todos los retos en los que entra.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Nombre del proyecto" htmlFor="project-name">
            <Input
              id="project-name"
              value={name}
              disabled={locked}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Descripción" htmlFor="project-description">
            <Textarea
              id="project-description"
              value={description}
              disabled={locked}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="URL del repo" htmlFor="repo-url">
              <Input
                id="repo-url"
                value={repoUrl}
                disabled={locked}
                placeholder="https://github.com/…"
                onChange={(event) => setRepoUrl(event.target.value)}
              />
            </Field>
            <Field label="URL de la demo" htmlFor="demo-url">
              <Input
                id="demo-url"
                value={demoUrl}
                disabled={locked}
                placeholder="https://…"
                onChange={(event) => setDemoUrl(event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="font-bungee text-xs">Retos</p>
            {tracks.map((track) => (
              <label key={track._id} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={challengeIds.includes(track._id)}
                  disabled={locked}
                  onCheckedChange={() => toggleChallenge(track._id)}
                />
                <span>
                  {track.label}
                  <span className="block text-hs-brown">{track.note}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="font-bungee text-xs">Herramientas de partners</p>
            {!catalog ? (
              <p className="text-sm text-hs-brown">Cargando partners…</p>
            ) : catalog.length === 0 ? (
              <p className="text-sm text-hs-brown">Aún no hay herramientas de partners.</p>
            ) : (
              catalog.map(({ perk }) => (
                <label key={perk._id} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={perkIds.includes(perk._id)}
                    disabled={locked}
                    onCheckedChange={() => togglePerk(perk._id)}
                  />
                  <span>{perkName(perk.company, perk.title)}</span>
                </label>
              ))
            )}
          </div>

          {locked ? (
            <p className="text-sm text-hs-brown">Este proyecto ya está enviado y bloqueado.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setSaving(true);
                  void saveDraft(payload)
                    .then(() => setMessage("Borrador guardado"))
                    .catch((err: unknown) =>
                      setError(errorMessage(err, "No se ha podido guardar el borrador")),
                    )
                    .finally(() => setSaving(false));
                }}
              >
                Guardar borrador
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={!submissionsOpen || saving}
                title={
                  submissionsOpen
                    ? undefined
                    : "El envío de proyectos aún no está abierto"
                }
                onClick={() => {
                  if (!submissionsOpen) return;
                  setError(null);
                  setSaving(true);
                  void submit(payload)
                    .then(() => setMessage("Proyecto enviado"))
                    .catch((err: unknown) =>
                      setError(errorMessage(err, "No se ha podido enviar")),
                    )
                    .finally(() => setSaving(false));
                }}
              >
                Enviar proyecto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          {submissionsOpen
            ? "El envío está abierto. Un proyecto puede entrar en varios retos."
            : "El envío de proyectos aún no está abierto. Puedes guardar un borrador — retos y partners incluidos — y enviarlo después."}
        </AlertDescription>
      </Alert>
    </Page>
  );
}
