"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  parseGithubRepoUrl,
  parseOptionalProductUrl,
  parseProjectName,
  parseYoutubeWatchUrl,
} from "@convex/lib/submission";
import { VideoFrame } from "@/components/judging/video-frame";
import {
  errorMessage,
  Field,
  FormError,
  LoadingText,
  Page,
} from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { urlOf } from "@/lib/urls";
import { cn, perkName } from "@/lib/utils";

const TRACK_PARAM = "track";

function SubmitPage() {
  const tracks = useQuery(api.tracks.list);
  const settings = useQuery(api.tracks.settings);
  const mine = useQuery(api.submissions.mine);
  const catalog = useQuery(api.perks.listCatalog);
  const team = useQuery(api.teams.mine);

  if (
    tracks === undefined ||
    settings === undefined ||
    mine === undefined ||
    team === undefined
  ) {
    return <LoadingText />;
  }

  return (
    <SubmitReady
      catalog={catalog}
      mine={mine}
      submissionsOpen={settings.submissionsOpen}
      teamRepo={team?.repoUrl ?? ""}
      tracks={tracks}
    />
  );
}

export default function SubmitRoute() {
  return (
    <Suspense fallback={<LoadingText />}>
      <SubmitPage />
    </Suspense>
  );
}

type TrackRow = {
  _id: Id<"tracks">;
  slug: string;
  label: string;
  note: string;
};

type Mine = FunctionReturnType<typeof api.submissions.mine>;
type Catalog = FunctionReturnType<typeof api.perks.listCatalog> | undefined;

function SubmitReady({
  catalog,
  mine,
  submissionsOpen,
  teamRepo,
  tracks,
}: {
  catalog: Catalog;
  mine: Mine;
  submissionsOpen: boolean;
  teamRepo: string;
  tracks: TrackRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const submittedIds = new Set((mine?.submittedTracks ?? []).map((row) => row._id));
  const registered = new Set(mine?.challengeIds ?? []);
  const pending = tracks.filter(
    (track) => registered.has(track._id) && !submittedIds.has(track._id),
  );
  const requested = searchParams.get(TRACK_PARAM);
  const selected =
    pending.find((track) => track.slug === requested) ??
    (pending.length === 1 && !lastSubmitted ? (pending[0] ?? null) : null);

  function openTrack(slug: string | null) {
    const next = new URLSearchParams(searchParams);
    if (slug) {
      next.set(TRACK_PARAM, slug);
    } else {
      next.delete(TRACK_PARAM);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Page
      title="Submit"
      description="Un vídeo de 3 minutos, el repo público y, si puedes, el producto en marcha."
    >
      {!submissionsOpen ? (
        <Alert>
          <AlertDescription>
            El envío aún no está abierto. Puedes preparar los enlaces; el botón
            se activa cuando lo abramos.
          </AlertDescription>
        </Alert>
      ) : null}

      {pending.length === 0 ? (
        (mine?.submittedTracks ?? []).length > 0 ? (
          <DoneCard tracks={mine?.submittedTracks ?? []} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Entra en un reto</CardTitle>
              <CardDescription>
                Un equipo, un reto. Regístralo en la CLI y vuelve aquí a
                entregar el vídeo y el repo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/tracks">Ver retos</Link>
              </Button>
            </CardContent>
          </Card>
        )
      ) : lastSubmitted && !selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Enviado</CardTitle>
            <CardDescription>
              {tracks.find((track) => track.slug === lastSubmitted)?.label ??
                "Reto"}{" "}
              ya está dentro. Puedes entregar el siguiente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => {
                setLastSubmitted(null);
                openTrack(null);
              }}
            >
              Entregar el siguiente reto
            </Button>
          </CardContent>
        </Card>
      ) : selected ? (
        <SubmitForm
          catalog={catalog}
          mine={mine}
          onBack={pending.length > 1 ? () => openTrack(null) : undefined}
          onSubmitted={() => {
            setLastSubmitted(selected.slug);
            openTrack(null);
          }}
          submissionsOpen={submissionsOpen}
          teamRepo={teamRepo}
          track={selected}
        />
      ) : (
        <TrackPicker
          onPick={openTrack}
          pending={pending}
          submitted={mine?.submittedTracks ?? []}
        />
      )}
    </Page>
  );
}

