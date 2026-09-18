"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/avatar";
import { TrackBriefLink } from "@/components/markdown";
import { LoadingText, MetaLink, MetaRow, Page } from "@/components/page";
import { ProjectCliDialog } from "@/components/project-cli-dialog";
import { TrackLogo, TrackTag } from "@/components/track-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Frame,
} from "@/components/ui/card";
import { urlDisplay, urlLabel } from "@/lib/urls";
import type { UrlEntry } from "@/lib/urls";
import { cn, perkName, submissionStatusLabel } from "@/lib/utils";

type TeamSummary = FunctionReturnType<typeof api.teams.list>[number];

/**
 * Small team avatars under a track. Clicking one opens that team's roster
 * inline; clicking it again (or another team) closes it.
 */
function TrackTeams({ teams, trackSlug }: { teams: TeamSummary[]; trackSlug: string }) {
  const [openId, setOpenId] = useState<TeamSummary["_id"] | null>(null);
  const open = teams.find((team) => team._id === openId) ?? null;

  if (teams.length === 0) {
    return <p className="text-xs text-hs-brown">Ningún equipo todavía.</p>;
  }
  const rosterId = `track-${trackSlug}-roster`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bungee text-[11px] uppercase text-hs-brown">
          {teams.length === 1 ? "1 equipo" : `${teams.length} equipos`}
        </span>
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Equipos en este reto">
          {teams.map((team) => {
            const active = team._id === openId;
            return (
              <li key={team._id}>
                <button
                  type="button"
                  title={team.name}
                  aria-label={team.name}
                  aria-expanded={active}
                  aria-controls={rosterId}
                  onClick={() => setOpenId(active ? null : team._id)}
                  className={cn(
                    "block outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-paper",
                    active && "ring-2 ring-hs-navy ring-offset-2 ring-offset-hs-paper",
                  )}
                >
                  <Avatar
                    name={team.name}
                    src={team.logoUrl}
                    className={cn("size-8 border-2 text-[11px]", team.isMine && "bg-hs-teal/60")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div id={rosterId}>
        {open ? (
          <div className="space-y-2 border-[3px] border-hs-ink bg-hs-sand/40 p-3">
            <p className="flex flex-wrap items-center gap-2 font-bungee text-sm">
              <span>{open.name}</span>
              {open.isMine ? <Badge variant="gold">Tu equipo</Badge> : null}
              {open.projectName ? (
                <span className="text-xs font-sans font-normal text-hs-brown">
                  · {open.projectName}
                  {open.submissionStatus === "submitted" ? " (enviado)" : ""}
                </span>
              ) : null}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label={`Miembros de ${open.name}`}>
              {open.members.map((member) => (
                <li key={member._id} className="flex min-w-0 items-center gap-2 text-sm">
                  <Avatar name={member.name} src={member.avatarUrl} className="size-7 border-2 text-[10px]" />
                  <span className="min-w-0 truncate">{member.name}</span>
                  {member.isOwner ? (
                    <span className="text-xs text-hs-brown">· dueño</span>
                  ) : null}
                </li>
              ))}
              {open.members.length === 0 ? (
                <li className="text-sm text-hs-brown">Sin miembros confirmados.</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TrackRow = {
  _id: Id<"tracks">;
  slug: string;
  label: string;
  body: string;
  note: string;
  logoUrl?: string;
  website?: string;
};

const PLACEHOLDER_SLUGS = new Set(["ml", "non-tech"]);

type SubmissionRow = {
  name: string;
  description: string;
  urls: UrlEntry[];
  challengeIds: Id<"tracks">[];
  perkIds: Id<"perks">[];
  status: "draft" | "submitted";
  techStack: string[];
};

type CatalogRow = {
  perk: { _id: Id<"perks">; company: string; title: string };
};

function CliCallout() {
  return (
    <Frame
      tone="navy"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-hs-navy">
        Los retos y el envío del proyecto viven en la CLI de hackspain:{" "}
        <code className="font-mono text-xs">
          hackspain track register/unregister · hackspain submit
        </code>
      </p>
      <ProjectCliDialog>
        <Button variant="outline" className="w-full shrink-0 sm:w-auto">
          Comandos del proyecto
        </Button>
      </ProjectCliDialog>
    </Frame>
  );
}

function NoProject({ submissionsOpen }: { submissionsOpen: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Todavía no tienes proyecto</CardTitle>
        <CardDescription>
          Entra en los retos y guarda el proyecto desde la CLI. Un proyecto
          puede entrar en tantos retos como quieras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-hs-brown">
          Empieza con{" "}
          <code className="font-mono text-xs">hackspain track register &lt;slug&gt;</code>{" "}
          y guarda los datos con{" "}
          <code className="font-mono text-xs">hackspain submit --draft</code>
          {submissionsOpen
            ? ". Cuando esté listo, "
            : ". El envío aún no está abierto; cuando lo esté, "}
          <code className="font-mono text-xs">hackspain submit</code>.
        </p>
        <ProjectCliDialog>
          <Button className="w-full sm:w-auto">Cómo apuntarse y enviar</Button>
        </ProjectCliDialog>
      </CardContent>
    </Card>
  );
}

function MyProject({
  mine,
  tracks,
  catalog,
  submissionsOpen,
}: {
  mine: SubmissionRow;
  tracks: TrackRow[];
  catalog: CatalogRow[] | undefined;
  submissionsOpen: boolean;
}) {
  const submitted = mine.status === "submitted";
  const entered = tracks.filter((track) => mine.challengeIds.includes(track._id));
  const perks = (catalog ?? []).filter(({ perk }) => mine.perkIds.includes(perk._id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {mine.name || "Proyecto sin nombre"}
          <Badge variant={submitted ? "gold" : "default"} className="whitespace-nowrap">
            {submissionStatusLabel(mine.status)}
          </Badge>
        </CardTitle>
        <CardDescription>
          {submitted
            ? "Enviado y bloqueado. Ya está en manos del jurado."
            : submissionsOpen
              ? "Borrador. Envíalo con hackspain submit cuando esté listo."
              : "Borrador. El envío se abrirá más adelante; sigue guardando con hackspain submit --draft."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {mine.description ? (
          <p className="text-sm whitespace-pre-wrap">{mine.description}</p>
        ) : (
          <p className="text-sm text-hs-brown">
            Sin descripción todavía. Añádela con{" "}
            <code className="font-mono text-xs">hackspain submit --draft --description "…"</code>.
          </p>
        )}

        <div className="space-y-2">
          <p className="font-bungee text-xs">Retos</p>
          {entered.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entered.map((track) => (
                <TrackTag key={track._id} track={track} className="py-1" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-hs-brown">
              No está en ningún reto. Entra con{" "}
              <code className="font-mono text-xs">hackspain track register &lt;slug&gt;</code>.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["repo", "demo", "video"] as const).map((kind) => {
            const entry = mine.urls.find((url) => url.kind === kind);
            return (
              <MetaRow key={kind} label={urlLabel(kind)}>
                {entry ? (
                  <MetaLink href={entry.url}>{urlDisplay(kind, entry.url)}</MetaLink>
                ) : (
                  <span className="text-hs-brown">
                    Sin {urlLabel(kind).toLowerCase()} · <code className="font-mono text-xs">hackspain submit --draft --{kind} &lt;url&gt;</code>
                  </span>
                )}
              </MetaRow>
            );
          })}
          <MetaRow label="Stack">
            {mine.techStack.length > 0 ? (
              <span className="flex flex-wrap gap-2">
                {mine.techStack.map((tech) => (
                  <Badge key={tech}>{tech}</Badge>
                ))}
              </span>
            ) : (
              <span className="text-hs-brown">
                Se detecta al vincular el repo público del equipo.
              </span>
            )}
          </MetaRow>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">Herramientas de partners</p>
          {perks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {perks.map(({ perk }) => (
                <Badge key={perk._id}>{perkName(perk.company, perk.title)}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-hs-brown">
              Ninguna marcada. Se eligen en{" "}
              <code className="font-mono text-xs">hackspain submit</code>.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TracksPage() {
  const tracks = useQuery(api.tracks.list);
  const settings = useQuery(api.tracks.settings);
  const mine = useQuery(api.submissions.mine);
  const catalog = useQuery(api.perks.listCatalog);
  const teams = useQuery(api.teams.list);
  const ensureCatalog = useMutation(api.tracks.ensureCatalog);

  useEffect(() => {
    if (tracks === undefined) {
      return;
    }
    const stale =
      tracks.length === 0 || tracks.some((track) => PLACEHOLDER_SLUGS.has(track.slug));
    if (stale) {
      void ensureCatalog({});
    }
  }, [tracks, ensureCatalog]);

  if (tracks === undefined || settings === undefined || mine === undefined) {
    return <LoadingText />;
  }

  const entered = new Set(mine?.challengeIds);

  return (
    <Page
      title="Retos"
      description="Un proyecto, tantos retos como quieras. Se gestiona desde la CLI; aquí ves cómo va."
    >
      {tracks.length === 0 ? (
        <p className="text-hs-brown">Cargando retos…</p>
      ) : (
        <div className="hs-stagger grid gap-4 md:grid-cols-2">
          {tracks.map((track) => (
            <Card key={track._id}>
              <CardHeader>
                <CardTitle className="flex min-h-12 items-center justify-between gap-3">
                  <TrackLogo track={track} className="h-9 max-w-56" />
                  {entered.has(track._id) ? (
                    <Badge variant="gold" className="whitespace-nowrap">
                      {mine?.status === "submitted" ? "Enviado" : "En el borrador"}
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription className="border-t border-hs-ink/15 pt-3 text-base font-medium text-hs-ink">
                  {track.note}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{track.body}</p>
                <div className="border-t border-hs-ink/15 pt-3">
                  {teams === undefined ? (
                    <p className="text-xs text-hs-brown">Cargando equipos…</p>
                  ) : (
                    <TrackTeams
                      trackSlug={track.slug}
                      teams={teams.filter((team) =>
                        team.tracks.some((chosen) => chosen.slug === track.slug),
                      )}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button asChild className="w-full sm:w-auto">
                    <TrackBriefLink track={track}>Ver reto</TrackBriefLink>
                  </Button>
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <code className="font-mono text-xs text-hs-brown">
                      hackspain track register {track.slug}
                    </code>
                    {track.website ? (
                      <a
                        href={track.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-sm font-medium text-hs-navy underline-offset-4 hover:underline"
                      >
                        Conoce al sponsor
                      </a>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CliCallout />

      {mine ? (
        <MyProject
          mine={mine}
          tracks={tracks}
          catalog={catalog}
          submissionsOpen={settings.submissionsOpen}
        />
      ) : (
        <NoProject submissionsOpen={settings.submissionsOpen} />
      )}
    </Page>
  );
}
