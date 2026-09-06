"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { LoadingText, MetaLink, MetaRow, Page } from "@/components/page";
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
import { identifierTypeLabel, teamMemberStatusLabel } from "@/lib/utils";

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

  if (team === undefined) return <LoadingText />;

  return (
    <Page title="Equipo">
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
                {team.repoUrl ? (
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
                    Sin declarar. Usa{" "}
                    <code className="font-mono text-xs">hackspain stack set …</code>
                  </>
                )}
              </MetaRow>
            </div>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
