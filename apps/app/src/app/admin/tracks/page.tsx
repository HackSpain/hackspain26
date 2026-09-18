"use client";

import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import {
  EmptyState,
  Field,
  FormError,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { TrackBrief, TrackBriefLink } from "@/components/markdown";
import { TrackLogo, TrackTag } from "@/components/track-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { urlDisplay, urlLabel } from "@/lib/urls";
import { cn, perkName, submissionStatusLabel } from "@/lib/utils";

type Track = FunctionReturnType<typeof api.tracks.adminList>[number];
type Submission = FunctionReturnType<typeof api.submissions.adminList>[number];

const TRACK_PARAM = "track";

function projectCount(count: number) {
  return `${count} ${count === 1 ? "proyecto" : "proyectos"}`;
}

export default function AdminTracksPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <TracksAdmin />
    </Suspense>
  );
}

function TracksAdmin() {
  const tracks = useQuery(api.tracks.adminList);
  const settings = useQuery(api.tracks.adminSettings);
  const submissions = useQuery(api.submissions.adminList);
  const ensureDefaults = useMutation(api.tracks.adminEnsureDefaults);
  const setOpen = useMutation(api.tracks.adminSetSubmissionsOpen);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedSlug = searchParams.get(TRACK_PARAM);

  useEffect(() => {
    if (tracks === undefined) return;
    const stale =
      tracks.length === 0 ||
      tracks.some(
        (track) =>
          track.active && (track.slug === "ml" || track.slug === "non-tech"),
      );
    if (stale) {
      void ensureDefaults({});
    }
  }, [tracks, ensureDefaults]);

  if (!tracks || !settings || submissions === undefined) return <LoadingText />;

  const selected =
    tracks.find((track) => track.slug === requestedSlug) ?? tracks[0] ?? null;

  const selectTrack = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(TRACK_PARAM, slug);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const countFor = (track: Track) =>
    submissions.filter((row) => row.challengeIds.includes(track._id)).length;

  return (
    <Page
      title="Retos y proyectos"
      description="Los retos viven en Convex. Un equipo entra en un solo reto."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Ventana de envío
            <Badge
              variant={settings.submissionsOpen ? "gold" : "default"}
              className="whitespace-nowrap"
            >
              {settings.submissionsOpen ? "Abierta" : "Cerrada"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
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

      {selected === null ? (
        <EmptyState title="Aún no hay retos">
          Se crearán los retos por defecto en un momento.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <Field label="Reto" htmlFor="admin-track-select">
            <Select value={selected.slug} onValueChange={selectTrack}>
              <SelectTrigger
                id="admin-track-select"
                className="w-full sm:max-w-md"
                aria-label="Elegir reto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((track) => (
                  <SelectItem key={track._id} value={track.slug}>
                    <span>{track.label}</span>
                    <span className="text-xs text-hs-brown tabular-nums">
                      · {track.active ? "visible" : "oculto"} ·{" "}
                      {projectCount(countFor(track))}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <TrackEditor
            key={selected._id}
            track={selected}
            submissions={submissions.filter((row) =>
              row.challengeIds.includes(selected._id),
            )}
          />
        </div>
      )}
    </Page>
  );
}

function TrackEditor({
  track,
  submissions,
}: {
  track: Track;
  submissions: Submission[];
}) {
  const update = useMutation(api.tracks.adminUpdate);
  const [label, setLabel] = useState(track.label);
  const [note, setNote] = useState(track.note);
  const [body, setBody] = useState(track.body);
  const [markdown, setMarkdown] = useState(track.markdown ?? "");
  const [logoUrl, setLogoUrl] = useState(track.logoUrl ?? "");
  const [website, setWebsite] = useState(track.website ?? "");
  const [pending, setPending] = useState<"text" | "visibility" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    label.trim() !== track.label ||
    note.trim() !== track.note ||
    body.trim() !== track.body ||
    markdown.trim() !== (track.markdown ?? "").trim() ||
    logoUrl.trim() !== (track.logoUrl ?? "") ||
    website.trim() !== (track.website ?? "");

  const run = async (kind: "text" | "visibility", work: () => Promise<null>) => {
    setPending(kind);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el reto."));
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <TrackLogo track={{ label: track.label, logoUrl: logoUrl.trim() || undefined }} className="h-7" />
          <Badge>{track.active ? "Activo" : "Oculto"}</Badge>
          <Badge variant="gold" className="tabular-nums">
            {projectCount(submissions.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre" htmlFor="track-label">
            <Input
              id="track-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <Field label="Nota" htmlFor="track-note">
            <Input
              id="track-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Texto" htmlFor="track-body">
          <Textarea
            id="track-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        <Field
          label="Enunciado"
          htmlFor="track-markdown"
          hint="Markdown del reto, o una URL https:// que se abre en otra pestaña."
        >
          <Textarea
            id="track-markdown"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            className="min-h-48 font-mono text-sm"
          />
        </Field>
        <div className="border-[3px] border-hs-ink/20 p-4">
          <p className="mb-3 font-bungee text-[11px] uppercase text-hs-brown">
            Vista previa
          </p>
          <div className="max-w-prose">
            <TrackBrief markdown={markdown} body={body} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Logo del sponsor"
            htmlFor="track-logo"
            hint="Ruta bajo /public (por ejemplo /tracks/maisa.png) o URL https://."
          >
            <Input
              id="track-logo"
              value={logoUrl}
              placeholder="/tracks/maisa.png"
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </Field>
          <Field label="Web del sponsor" htmlFor="track-website">
            <Input
              id="track-website"
              value={website}
              placeholder="https://"
              onChange={(event) => setWebsite(event.target.value)}
            />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!dirty || pending !== null}
            onClick={() =>
              void run("text", () =>
                update({
                  trackId: track._id,
                  label,
                  body,
                  markdown,
                  note,
                  logoUrl,
                  website,
                }),
              )
            }
          >
            {pending === "text" ? "Guardando…" : "Guardar texto"}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={pending !== null}
            onClick={() =>
              void run("visibility", () =>
                update({ trackId: track._id, active: !track.active }),
              )
            }
          >
            {track.active ? "Ocultar" : "Mostrar"}
          </Button>
          {track.active ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <TrackBriefLink track={{ slug: track.slug, markdown }}>
                Ver ficha
              </TrackBriefLink>
            </Button>
          ) : null}
        </div>
        {submissions.length === 0 ? (
          <p className="text-sm text-hs-brown">Aún no hay proyectos en este reto.</p>
        ) : (
          <ul
            aria-label="Proyectos en este reto"
            className="divide-y-2 divide-hs-ink/15 border-[3px] border-hs-ink bg-hs-paper"
          >
            {submissions.map((row) => (
              <ProjectRow key={row._id} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectRow({ row }: { row: Submission }) {
  const submitted = row.status === "submitted";
  return (
    <li
      className={cn(
        "relative grid gap-x-6 gap-y-1.5 py-3 pr-3 pl-4 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        submitted ? "before:bg-hs-gold" : "before:bg-hs-ink/20",
        "transition-[background-color] duration-150 ease-[var(--ease-out)] hover:bg-hs-sand/50",
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bungee text-sm leading-tight">
          <span className="min-w-0 break-words">{row.name || "Sin título"}</span>
          <Badge variant={submitted ? "gold" : "default"} className="shrink-0">
            {submissionStatusLabel(row.status)}
          </Badge>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-hs-ink/70">
          <span className="font-medium text-hs-ink">
            {row.teamName ?? "Individual"}
          </span>
          {row.challenges.map((challenge) => (
            <TrackTag key={challenge._id} track={challenge} />
          ))}
        </p>
        {row.perks.length > 0 ? (
          <p className="text-pretty text-xs text-hs-ink/70">
            Perks:{" "}
            {row.perks
              .map((perk) => perkName(perk.company, perk.title))
              .join(", ")}
          </p>
        ) : null}
      </div>
      {row.urls.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-1 text-xs">
          {row.urls.map((entry) => (
            <li key={entry.kind} className="flex min-w-0 items-baseline gap-2">
              <span className="w-10 shrink-0 text-hs-ink/70">
                {urlLabel(entry.kind)}
              </span>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                title={entry.url}
                className="inline-flex min-w-0 max-w-full items-center gap-1 text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px] outline-none hover:decoration-hs-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hs-navy"
              >
                <span className="truncate">
                  {urlDisplay(entry.kind, entry.url)}
                </span>
                <ExternalLink
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
