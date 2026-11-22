"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/avatar";
import { isEventOpen } from "@/components/event-closed-banner";
import { TrackBriefLink } from "@/components/markdown";
import { LoadingText, Page } from "@/components/page";
import { TrackLogo } from "@/components/track-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TeamSummary = FunctionReturnType<typeof api.teams.list>[number];

/**
 * Small team avatars under a track. Clicking one opens that team's roster
 * inline; clicking it again (or another team) closes it.
 */
function TrackTeams({
  teams,
  trackSlug,
  teamCount,
  teamLimit,
}: {
  teams: TeamSummary[];
  trackSlug: string;
  teamCount: number;
  teamLimit: number;
}) {
  const [openId, setOpenId] = useState<TeamSummary["_id"] | null>(null);
  const open = teams.find((team) => team._id === openId) ?? null;

  if (teams.length === 0) {
    return (
      <p className="text-xs text-hs-brown">
        {teamCount === 0
          ? `Ningún equipo todavía. Caben ${teamLimit}.`
          : `${teamCount}/${teamLimit} plazas ocupadas.`}
      </p>
    );
  }
  const rosterId = `track-${trackSlug}-roster`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bungee text-[11px] uppercase text-hs-brown">
          {teamCount >= teamLimit
            ? `Completo · ${teamCount}/${teamLimit} equipos`
            : `${teamCount}/${teamLimit} equipos`}
        </span>
        <ul
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Equipos en este reto"
        >
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
                    active &&
                      "ring-2 ring-hs-navy ring-offset-2 ring-offset-hs-paper"
                  )}
                >
                  <Avatar
                    name={team.name}
                    src={team.logoUrl}
                    className={cn(
                      "size-8 border-2 text-[11px]",
                      team.isMine && "bg-hs-teal/60"
                    )}
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
            <ul
              className="flex flex-wrap gap-x-4 gap-y-2"
              aria-label={`Miembros de ${open.name}`}
            >
              {open.members.map((member) => (
                <li
                  key={member._id}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <Avatar
                    name={member.name}
                    src={member.avatarUrl}
                    className="size-7 border-2 text-[10px]"
                  />
                  <span className="min-w-0 truncate">{member.name}</span>
                  {member.isOwner ? (
                    <span className="text-xs text-hs-brown">· dueño</span>
                  ) : null}
                </li>
              ))}
              {open.members.length === 0 ? (
                <li className="text-sm text-hs-brown">
                  Sin miembros confirmados.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const PLACEHOLDER_SLUGS = new Set(["ml", "non-tech"]);

export default function TracksPage() {
  const me = useQuery(api.users.me);
  const skipLive =
    me === null ||
    me === undefined ||
    !isEventOpen(me.event) ||
    (me.canJudge && !me.sections.includes("tracks"));
  const tracks = useQuery(api.tracks.list);
  const mine = useQuery(api.submissions.mine, skipLive ? "skip" : {});
  const teams = useQuery(api.teams.list, skipLive ? "skip" : {});
  const ensureCatalog = useMutation(api.tracks.ensureCatalog);

  useEffect(() => {
    if (skipLive || tracks === undefined) {
      return;
    }
    const stale =
      tracks.length === 0 ||
      tracks.some((track) => PLACEHOLDER_SLUGS.has(track.slug));
    if (stale) {
      void ensureCatalog({});
    }
  }, [ensureCatalog, skipLive, tracks]);

  if (tracks === undefined || (!skipLive && mine === undefined)) {
    return <LoadingText />;
  }

  const entered = new Set(mine?.challengeIds);
  const submittedIds = new Set(
    (mine?.submittedTracks ?? []).map((row) => row._id)
  );

  return (
    <Page
      title="Retos"
      description="Un proyecto entra en un reto, o en dos si uno es THEKER. Te apuntas desde la CLI."
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
                  {submittedIds.has(track._id) ? (
                    <Badge variant="gold" className="whitespace-nowrap">
                      Enviado
                    </Badge>
                  ) : entered.has(track._id) ? (
                    <Badge className="whitespace-nowrap">En el borrador</Badge>
                  ) : null}
                </CardTitle>
                <CardDescription className="border-t border-hs-ink/15 pt-3 text-base font-medium text-hs-ink">
                  {track.note}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{track.body}</p>
                <div className="border-t border-hs-ink/15 pt-3">
                  {skipLive ? (
                    <p className="text-xs text-hs-brown">
                      {track.teamCount}/{track.teamLimit} equipos
                    </p>
                  ) : teams === undefined ? (
                    <p className="text-xs text-hs-brown">Cargando equipos…</p>
                  ) : (
                    <TrackTeams
                      trackSlug={track.slug}
                      teamCount={track.teamCount}
                      teamLimit={track.teamLimit}
                      teams={teams.filter((team) =>
                        team.tracks.some((chosen) => chosen.slug === track.slug)
                      )}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button asChild className="w-full sm:w-auto">
                    <TrackBriefLink track={track}>Ver reto</TrackBriefLink>
                  </Button>
                  {skipLive ? (
                    track.website ? (
                      <a
                        href={track.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-sm font-medium text-hs-navy underline-offset-4 hover:underline"
                      >
                        Conoce al sponsor
                      </a>
                    ) : null
                  ) : (
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
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
