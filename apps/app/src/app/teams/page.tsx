"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ImagePlus, Trash2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/avatar";
import { TrackTag } from "@/components/track-tag";
import { errorMessage, FormError, LoadingText, MetaLink, MetaRow, Page } from "@/components/page";
import { TeamCliDialog } from "@/components/team-cli-dialog";
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
import { cn, identifierTypeLabel, teamMemberStatusLabel } from "@/lib/utils";
import { uploadToConvex } from "@/lib/upload";

type TeamSummary = FunctionReturnType<typeof api.teams.list>[number];
type MyTeam = NonNullable<FunctionReturnType<typeof api.teams.mine>>;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Owner-only: upload or remove the team logo. Members just see it. */
function TeamLogo({ team }: { team: MyTeam }) {
  const generateUploadUrl = useMutation(api.teams.generateLogoUploadUrl);
  const setLogo = useMutation(api.teams.setLogo);
  const removeLogo = useMutation(api.teams.removeLogo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Solo se admiten imágenes.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("El logo no puede superar 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      await setLogo({
        imageId: await uploadToConvex(uploadUrl, file, "No se pudo subir el logo"),
      });
    } catch (caughtError: unknown) {
      setError(errorMessage(caughtError, "No se pudo subir el logo"));
    } finally {
      setBusy(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar
        name={team.name}
        src={team.logoUrl}
        className="size-20 text-2xl shadow-[4px_4px_0_var(--color-hs-ink)]"
      />
      {team.isOwner ? (
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-[3px] border-hs-ink bg-hs-gold px-5 font-bungee text-sm text-hs-ink hs-hover-bright">
              <ImagePlus className="size-4" aria-hidden />
              {busy ? "Subiendo…" : team.logoUrl ? "Cambiar logo" : "Subir logo"}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void upload(file);
                  }
                }}
              />
            </label>
            {team.logoUrl ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void removeLogo({}).finally(() => setBusy(false));
                }}
              >
                <Trash2 aria-hidden /> Quitar logo
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-hs-brown">
            Se ve en el feed, en los retos y en el directorio. Hasta 2 MB.
          </p>
          <FormError message={error} />
        </div>
      ) : null}
    </div>
  );
}

