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
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selected, setSelected] = useState<Set<Id<"teams">>>(new Set());
  const [adding, setAdding] = useState<Set<Id<"teams">>>(new Set());
  const [bulkTrack, setBulkTrack] = useState("");
  const [busy, setBusy] = useState<Id<"teams"> | "bulk" | null>(null);
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
  const filterTrack =
    trackFilter !== ALL && trackFilter !== NONE
      ? (trackFilter as Id<"tracks">)
      : null;
  const addable = filterTrack
    ? data.teams.filter(
        (team) =>
          matchesSearch(team, query) &&
          !team.entered.some((track) => track._id === filterTrack) &&
          !adding.has(team._id)
      )
    : [];
  const addingTeams = data.teams.filter((team) => adding.has(team._id));

  const visibleIds = teams.map((team) => team._id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someVisibleSelected = selectedVisible.length > 0;

  const toggle = (teamId: Id<"teams">, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(teamId);
      } else {
        next.delete(teamId);
      }
      return next;
    });
  };

  const toggleVisible = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (on) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const save = async (
    teamIds: Id<"teams">[],
    trackId: Id<"tracks"> | undefined,
    scope: Id<"teams"> | "bulk"
  ) => {
    setBusy(scope);
    setError(null);
    try {
      await setTrack({ teamIds, trackId });
      if (scope === "bulk") {
        setSelected(new Set());
        setAdding(new Set());
      }
    } catch (err) {
      setError(errorMessage(err, "No se pudo cambiar el track."));
    } finally {
      setBusy(null);
    }
  };

  const drop = async (
    teamIds: Id<"teams">[],
    trackId: Id<"tracks">,
    scope: Id<"teams"> | "bulk"
  ) => {
    setBusy(scope);
    setError(null);
    try {
      await removeTrack({ teamIds, trackId });
      if (scope === "bulk") {
        setSelected(new Set());
      }
    } catch (err) {
      setError(errorMessage(err, "No se pudo quitar el track."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page
      title="Equipos"
      description="Asignar suma un track. La cruz lo quita. El tope de 15 no aplica aquí."
      className="flex h-[calc(100dvh-11rem)] flex-col gap-4 space-y-0 sm:h-[calc(100dvh-12rem)]"
    >
      <div className="grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Equipo o email"
          aria-label="Buscar equipo o email"
        />
        <Select
          value={trackFilter}
          onValueChange={(value) => {
            setTrackFilter(value);
            setAdding(new Set());
          }}
        >
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
      {filterTrack ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select
            value={undefined}
            onValueChange={(teamId) =>
              setAdding((prev) => {
                const next = new Set(prev);
                next.add(teamId as Id<"teams">);
                return next;
              })
            }
          >
            <SelectTrigger
              aria-label="Añadir equipos al track"
              className="min-w-52"
              size="sm"
            >
              <SelectValue placeholder="Añadir equipos" />
            </SelectTrigger>
            <SelectContent>
              {addable.length === 0 ? (
                <SelectItem value="none" disabled>
                  No hay más equipos
                </SelectItem>
              ) : (
                addable.map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {addingTeams.map((team) => (
            <Badge key={team._id} className="gap-1 pr-0.5">
              {team.name}
              <button
                type="button"
                aria-label={`Sacar ${team.name} de la lista`}
                className="flex size-5 items-center justify-center text-hs-ink/70 hover:text-hs-ink"
                onClick={() =>
                  setAdding((prev) => {
                    const next = new Set(prev);
                    next.delete(team._id);
                    return next;
                  })
                }
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
          {adding.size > 0 ? (
            <Button
              type="button"
              size="sm"
              disabled={busy !== null}
              onClick={() => void save([...adding], filterTrack, "bulk")}
            >
              {adding.size === 1 ? "Añadir 1" : `Añadir ${adding.size}`}
            </Button>
          ) : null}
        </div>
      ) : null}
      {selected.size > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <p className="text-sm text-hs-brown tabular-nums" aria-live="polite">
            {selected.size === 1
              ? "1 seleccionado"
              : `${selected.size} seleccionados`}
          </p>
          {filterTrack ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                onClick={() => void save([...selected], filterTrack, "bulk")}
              >
                Añadir al track
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void drop([...selected], filterTrack, "bulk")}
              >
                Quitar del track
              </Button>
            </>
          ) : (
            <>
              <Select value={bulkTrack || undefined} onValueChange={setBulkTrack}>
                <SelectTrigger
                  aria-label="Track para los seleccionados"
                  className="min-w-44"
                  size="sm"
                >
                  <SelectValue placeholder="Track" />
                </SelectTrigger>
                <SelectContent>
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
              <Button
                type="button"
                size="sm"
                disabled={busy !== null || !bulkTrack}
                onClick={() =>
                  void save([...selected], bulkTrack as Id<"tracks">, "bulk")
                }
              >
                Asignar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void save([...selected], undefined, "bulk")}
              >
                Quitar
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="shrink-0 text-sm text-hs-brown tabular-nums" aria-live="polite">
          {teams.length === 1 ? "1 equipo" : `${teams.length} equipos`}
        </p>
      )}
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
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todos"
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  disabled={busy !== null || visibleIds.length === 0}
                  onCheckedChange={(state) => toggleVisible(state === true)}
                />
              </TableHead>
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
                checked={selected.has(team._id)}
                countById={countById}
                disabled={busy !== null}
                team={team}
                teamLimit={data.teamLimit}
                tracks={data.tracks}
                onChange={(trackId) =>
                  void save([team._id], trackId, team._id)
                }
                onCheckedChange={(on) => toggle(team._id, on)}
                onRemove={(trackId) => void drop([team._id], trackId, team._id)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Page>
  );
}

function TeamRowView({
  checked,
  countById,
  disabled,
  onChange,
  onCheckedChange,
  onRemove,
  team,
  teamLimit,
  tracks,
}: {
  checked: boolean;
  countById: Map<string, number>;
  disabled: boolean;
  onChange: (trackId: Id<"tracks">) => void;
  onCheckedChange: (on: boolean) => void;
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
  const enteredIds = new Set(team.entered.map((track) => track._id));
  const available = tracks.filter((track) => !enteredIds.has(track._id));
  return (
    <TableRow
      className="[&_td]:border-b [&_td]:border-hs-ink/20"
      data-disabled={disabled || undefined}
      data-state={checked ? "selected" : undefined}
    >
      <TableCell className="w-10">
        <Checkbox
          aria-label={`Seleccionar ${team.name}`}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(state) => onCheckedChange(state === true)}
        />
      </TableCell>
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
          </div>
        )}
      </TableCell>
      <TableCell>
        {available.length === 0 ? null : (
          <Select
            value={undefined}
            disabled={disabled}
            onValueChange={(value) => onChange(value as Id<"tracks">)}
          >
            <SelectTrigger
              aria-label={`Añadir track a ${team.name}`}
              className="min-w-44"
              size="sm"
            >
              <SelectValue placeholder="Añadir" />
            </SelectTrigger>
            <SelectContent>
              {available.map((track) => (
                <SelectItem key={track._id} value={track._id}>
                  <span>{track.label}</span>
                  <span className="text-xs text-hs-brown tabular-nums">
                    · {occupancy(track.teamCount, teamLimit)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
    </TableRow>
  );
}
