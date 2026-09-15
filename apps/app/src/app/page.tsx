"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { HomeFeed } from "@/components/home-feed";
import { LoadingText, Page, SocialMeta } from "@/components/page";
import { TeamCliDialog } from "@/components/team-cli-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, perkName } from "@/lib/utils";

function HubCard({
  title,
  description,
  headerRow,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description: string;
  headerRow?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex h-full gap-2 py-3", className)}>
      <CardHeader
        className={
          headerRow
            ? "flex flex-row flex-wrap items-baseline justify-between gap-2"
            : undefined
        }
      >
        <CardTitle className={headerRow ? "shrink-0" : undefined}>
          {title}
        </CardTitle>
        <CardDescription
          className={cn(
            "font-bungee font-medium leading-snug",
            headerRow && "min-w-0 text-right",
          )}
        >
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "mt-auto flex flex-1 flex-col gap-2 font-medium [&>:last-child]:mt-auto",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const me = useQuery(api.users.me);
  const ready = Boolean(
    me &&
      (me.role === "admin" ||
        (me.accepted === true && me.onboardingComplete === true)),
  );
  const signup = useQuery(api.users.mySignup, ready ? {} : "skip");
  const team = useQuery(api.teams.mine, ready ? {} : "skip");
  const catalog = useQuery(api.perks.listCatalog, ready ? {} : "skip");
  const project = useQuery(api.submissions.mine, ready ? {} : "skip");
  const trackSettings = useQuery(api.tracks.settings, ready ? {} : "skip");

  if (!me) return <LoadingText />;

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
      compact
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
      title={
        <h1 className="font-bungee text-2xl leading-tight text-balance break-words sm:text-3xl">
          Hola, {me.name ?? "hacker"}
        </h1>
      }
    >
      <div className="grid min-w-0 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
        <section
          aria-label="Feed"
          className="flex min-h-0 min-w-0 w-full max-w-full flex-col lg:h-full lg:overflow-hidden"
        >
          <HomeFeed />
        </section>

        <div className="hs-stagger grid min-w-0 max-w-full gap-3 sm:grid-cols-2 lg:h-full lg:min-h-0 lg:auto-rows-[minmax(min-content,1fr)]">
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
            headerRow
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
                Crea uno o únete desde la CLI de hackspain.
              </p>
            )}
            {team === undefined ? null : team ? (
              <Button asChild variant="teal" className="w-full sm:w-auto">
                <Link href="/teams">Ver equipo</Link>
              </Button>
            ) : (
              <TeamCliDialog>
                <Button variant="teal" className="w-full sm:w-auto">
                  Cómo crear uno
                </Button>
              </TeamCliDialog>
            )}
          </HubCard>

          {me.role === "judge" || me.role === "admin" ? (
            <HubCard
              title="Juzgar"
              description="Puntúa proyectos por grupo general o por reto."
            >
              <p className="text-sm leading-snug text-hs-brown">
                Panel del jurado. Los grupos generales ven una cohorte; cada reto
                ve todos sus envíos.
              </p>
              <Button asChild variant="teal" className="w-full sm:w-auto">
                <Link href="/judging">Abrir panel</Link>
              </Button>
            </HubCard>
          ) : null}

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
                  : `${claimed.length}/${catalog.length}`
            }
            headerRow
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
            headerRow
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
            {project !== undefined ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/tracks">
                  {project?.status === "submitted"
                    ? "Ver proyecto"
                    : project
                      ? "Seguir el proyecto"
                      : "Empezar proyecto"}
                </Link>
              </Button>
            ) : null}
          </HubCard>
        </div>
      </div>

      {signup ? (
        <Card className="shrink-0 gap-2 py-3">
          <CardHeader>
            <CardTitle>Tu solicitud</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SocialMeta email={signup.email} urls={signup.urls} />
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}
