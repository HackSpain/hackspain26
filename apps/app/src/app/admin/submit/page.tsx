"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  EmptyState,
  LoadingText,
  Page,
} from "@/components/page";
import { SubmitFlow } from "@/components/submit-project";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TEAM_PARAM = "team";

type Directory = FunctionReturnType<typeof api.teams.adminDirectory>;
type TeamRow = Directory["teams"][number];

function matchesSearch(team: TeamRow, query: string) {
  if (!query) {
    return true;
  }
  if (team.name.toLowerCase().includes(query)) {
    return true;
  }
  return (
    team.emails.some((email) => email.toLowerCase().includes(query)) ||
    team.members.some((member) => member.name.toLowerCase().includes(query))
  );
}

function memberLine(team: TeamRow) {
  if (team.emails.length > 0) {
    return team.emails.join(" · ");
  }
  return team.members.map((member) => member.name).join(" · ") || "Sin emails";
}

function AdminSubmitPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const directory = useQuery(api.teams.adminDirectory);
  const tracks = useQuery(api.tracks.list);
  const settings = useQuery(api.tracks.settings);
  const catalog = useQuery(api.perks.listCatalog);
  const submit = useAction(api.submissions.adminSubmit);
  const [search, setSearch] = useState("");

  const teamId = searchParams.get(TEAM_PARAM) as Id<"teams"> | null;
  const selected = directory?.teams.find((team) => team._id === teamId);
  const detail = useQuery(
    api.submissions.adminForTeam,
    selected ? { teamId: selected._id } : "skip",
  );

  const query = search.trim().toLowerCase();
  const teams = useMemo(() => {
    const rows = directory?.teams ?? [];
    return rows.filter((team) => matchesSearch(team, query));
  }, [directory?.teams, query]);

  function openTeam(id: Id<"teams"> | null) {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set(TEAM_PARAM, id);
    } else {
      next.delete(TEAM_PARAM);
    }
    next.delete("track");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (directory === undefined || tracks === undefined || settings === undefined) {
    return <LoadingText />;
  }

  return (
    <Page
      title="Entregas"
      description="Busca un equipo por nombre o email y entrega el proyecto en su nombre."
    >
      {!settings.submissionsOpen ? (
        <Alert>
          <AlertDescription>
            El envío público está cerrado. Aquí puedes entregar igual.
          </AlertDescription>
        </Alert>
      ) : null}

      {selected ? (
        <div className="hs-enter space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-bungee text-xl text-balance">{selected.name}</p>
              <p className="mt-1 text-sm font-medium text-pretty text-hs-brown">
                {memberLine(selected)}
              </p>
              {selected.entered.length > 0 || selected.submitted ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.entered.map((track) => (
                    <Badge key={track._id}>{track.label}</Badge>
                  ))}
                  {selected.submitted ? (
                    <Badge variant="gold">Enviado</Badge>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-hs-brown">Sin track asignado.</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => openTeam(null)}
            >
              Cambiar equipo
            </Button>
          </div>
          {detail === undefined ? (
            <LoadingText />
          ) : detail === null ? (
            <EmptyState title="Equipo no encontrado">
              Vuelve a la búsqueda e inténtalo otra vez.
            </EmptyState>
          ) : (
            <SubmitFlow
              key={selected._id}
              allowAnyTrack
              catalog={catalog}
              empty={
                <EmptyState title="Sin retos activos">
                  <Link href="/admin/equipos" className="underline">
                    Asigna un track en Equipos
                  </Link>
                </EmptyState>
              }
              mine={detail.submission}
              onSubmit={(args) => submit({ ...args, teamId: selected._id })}
              submissionsOpen
              teamRepo={detail.repoUrl}
              tracks={tracks}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre del equipo o email"
            aria-label="Buscar equipo por nombre o email"
            autoFocus
          />
          <p className="text-sm text-hs-brown tabular-nums" aria-live="polite">
            {teams.length === 1 ? "1 equipo" : `${teams.length} equipos`}
          </p>
          {teams.length === 0 ? (
            <EmptyState title="Ningún equipo coincide">
              Prueba otro email o el nombre del equipo.
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {teams.map((team) => (
                <button
                  key={team._id}
                  type="button"
                  onClick={() => openTeam(team._id)}
                  className="border-[3px] border-hs-ink bg-hs-paper p-4 text-left motion-safe:transition-[transform,filter] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] hs-hover-bright"
                >
                  <p className="font-bungee text-base leading-snug text-balance">
                    {team.name}
                  </p>
                  <p className="mt-1 text-sm font-medium text-pretty text-hs-brown">
                    {memberLine(team)}
                  </p>
                  {team.entered.length > 0 || team.submitted ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {team.entered.map((track) => (
                        <Badge key={track._id}>{track.label}</Badge>
                      ))}
                      {team.submitted ? (
                        <Badge variant="gold">Enviado</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

export default function AdminSubmitRoute() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminSubmitPage />
    </Suspense>
  );
}