function TeamRow({ team }: { team: TeamSummary }) {
  const inTrack = team.tracks.length > 0;
  return (
    <li
      className={cn(
        "relative grid gap-x-6 gap-y-2 py-3 pr-3 pl-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        team.isMine ? "before:bg-hs-gold" : inTrack ? "before:bg-hs-teal" : "before:bg-hs-ink/20",
        "transition-[background-color] duration-150 ease-[var(--ease-out)] hover:bg-hs-sand/50",
      )}
    >
      <div className="min-w-0 space-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bungee text-sm leading-tight">
          <Avatar name={team.name} src={team.logoUrl} className="size-8 border-2 text-[11px]" />
          <span className="min-w-0 break-words">{team.name}</span>
          {team.isMine ? <Badge variant="gold">Tu equipo</Badge> : null}
          {team.pendingCount > 0 ? (
            <Badge className="tabular-nums">
              {team.pendingCount} {team.pendingCount === 1 ? "invitación" : "invitaciones"}
            </Badge>
          ) : null}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label={`Miembros de ${team.name}`}>
          {team.members.map((member) => (
            <li key={member._id} className="flex min-w-0 items-center gap-2 text-sm">
              <Avatar name={member.name} src={member.avatarUrl} className="size-7 border-2 text-[10px]" />
              <span className="min-w-0 truncate">{member.name}</span>
              {member.isOwner ? (
                <span className="text-xs text-hs-brown" title="Dueño del equipo">
                  · dueño
                </span>
              ) : null}
            </li>
          ))}
          {team.members.length === 0 ? (
            <li className="text-sm text-hs-brown">Sin miembros confirmados.</li>
          ) : null}
        </ul>
      </div>
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="font-bungee text-[11px] uppercase text-hs-brown">
          {inTrack ? "En reto" : "Sin reto"}
        </p>
        {inTrack ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {team.tracks.map((track) => (
              <TrackTag key={track.slug} track={track} />
            ))}
          </p>
        ) : (
          <p className="text-hs-brown">Todavía no ha elegido reto.</p>
        )}
        {team.projectName ? (
          <p className="text-hs-ink">
            <span className="font-medium">{team.projectName}</span>
            <span className="text-hs-brown">
              {team.submissionStatus === "submitted" ? " · enviado" : " · borrador"}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function TeamDirectory() {
  const teams = useQuery(api.teams.list);
  if (teams === undefined) {return <LoadingText />;}
  const inTrack = teams.filter((team) => team.tracks.length > 0).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Users className="size-4" aria-hidden /> Todos los equipos
          <Badge className="tabular-nums">{teams.length}</Badge>
          <Badge variant="gold" className="tabular-nums">
            {inTrack} en reto
          </Badge>
        </CardTitle>
        <CardDescription>
          Quién está con quién y en qué reto. Se actualiza en cuanto un equipo
          guarda su proyecto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-hs-brown">Todavía no hay equipos.</p>
        ) : (
          <ul
            aria-label="Equipos"
            className="divide-y-2 divide-hs-ink/15 border-[3px] border-hs-ink bg-hs-paper"
          >
            {teams.map((team) => (
              <TeamRow key={team._id} team={team} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CliCallout() {
  return (
    <Frame
      tone="navy"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-hs-navy">
        La gestión del equipo vive en la CLI de hackspain:{" "}
        <code className="font-mono text-xs">
          hackspain team create/join/leave/repo…
        </code>
      </p>
      <TeamCliDialog>
        <Button variant="outline" className="w-full shrink-0 sm:w-auto">
          Comandos del equipo
        </Button>
      </TeamCliDialog>
    </Frame>
  );
}

function NoTeam() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Todavía no tienes equipo</CardTitle>
        <CardDescription>
          Los equipos se crean y se gestionan desde la CLI. También puedes
          participar en solitario.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-hs-brown">
          Para unirte a un equipo existente pide al dueño su código de
          invitación de 8 caracteres (lo ve con{" "}
          <code className="font-mono text-xs">hackspain team code</code>) y usa{" "}
          <code className="font-mono text-xs">hackspain team join</code>.
        </p>
        <TeamCliDialog>
          <Button className="w-full sm:w-auto">
            Cómo crear o unirte a un equipo
          </Button>
        </TeamCliDialog>
      </CardContent>
    </Card>
  );
}

export default function TeamsPage() {
  const team = useQuery(api.teams.mine);

  if (team === undefined) {return <LoadingText />;}

  return (
    <Page
      title="Equipos"
      description="Tu equipo y el directorio de todos los equipos de la hackathon."
    >
      <CliCallout />

      {!team ? (
        <NoTeam />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{team.name}</CardTitle>
            <CardDescription>
              {team.isOwner ? "Eres el dueño de este equipo." : "Eres miembro."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TeamLogo team={team} />
            {team.joinCode ? (
              <div className="space-y-1">
                <p className="font-bungee text-xs">Código de invitación</p>
                <p className="font-mono text-lg tracking-wide select-all">
                  {team.joinCode}
                </p>
                <p className="text-sm text-hs-brown">
                  Compártelo con tu gente: se unen con{" "}
                  <code className="font-mono text-xs">
                    hackspain team join {team.joinCode}
                  </code>
                  .
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="font-bungee text-xs">Miembros</p>
              {team.members.map((member) => (
                <Frame
                  key={member._id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {member.name ?? member.identifier}
                    </p>
                    <p className="text-xs break-all text-hs-brown">
                      {identifierTypeLabel(member.identifierType)}: {member.identifier}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {member.userId === team.ownerId ? <Badge>Dueño</Badge> : null}
                    <Badge>{teamMemberStatusLabel(member.status)}</Badge>
                  </div>
                </Frame>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetaRow label="Repositorio">
                {team.repoUrls.length > 0 ? (
                  <span className="flex flex-col gap-1">
                    {team.repoUrls.map((url) => (
                      <MetaLink key={url} href={url}>
                        {url}
                      </MetaLink>
                    ))}
                  </span>
                ) : team.repoUrl ? (
                  <MetaLink href={team.repoUrl}>{team.repoUrl}</MetaLink>
                ) : (
                  <>
                    Sin vincular. Usa{" "}
                    <code className="font-mono text-xs">
                      hackspain team repo &lt;url&gt;
                    </code>
                  </>
                )}
              </MetaRow>
              <MetaRow label="Stack">
                {team.techStack.length > 0 ? (
                  <span className="flex flex-wrap gap-2">
                    {team.techStack.map((tech) => (
                      <Badge key={tech}>{tech}</Badge>
                    ))}
                  </span>
                ) : (
                  <>
                    Se detecta al vincular el repo con{" "}
                    <code className="font-mono text-xs">
                      hackspain team repo
                    </code>
                  </>
                )}
              </MetaRow>
            </div>
          </CardContent>
        </Card>
      )}

      <TeamDirectory />
    </Page>
  );
}
