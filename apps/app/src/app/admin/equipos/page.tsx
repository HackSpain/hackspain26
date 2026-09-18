"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Directory = FunctionReturnType<typeof api.teams.adminDirectory>;
type TeamRow = Directory["teams"][number];
type TrackRow = Directory["tracks"][number];

const NONE = "none";
const ALL = "all";

function occupancy(count: number, limit: number) {
  return `${count}/${limit}`;
}

function matchesSearch(team: TeamRow, query: string) {
  if (!query) {
    return true;
  }
  if (team.name.toLowerCase().includes(query)) {
    return true;
  }
  return team.emails.some((email) => email.toLowerCase().includes(query));
}

export default function AdminTeamsPage() {
  const data = useQuery(api.teams.adminDirectory);
  const setTrack = useMutation(api.teams.adminSetTrack);
  const removeTrack = useMutation(api.teams.adminRemoveTrack);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>(ALL);
  const [savingId, setSavingId] = useState<Id<"teams"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const teams = useMemo(() => {
    const rows = data?.teams ?? [];
    return rows.filter((team) => {
      if (!matchesSearch(team, query)) {
        return false;
      }
      if (trackFilter === ALL) {
        return true;
      }
      if (trackFilter === NONE) {
        return team.entered.length === 0;
      }
      return team.entered.some((track) => track._id === trackFilter);
    });
  }, [data?.teams, query, trackFilter]);

  if (data === undefined) {
    return <LoadingText />;
  }

  const countById = new Map(
    data.tracks.map((track) => [track._id, track.teamCount])
  );
  const untracked = data.teams.filter((team) => team.entered.length === 0).length;

  const save = async (
    teamId: Id<"teams">,
    trackId: Id<"tracks"> | undefined
  ) => {
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

  const drop = async (teamId: Id<"teams">, trackId: Id<"tracks">) => {
    setSavingId(teamId);
    setError(null);
    try {
      await removeTrack({ teamId, trackId });
    } catch (err) {
      setError(errorMessage(err, "No se pudo quitar el track."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Page
      title="Equipos"
      description="Todos los equipos. Si alguno tiene varios tracks, elige uno y el resto se suelta. El tope de 15 no aplica aquí."
      className="flex h-[calc(100dvh-11rem)] flex-col gap-4 space-y-0 sm:h-[calc(100dvh-12rem)]"
    >
      <div className="grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Equipo o email"
          aria-label="Buscar equipo o email"
        />
        <Select value={trackFilter} onValueChange={setTrackFilter}>
          <SelectTrigger aria-label="Filtrar por track">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              Todos · {data.teams.length}
            </SelectItem>
            <SelectItem value={NONE}>Sin track · {untracked}</SelectItem>
            {data.tracks.map((track) => (
              <SelectItem key={track._id} value={track._id}>
                <span>{track.label}</span>
                <span className="text-xs text-hs-brown tabular-nums">
                  · {occupancy(track.teamCount, data.teamLimit)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="shrink-0 text-sm text-hs-brown tabular-nums" aria-live="polite">
        {teams.length === 1 ? "1 equipo" : `${teams.length} equipos`}
      </p>
      <FormError message={error} />
      {teams.length === 0 ? (
        <EmptyState title="Ningún equipo coincide">
          Prueba otra búsqueda o quita el filtro de track.
        </EmptyState>
      ) : (
        <Table
          className="border-separate border-spacing-0"
          containerClassName="min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
            <TableRow>
              <TableHead>Equipo</TableHead>
              <TableHead>Participantes</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Asignar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TeamRowView
                key={team._id}
                countById={countById}
                disabled={savingId === team._id}
                team={team}
                teamLimit={data.teamLimit}
                tracks={data.tracks}
                onChange={(trackId) => void save(team._id, trackId)}
                onRemove={(trackId) => void drop(team._id, trackId)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Page>
  );
}

function TeamRowView({
  countById,
  disabled,
  onChange,
  onRemove,
  team,
  teamLimit,
  tracks,
}: {
  countById: Map<string, number>;
  disabled: boolean;
  onChange: (trackId: Id<"tracks"> | undefined) => void;
  onRemove: (trackId: Id<"tracks">) => void;
  team: TeamRow;
  teamLimit: number;
  tracks: TrackRow[];
}) {
  const emails =
    team.emails.length > 0
      ? team.emails.join(", ")
      : team.members.map((member) => member.name).join(", ") || "—";
  const extras = team.entered.length > 1;
  const currentId = team.entered[0]?._id;
  return (
    <TableRow
      className="[&_td]:border-b [&_td]:border-hs-ink/20"
      data-disabled={disabled || undefined}
    >
      <TableCell className="font-medium whitespace-normal">
        {team.name}
      </TableCell>
      <TableCell className="max-w-sm whitespace-normal text-hs-ink/80">
        {emails}
      </TableCell>
      <TableCell>
        {team.entered.length === 0 ? (
          <Badge>Sin track</Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {team.entered.map((track) => {
              const count = countById.get(track._id) ?? 0;
              return (
                <Badge
                  key={track._id}
                  variant={extras || count > teamLimit ? "gold" : "default"}
                  className="gap-1 pr-0.5 tabular-nums"
                >
                  {track.label} · {occupancy(count, teamLimit)}
                  <button
                    type="button"
                    aria-label={`Quitar ${track.label} de ${team.name}`}
                    disabled={disabled}
                    className="flex size-5 items-center justify-center text-hs-ink/70 hover:text-hs-ink disabled:pointer-events-none"
                    onClick={() => onRemove(track._id)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              );
            })}
            {extras ? (
              <span className="text-xs text-hs-brown">Elige uno</span>
            ) : null}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-56 items-center gap-2">
          <Select
            value={currentId ?? NONE}
            disabled={disabled}
            onValueChange={(value) =>
              onChange(value === NONE ? undefined : (value as Id<"tracks">))
            }
          >
            <SelectTrigger
              aria-label={`Track de ${team.name}`}
              className="min-w-44"
              size="sm"
            >
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
          {currentId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(undefined)}
            >
              Quitar
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
