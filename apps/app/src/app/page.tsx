"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { LoadingText, Page, SocialMeta } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { perkName } from "@/lib/utils";

function HubCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="font-bungee leading-snug">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function HomePage() {
  const me = useQuery(api.users.me);
  const ready = Boolean(
    me &&
      (me.role === "admin" ||
        (me.accepted === true && me.onboardingComplete === true))
  );
  const signup = useQuery(api.users.mySignup, ready ? {} : "skip");
  const team = useQuery(api.teams.mine, ready ? {} : "skip");
  const catalog = useQuery(api.perks.listCatalog, ready ? {} : "skip");
  const project = useQuery(api.submissions.mine, ready ? {} : "skip");
  const trackSettings = useQuery(api.tracks.settings, ready ? {} : "skip");

  if (!me) {
    return <LoadingText />;
  }

  const cancelled = me.attendanceStatus === "cancelled";
  const claimed = catalog?.filter((row) => row.claim) ?? [];
  const memberNames =
    team?.members
      .map((member) => member.name ?? member.identifier)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ") ?? "";

  return (
    <Page
      title={
        <h1 className="font-bungee text-2xl leading-tight break-words sm:text-3xl">
          Hola, {me.name ?? "hacker"}
        </h1>
      }
    >
      <div className="hs-stagger grid gap-4 sm:grid-cols-2">
        <HubCard
          title="Asistencia"
          description={
            cancelled
              ? "Has cancelado tu asistencia. Si cambias de idea, reactívala en tu perfil."
              : "Contamos contigo. Si no puedes venir, cancélalo en tu perfil."
          }
        >
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/profile">
              {cancelled ? "Cambiar asistencia" : "Cancelar o cambiar"}
            </Link>
          </Button>
        </HubCard>

        <HubCard
          title="Equipo"
          description={team ? team.name : "Todavía no tienes equipo."}
        >
          {team === undefined ? (
            <p className="text-sm text-hs-brown">Cargando…</p>
          ) : team ? (
            <p className="text-sm text-hs-brown">
              {team.members.length === 1
                ? "1 miembro"
                : `${team.members.length} miembros`}
              {memberNames ? ` · ${memberNames}` : ""}
              {team.members.length > 3 ? "…" : ""}
            </p>
          ) : (
            <p className="text-sm text-hs-brown">
              Crea uno y añade gente por GitHub, X o email.
            </p>
          )}
          {team === undefined ? null : (
            <Button asChild variant="teal" className="w-full sm:w-auto">
              <Link href="/teams">
                {team ? "Gestionar equipo" : "Crear equipo"}
              </Link>
            </Button>
          )}
        </HubCard>

        <HubCard
          title="Participantes"
          description="Conoce el directorio de la comunidad."
        >
          <p className="text-sm text-hs-brown">Demo con perfiles ficticios.</p>
          <Button asChild variant="teal" className="w-full sm:w-auto">
            <Link href="/participantes">Ver participantes</Link>
          </Button>
        </HubCard>

        <HubCard
          title="Perks"
          description={
            catalog === undefined
              ? "Cargando…"
              : catalog.length === 0
                ? "Aún no hay perks."
                : claimed.length === 0
                  ? `${catalog.length} ${catalog.length === 1 ? "disponible" : "disponibles"}`
                  : `${claimed.length} de ${catalog.length} reclamados`
          }
        >
          {claimed.length > 0 ? (
            <p className="text-sm text-hs-brown">
              {claimed
                .map((row) => perkName(row.perk.company, row.perk.title))
                .join(" · ")}
            </p>
          ) : catalog && catalog.length > 0 ? (
            <p className="text-sm text-hs-brown">
              Beneficios de partners. Reclama códigos o envía una solicitud.
            </p>
          ) : null}
          <Button asChild className="w-full sm:w-auto">
            <Link href="/perks">Ver perks</Link>
          </Button>
        </HubCard>

        <HubCard
          title="Retos"
          description={
            project === undefined || trackSettings === undefined
              ? "Cargando…"
              : project
                ? project.status === "submitted"
                  ? "Proyecto enviado"
                  : "Borrador guardado"
                : trackSettings.submissionsOpen
                  ? "El envío está abierto"
                  : "El envío aún no está abierto"
          }
        >
          {project ? (
            <>
              <p className="text-sm">{project.name || "Sin nombre"}</p>
              {project.challenges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {project.challenges.map((challenge) => (
                    <Badge key={challenge._id}>{challenge.label}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-hs-brown">
                  Todavía no has elegido retos.
                </p>
              )}
            </>
          ) : project === null ? (
            <p className="text-sm text-hs-brown">
              Un proyecto. Entra en tantos retos como quieras.
            </p>
          ) : null}
          {project === undefined ? null : (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/tracks">
                {project?.status === "submitted"
                  ? "Ver proyecto"
                  : project
                    ? "Seguir el proyecto"
                    : "Empezar proyecto"}
              </Link>
            </Button>
          )}
        </HubCard>

        {signup ? (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>Tu solicitud</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <SocialMeta email={signup.email} urls={signup.urls} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Page>
  );
}
