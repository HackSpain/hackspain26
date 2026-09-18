"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  EmptyState,
  FormError,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Directory = FunctionReturnType<typeof api.teams.adminDirectory>;
type TeamRow = Directory["teams"][number];
type TrackRow = Directory["tracks"][number];

const NONE = "none";

function occupancy(count: number, limit: number) {
  return `${count}/${limit}`;
}

function matchesEmail(team: TeamRow, query: string) {
  if (!query) {
    return true;
  }
  return team.emails.some((email) => email.toLowerCase().includes(query));
}

export default function AdminTeamsPage() {
  const data = useQuery(api.teams.adminDirectory);
  const setTrack = useMutation(api.teams.adminSetTrack);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<Id<"teams"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const teams = useMemo(
    () => (data?.teams ?? []).filter((team) => matchesEmail(team, query)),
    [data?.teams, query]
  );

  if (data === undefined) {
    return <LoadingText />;
  }

  const countById = new Map(data.tracks.map((track) => [track._id, track.teamCount]));

  const save = async (teamId: Id<"teams">, trackId: Id<"tracks"> | undefined) => {
    setSavingId(teamId);
    setError(null);
    try {
      await setTrack({ teamId, trackId });
    } catch (err) {
      setError(errorMessage(err, "No se pudo cambiar el track."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Page
      title="Equipos"
      description="Busca por email de un participante y asígnale el track. El tope de 15 no aplica aquí."
    >
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Email de un participante"
        aria-label="Buscar por email"
        className="max-w-md"
      />
      <FormError message={error} />
      {teams.length === 0 ? (
        <EmptyState title={query ? "Ningún equipo con ese email" : "Aún no hay equipos"} />
      ) : (
        <ul
          aria-label="Equipos"
          className="divide-y-2 divide-hs-ink/15 border-[3px] border-hs-ink bg-hs-paper"
        >
          {teams.map((team) => (
            <TeamItem
              key={team._id}
              countById={countById}
              disabled={savingId === team._id}
              team={team}
              teamLimit={data.teamLimit}
              tracks={data.tracks}
              onChange={(trackId) => void save(team._id, trackId)}
            />
          ))}
        </ul>
      )}
    </Page>
  );
}

function TeamItem({
  countById,
  disabled,
  onChange,
  team,
  teamLimit,
  tracks,
}: {
  countById: Map<string, number>;
  disabled: boolean;
  onChange: (trackId: Id<"tracks"> | undefined) => void;
  team: TeamRow;
  teamLimit: number;
  tracks: TrackRow[];
}) {
  const count = team.trackId ? (countById.get(team.trackId) ?? 0) : 0;
  const over = Boolean(team.trackId) && count > teamLimit;
  return (
    <li
      className={cn(
        "grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] md:items-center",
        "transition-[background-color] duration-150 ease-[var(--ease-out)] hover:bg-hs-sand/50",
        disabled && "opacity-60"
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bungee text-sm leading-tight">
          <span className="min-w-0 break-words">{team.name}</span>
          {team.trackLabel ? (
            <Badge variant={over ? "gold" : "default"} className="tabular-nums">
              {team.trackLabel} · {occupancy(count, teamLimit)}
            </Badge>
          ) : (
            <Badge>Sin track</Badge>
          )}
        </p>
        <p className="text-pretty text-xs text-hs-ink/70">
          {team.members
            .map((member) => member.email ?? member.name)
            .join(" · ") || "Sin miembros"}
        </p>
      </div>
      <Select
        value={team.trackId ?? NONE}
        disabled={disabled}
        onValueChange={(value) =>
          onChange(value === NONE ? undefined : (value as Id<"tracks">))
        }
      >
        <SelectTrigger aria-label={`Track de ${team.name}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin track</SelectItem>
          {tracks.map((track) => (
            <SelectItem key={track._id} value={track._id}>
              <span>{track.label}</span>
              <span className="text-xs text-hs-brown tabular-nums">
                · {occupancy(track.teamCount, teamLimit)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}