function DoneCard({
  tracks,
}: {
  tracks: { _id: string; label: string; slug: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyecto enviado</CardTitle>
        <CardDescription>
          Ya está dentro. Si algo hay que corregir, habla con organización.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {tracks.map((track) => (
          <Badge key={track._id} variant="gold">
            {track.label}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function TrackPicker({
  onPick,
  pending,
  submitted,
}: {
  onPick: (slug: string) => void;
  pending: TrackRow[];
  submitted: { _id: string; label: string }[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-pretty text-hs-brown">
        Elige el reto al que entregas ahora. Después puedes hacer el siguiente.
      </p>
      <div className="hs-stagger grid gap-3 md:grid-cols-2">
        {pending.map((track) => (
          <button
            key={track._id}
            type="button"
            onClick={() => onPick(track.slug)}
            className="border-[3px] border-hs-ink bg-hs-paper p-4 text-left motion-safe:transition-[transform,filter] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] hs-hover-bright"
          >
            <p className="font-bungee text-base leading-snug">{track.label}</p>
            <p className="mt-1 text-sm font-medium text-hs-brown">{track.note}</p>
          </button>
        ))}
      </div>
      {submitted.length > 0 ? (
        <p className="text-sm text-hs-brown">
          Ya enviado: {submitted.map((track) => track.label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function SubmitForm({
  catalog,
  mine,
  onBack,
  onSubmitted,
  submissionsOpen,
  teamRepo,
  track,
}: {
  catalog: Catalog;
  mine: Mine;
  onBack?: () => void;
  onSubmitted: () => void;
  submissionsOpen: boolean;
  teamRepo: string;
  track: TrackRow;
}) {
  const submit = useAction(api.submissions.submit);
  const verifyRepo = useAction(api.submissions.verifyRepo);
  const locked = mine?.status === "submitted";
  const [name, setName] = useState(mine?.name ?? "");
  const [videoUrl, setVideoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState(
    urlOf(mine?.urls, "repo") ?? teamRepo
  );
  const [demoUrl, setDemoUrl] = useState(urlOf(mine?.urls, "demo") ?? "");
  const [perkIds, setPerkIds] = useState<Id<"perks">[]>(mine?.perkIds ?? []);
  const [repoNote, setRepoNote] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameParsed = name.trim() ? parseProjectName(name) : null;
  const nameError = nameParsed && !nameParsed.ok ? nameParsed.message : null;
  const videoParsed = videoUrl.trim() ? parseYoutubeWatchUrl(videoUrl) : null;
  const repoParsed = repoUrl.trim() ? parseGithubRepoUrl(repoUrl) : null;
  const demoParsed = parseOptionalProductUrl(demoUrl);

  const canSubmit = useMemo(() => {
    if (!submissionsOpen || saving) {
      return false;
    }
    return (
      parseProjectName(name).ok &&
      parseYoutubeWatchUrl(videoUrl).ok &&
      parseGithubRepoUrl(repoUrl).ok &&
      demoParsed.ok
    );
  }, [demoParsed.ok, name, repoUrl, saving, submissionsOpen, videoUrl]);

  async function onRepoBlur() {
    if (!repoParsed?.ok) {
      setRepoNote(null);
      return;
    }
    try {
      const result = await verifyRepo({ url: repoUrl });
      setRepoNote(result.ok ? result.message : result.message);
      if (result.ok && result.url) {
        setRepoUrl(result.url);
      }
    } catch (error: unknown) {
      setRepoNote(errorMessage(error, "No hemos podido comprobar el repo."));
    }
  }

  return (
    <div className="space-y-4">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          Elegir otro reto
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>{track.label}</span>
            <Badge>{track.note}</Badge>
          </CardTitle>
          <CardDescription>
            Tres minutos en YouTube: qué habéis hecho, por qué, por qué este
            reto y esta idea, y una demo del producto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={formError} />

          <Field label="Nombre del proyecto" htmlFor="project-name">
            <Input
              id="project-name"
              value={name}
              disabled={locked}
              onChange={(event) => setName(event.target.value)}
            />
            {nameError ? (
              <p className="text-sm text-hs-red">{nameError}</p>
            ) : null}
          </Field>

          <Field
            label="Vídeo de YouTube"
            htmlFor="video-url"
            hint="Obligatorio. Enlace de youtube.com o youtu.be, unos 3 minutos."
          >
            <Input
              id="video-url"
              value={videoUrl}
              placeholder="https://youtu.be/…"
              onChange={(event) => setVideoUrl(event.target.value)}
              aria-invalid={videoParsed !== null && !videoParsed.ok}
            />
            {videoParsed && !videoParsed.ok ? (
              <p className="text-sm text-hs-red">{videoParsed.message}</p>
            ) : null}
          </Field>

          {videoParsed?.ok ? <VideoFrame url={videoParsed.value} /> : null}

          <Field
            label="Repo de GitHub"
            htmlFor="repo-url"
            hint="Obligatorio y público. Los jueces tienen que poder abrirlo."
          >
            <Input
              id="repo-url"
              value={repoUrl}
              disabled={locked}
              placeholder="https://github.com/org/repo"
              onChange={(event) => {
                setRepoUrl(event.target.value);
                setRepoNote(null);
              }}
              onBlur={() => void onRepoBlur()}
              aria-invalid={repoParsed !== null && !repoParsed.ok}
            />
            {repoParsed && !repoParsed.ok ? (
              <p className="text-sm text-hs-red">{repoParsed.message}</p>
            ) : repoNote ? (
              <p
                className={cn(
                  "text-sm",
                  repoNote === "Repo público" ? "text-hs-teal" : "text-hs-red",
                )}
              >
                {repoNote}
              </p>
            ) : null}
          </Field>

          <Field
            label="Producto usable"
            htmlFor="demo-url"
            hint="Opcional, muy recomendado. Un enlace donde se pueda probar, no solo el repo."
          >
            <Input
              id="demo-url"
              value={demoUrl}
              disabled={locked && Boolean(urlOf(mine?.urls, "demo"))}
              placeholder="https://…"
              onChange={(event) => setDemoUrl(event.target.value)}
              aria-invalid={!demoParsed.ok}
            />
            {!demoParsed.ok ? (
              <p className="text-sm text-hs-red">{demoParsed.message}</p>
            ) : null}
          </Field>

          {catalog && catalog.length > 0 ? (
            <div className="space-y-2">
              <p className="font-bungee text-xs">Herramientas de partners</p>
              <p className="text-sm text-hs-brown">
                Opcional. Marca las que hayáis usado de verdad.
              </p>
              {catalog.map(({ perk }) => (
                <label key={perk._id} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={perkIds.includes(perk._id)}
                    disabled={saving}
                    onCheckedChange={() =>
                      setPerkIds((current) =>
                        current.includes(perk._id)
                          ? current.filter((id) => id !== perk._id)
                          : [...current, perk._id],
                      )
                    }
                  />
                  <span>{perkName(perk.company, perk.title)}</span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              disabled={!canSubmit}
              title={
                submissionsOpen
                  ? undefined
                  : "El envío de proyectos aún no está abierto"
              }
              onClick={() => {
                if (!canSubmit) {
                  return;
                }
                setFormError(null);
                setSaving(true);
                void submit({
                  challengeId: track._id,
                  demoUrl: demoUrl.trim() || undefined,
                  name,
                  perkIds,
                  repoUrl,
                  videoUrl,
                })
                  .then(() => onSubmitted())
                  .catch((error: unknown) =>
                    setFormError(errorMessage(error, "No se ha podido enviar")),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Enviando…" : `Enviar a ${track.label}`}
            </Button>
          </div>
          <p className="text-sm text-hs-brown">
            Esta entrega queda bloqueada para este reto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
