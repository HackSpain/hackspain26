"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2, Mail, UserPlus, Users } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatScore } from "@/components/judging/assessment-form";
import {
  FormError,
  FormNotice,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

type Person = FunctionReturnType<typeof api.finalists.listPeople>[number];
type TeamRow = FunctionReturnType<typeof api.finalists.listTeams>[number];
type Filter = "all" | "in" | "canceled" | "out";

const ADDED_AT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function personKey(person: { userId?: string; signupId?: string }) {
  return person.userId ?? person.signupId ?? "";
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function addSummary(result: { added: number; restored: number; skipped: number }) {
  const parts = [];
  if (result.added > 0) {
    parts.push(
      `${result.added} ${plural(result.added, "persona nueva", "personas nuevas")}`,
    );
  }
  if (result.restored > 0) {
    parts.push(
      `${result.restored} ${plural(result.restored, "restaurada", "restauradas")}`,
    );
  }
  if (result.skipped > 0) {
    parts.push(
      `${result.skipped} ${plural(result.skipped, "ya estaba", "ya estaban")}`,
    );
  }
  return parts.join(" · ");
}

function teamScoreLabel(team: Pick<TeamRow, "rank" | "score">) {
  if (team.score === null) {
    return "sin nota";
  }
  const score = formatScore(team.score);
  return team.rank === null ? score : `#${team.rank} · ${score}`;
}

function emailLabel(row: Person) {
  if (row.status === "canceled") {
    return "—";
  }
  return row.emailedAt ? "enviado" : "pendiente";
}

function parseLocalDateTime(value: string): number | null {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | undefined;
  tone?: "ink" | "teal" | "red";
}) {
  const counting = value === undefined;
  return (
    <div className="border-[3px] border-hs-ink bg-hs-paper px-4 py-3">
      <p
        className={cn(
          "font-bungee text-3xl leading-none tabular-nums",
          counting && "text-hs-ink/40",
          tone === "teal" && !counting && "text-hs-teal",
          tone === "red" && !counting && "text-hs-red",
        )}
      >
        {counting ? "—" : value}
      </p>
      <p className="mt-1 text-sm text-hs-brown">{label}</p>
    </div>
  );
}

export default function AdminFinalPage() {
  const ids = useId();
  const counts = useQuery(api.finalists.counts);
  const people = useQuery(api.finalists.listPeople);
  const teams = useQuery(api.finalists.listTeams);
  const addPeople = useMutation(api.finalists.addPeople);
  const addTeam = useMutation(api.finalists.addTeam);
  const setStatus = useMutation(api.finalists.setStatus);
  const sendEmails = useMutation(api.finalists.sendEmails);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [listSearch, setListSearch] = useState("");
  const [since, setSince] = useState("");
  const [selected, setSelected] = useState<Set<Id<"finalists">>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { already: number; ids: Id<"finalists">[]; kind: "send"; name?: string }
    | { kind: "cancelPerson"; row: Person }
    | null
  >(null);
  const [pending, setPending] = useState<"add" | "team" | "send" | Id<"finalists"> | null>(
    null,
  );

  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of people ?? []) {
      map.set(personKey(person), person);
    }
    return map;
  }, [people]);

  const visible = useMemo(() => {
    if (!people) {
      return [];
    }
    const needle = listSearch.trim().toLowerCase();
    return people.filter((row) => {
      if (filter !== "all" && row.status !== filter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.teamName?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [filter, listSearch, people]);

  const addableKeys = visible
    .filter((row) => row.status === "out")
    .map((row) => personKey(row))
    .filter(Boolean);
  const allAddablePicked =
    addableKeys.length > 0 && addableKeys.every((key) => picked.has(key));

  const selectableIds = visible
    .filter((row) => row.status === "in" && row.finalistId)
    .map((row) => row.finalistId as Id<"finalists">);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const allInIds = useMemo(
    () =>
      (people ?? [])
        .filter((row) => row.status === "in" && row.finalistId)
        .map((row) => row.finalistId as Id<"finalists">),
    [people],
  );
  const sinceMs = parseLocalDateTime(since);
  const sinceIds = useMemo(() => {
    if (!people || sinceMs === null) {
      return [];
    }
    return people
      .filter(
        (row) =>
          row.status === "in" &&
          row.finalistId &&
          row.addedAt !== undefined &&
          row.addedAt >= sinceMs,
      )
      .map((row) => row.finalistId as Id<"finalists">);
  }, [people, sinceMs]);

  function flash(message: string) {
    setFormError(null);
    setNotice(message);
  }

  function fail(error: unknown, fallback: string) {
    setNotice(null);
    setFormError(errorMessage(error, fallback));
  }

  function togglePick(key: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleSelected(id: Id<"finalists">) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleRow(row: Person) {
    if (row.status === "canceled") {
      return;
    }
    if (row.status === "in" && row.finalistId) {
      toggleSelected(row.finalistId);
      return;
    }
    const key = personKey(row);
    if (key) {
      togglePick(key);
    }
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of selectableIds) {
          next.delete(id);
        }
      } else {
        for (const id of selectableIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleAllAddable() {
    setPicked((current) => {
      const next = new Set(current);
      if (allAddablePicked) {
        for (const key of addableKeys) {
          next.delete(key);
        }
      } else {
        for (const key of addableKeys) {
          next.add(key);
        }
      }
      return next;
    });
  }

  function selectIds(finalistIds: Id<"finalists">[]) {
    setSelected(new Set(finalistIds));
  }

  async function submitPeople() {
    const toAdd = [...picked]
      .map((key) => peopleMap.get(key))
      .filter((person): person is Person => person !== undefined)
      .map((person) => ({
        signupId: person.signupId,
        userId: person.userId,
      }));
    if (toAdd.length === 0 || pending) {
      return;
    }
    setPending("add");
    try {
      const result = await addPeople({ people: toAdd });
      flash(addSummary(result));
      setPicked(new Set());
    } catch (error) {
      fail(error, "No se ha podido añadir");
    } finally {
      setPending(null);
    }
  }

  async function submitTeam() {
    if (!teamId || pending) {
      return;
    }
    setPending("team");
    try {
      const result = await addTeam({ teamId: teamId as Id<"teams"> });
      flash(addSummary(result));
      setTeamId("");
    } catch (error) {
      fail(error, "No se ha podido añadir el equipo");
    } finally {
      setPending(null);
    }
  }

  async function submitSend() {
    if (confirm?.kind !== "send" || confirm.ids.length === 0 || pending) {
      return;
    }
    const idsToSend = confirm.ids;
    setPending(idsToSend.length === 1 ? (idsToSend[0] ?? "send") : "send");
    setConfirm(null);
    try {
      const count = await sendEmails({ ids: idsToSend });
      flash(
        `En cola para ${count} ${plural(count, "destinatario", "destinatarios")}.`,
      );
      setSelected((current) => {
        const next = new Set(current);
        for (const id of idsToSend) {
          next.delete(id);
        }
        return next;
      });
    } catch (error) {
      fail(error, "No se ha podido enviar");
    } finally {
      setPending(null);
    }
  }

  function requestSend() {
    if (selected.size === 0 || pending) {
      return;
    }
    const selectedIds = [...selected];
    const already =
      people?.filter(
        (row) =>
          row.finalistId !== undefined &&
          selected.has(row.finalistId) &&
          row.emailedAt !== undefined,
      ).length ?? 0;
    setConfirm({ already, ids: selectedIds, kind: "send" });
  }

  function requestSendOne(row: Person) {
    if (!row.finalistId || row.status !== "in" || pending) {
      return;
    }
    setConfirm({
      already: row.emailedAt === undefined ? 0 : 1,
      ids: [row.finalistId],
      kind: "send",
      name: row.name,
    });
  }

  async function submitStatus(row: Person, status: "in" | "canceled") {
    const finalistId = row.finalistId;
    if (!finalistId || pending) {
      return;
    }
    setPending(finalistId);
    setConfirm(null);
    try {
      await setStatus({ id: finalistId, status });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(finalistId);
        return next;
      });
      setNotice(null);
      setFormError(null);
    } catch (error) {
      fail(error, "No se ha podido cambiar el estado");
    } finally {
      setPending(null);
    }
  }

  const selectedTeam = teams?.find((team) => team._id === teamId);

  let confirmTitle = "Cancelar plaza";
  let confirmBody = "";
  if (confirm?.kind === "send") {
    confirmTitle = "Enviar correo";
    confirmBody = confirm.name
      ? `¿Enviar el correo a ${confirm.name}?`
      : `¿Enviar el correo a ${confirm.ids.length} ${plural(confirm.ids.length, "persona", "personas")}?`;
    if (confirm.already > 0) {
      confirmBody += confirm.name
        ? " Ya lo recibió y se reenvía."
        : ` ${confirm.already} ya lo ${plural(confirm.already, "recibió", "recibieron")} y se reenvía.`;
    }
  } else if (confirm?.kind === "cancelPerson") {
    confirmBody = `¿Marcar a ${confirm.row.name} como cancelado?`;
  }

  return (
    <Page
      title="Final"
      description="Quién entra a la final. Añade gente o equipos enteros, mándales el correo y lleva la cuenta de cancelaciones."
    >
      <div className="hs-stagger grid gap-3 sm:grid-cols-3">
        <Stat label="dentro" tone="teal" value={counts?.inside} />
        <Stat label="cancelados" tone="red" value={counts?.canceled} />
        <Stat label="sin correo" value={counts?.pendingEmail} />
      </div>

      <FormNotice message={notice} />
      <FormError message={formError} />

      <section className="grid gap-3" aria-labelledby={`${ids}-list`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id={`${ids}-list`} className="font-bungee text-lg">
            Toda la gente
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as Filter)}
            >
              <SelectTrigger className="w-40" aria-label="Filtrar estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in">Dentro</SelectItem>
                <SelectItem value="out">Fuera</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Buscar por nombre, email o equipo"
              autoComplete="off"
              className="w-full sm:w-64"
              onChange={(event) => setListSearch(event.target.value)}
              placeholder="Nombre, email o equipo"
              value={listSearch}
            />
            <Button
              disabled={picked.size === 0}
              aria-busy={pending === "add"}
              onClick={() => void submitPeople()}
            >
              {pending === "add" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <UserPlus aria-hidden />
              )}
              Añadir
              {picked.size > 0 ? ` (${picked.size})` : ""}
            </Button>
            <Button
              disabled={selected.size === 0}
              aria-busy={pending === "send"}
              onClick={() => requestSend()}
            >
              {pending === "send" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Mail aria-hidden />
              )}
              Enviar correo
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden border-[3px] border-hs-ink">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 bg-hs-sand px-3 py-3">
            <Button
              type="button"
              variant="outline"
              className="bg-hs-paper"
              disabled={allInIds.length === 0}
              onClick={() => selectIds(allInIds)}
            >
              Seleccionar todos
              {allInIds.length > 0 ? ` (${allInIds.length})` : ""}
            </Button>
            <div
              aria-hidden
              className="hidden h-8 w-px shrink-0 bg-hs-ink/20 sm:block"
            />
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor={`${ids}-since`}
                  className="text-xs tracking-[0.08em] text-hs-ink/70"
                >
                  Entraron a la final desde
                </Label>
                <Input
                  id={`${ids}-since`}
                  type="datetime-local"
                  step={60}
                  aria-label="Hora a partir de la que entraron a la final"
                  className="w-full bg-hs-paper sm:w-56"
                  value={since}
                  onChange={(event) => setSince(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="bg-hs-paper"
                disabled={sinceIds.length === 0}
                onClick={() => selectIds(sinceIds)}
              >
                Seleccionar
                {sinceMs !== null ? ` (${sinceIds.length})` : ""}
              </Button>
            </div>
          </div>

          {people === undefined && (
            <div className="border-t-[3px] border-hs-ink bg-hs-paper px-3 py-6">
              <LoadingText />
            </div>
          )}
          {people !== undefined && visible.length === 0 && (
            <div className="border-t-[3px] border-hs-ink bg-hs-paper px-4 py-8">
              <p className="font-bungee text-base">
                {people.length === 0 ? "Todavía vacío" : "Nadie en este filtro"}
              </p>
              <p className="mt-1 text-sm text-hs-brown">
                {people.length === 0
                  ? "No hay participantes para mostrar."
                  : "Prueba otro estado o limpia el filtro."}
              </p>
            </div>
          )}
          {people !== undefined && visible.length > 0 && (
            <Table containerClassName="max-h-[min(36rem,70vh)] border-0 border-t-[3px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={
                      filter === "in"
                        ? "Seleccionar a quien está dentro"
                        : "Seleccionar a quien se puede añadir"
                    }
                    checked={filter === "in" ? allVisibleSelected : allAddablePicked}
                    className="mt-0"
                    disabled={
                      filter === "canceled" ||
                      (filter === "in"
                        ? selectableIds.length === 0
                        : addableKeys.length === 0)
                    }
                    onCheckedChange={() => {
                      if (filter === "in") {
                        toggleAllVisible();
                        return;
                      }
                      toggleAllAddable();
                    }}
                  />
                </TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const key = personKey(row);
                const busy = pending === row.finalistId;
                const checked =
                  row.status === "in" && row.finalistId
                    ? selected.has(row.finalistId)
                    : picked.has(key);
                return (
                  <TableRow
                    key={key || row.email}
                    data-state={checked ? "selected" : undefined}
                    className={
                      row.status === "canceled" || !key
                        ? undefined
                        : "cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60"
                    }
                    onClick={() => toggleRow(row)}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar a ${row.name}`}
                        checked={checked}
                        className="mt-0"
                        disabled={row.status === "canceled" || !key}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleRow(row)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">{row.name}</span>
                      <span className="mt-0.5 block text-xs text-hs-brown">
                        {row.email || "sin email"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal text-hs-brown">
                      {row.teamName ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-medium">{teamScoreLabel(row)}</span>
                      {row.scores.length > 0 ? (
                        <span className="mt-0.5 block text-xs text-hs-brown">
                          {row.scores.map((value) => formatScore(value)).join(" · ")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "in" ? "gold" : "default"}
                        className={cn(
                          "whitespace-nowrap",
                          row.status === "canceled" && "bg-hs-red text-hs-paper",
                        )}
                      >
                        {row.status === "in"
                          ? "Dentro"
                          : row.status === "canceled"
                            ? "Cancelado"
                            : "Fuera"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-hs-brown">
                      {row.status === "in" && row.addedAt !== undefined
                        ? `${emailLabel(row)} · ${ADDED_AT.format(row.addedAt)}`
                        : emailLabel(row)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "in" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-busy={busy}
                            disabled={!row.email}
                            onClick={(event) => {
                              event.stopPropagation();
                              requestSendOne(row);
                            }}
                          >
                            {row.emailedAt ? "Reenviar" : "Enviar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-busy={busy}
                            className="text-hs-red"
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirm({ kind: "cancelPerson", row });
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : row.status === "canceled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-busy={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void submitStatus(row, "in");
                          }}
                        >
                          Restaurar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Añadir un equipo</CardTitle>
          <CardDescription>
            Entran todos los miembros. Quien ya está dentro se ignora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={teamId || undefined} onValueChange={setTeamId}>
            <SelectTrigger id={`${ids}-team`} aria-label="Equipo">
              <SelectValue placeholder="Elige un equipo" />
            </SelectTrigger>
            <SelectContent>
              {(teams ?? []).map((team: TeamRow) => (
                <SelectItem
                  key={team._id}
                  value={team._id}
                  disabled={team.addable === 0}
                >
                  {teamScoreLabel(team)} · {team.name} · {team.memberCount}{" "}
                  {plural(team.memberCount, "persona", "personas")}
                  {team.alreadyIn > 0 ? ` · ${team.alreadyIn} ya dentro` : ""}
                  {team.addable === 0 ? " · completo" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTeam ? (
            <p className="text-sm text-hs-brown">
              {teamScoreLabel(selectedTeam)}
              {selectedTeam.scores.length > 0
                ? ` · jueces ${selectedTeam.scores.map((value) => formatScore(value)).join(" · ")}`
                : ""}
              {" · "}
              {selectedTeam.addable}{" "}
              {plural(selectedTeam.addable, "nueva", "nuevas")} ·{" "}
              {selectedTeam.alreadyIn} ya dentro
            </p>
          ) : null}
          <Button
            disabled={!selectedTeam || selectedTeam.addable === 0}
            aria-busy={pending === "team"}
            onClick={() => void submitTeam()}
          >
            {pending === "team" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Users aria-hidden />
            )}
            Añadir equipo
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              No
            </Button>
            <Button
              type="button"
              className={cn(
                confirm?.kind === "cancelPerson" && "bg-hs-red text-hs-paper",
              )}
              onClick={() => {
                if (confirm?.kind === "send") {
                  void submitSend();
                  return;
                }
                if (confirm?.kind === "cancelPerson") {
                  void submitStatus(confirm.row, "canceled");
                }
              }}
            >
              Sí
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
