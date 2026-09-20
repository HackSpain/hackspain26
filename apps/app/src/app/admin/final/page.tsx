"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2, Mail, UserPlus, Users } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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

type Finalist = FunctionReturnType<typeof api.finalists.list>[number];
type Candidate = FunctionReturnType<typeof api.finalists.searchPeople>[number];
type TeamRow = FunctionReturnType<typeof api.finalists.listTeams>[number];
type Filter = "all" | "in" | "canceled";

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

function emailLabel(row: Finalist) {
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

function SearchHits({
  candidates,
  picked,
  searching,
  searchQuery,
  onToggle,
}: {
  candidates: Candidate[] | undefined;
  picked: Set<string>;
  searching: boolean;
  searchQuery: string;
  onToggle: (key: string) => void;
}) {
  if (searchQuery.trim().length > 0 && searchQuery.trim().length < 2) {
    return <p className="text-sm text-hs-brown">Escribe al menos dos letras.</p>;
  }
  if (searching) {
    return <LoadingText />;
  }
  if (candidates && candidates.length === 0) {
    return (
      <p className="text-sm text-pretty text-hs-brown">
        Nadie con ese texto que no esté ya dentro.
      </p>
    );
  }
  if (!candidates || candidates.length === 0) {
    return null;
  }
  return (
    <ul className="max-h-64 overflow-auto border-[3px] border-hs-ink">
      {candidates.map((candidate) => {
        const key = personKey(candidate);
        return (
          <li key={key} className="border-b border-hs-ink/15 last:border-0">
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm">
              <Checkbox
                checked={picked.has(key)}
                className="mt-0.5"
                onCheckedChange={() => onToggle(key)}
              />
              <span className="min-w-0">
                <span className="block font-medium">{candidate.name}</span>
                <span className="block truncate text-xs text-hs-brown">
                  {candidate.email}
                  {candidate.teamName ? ` · ${candidate.teamName}` : ""}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
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
  const rows = useQuery(api.finalists.list);
  const teams = useQuery(api.finalists.listTeams);
  const addPeople = useMutation(api.finalists.addPeople);
  const addTeam = useMutation(api.finalists.addTeam);
  const setStatus = useMutation(api.finalists.setStatus);
  const sendEmails = useMutation(api.finalists.sendEmails);

  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [listSearch, setListSearch] = useState("");
  const [since, setSince] = useState("");
  const [selected, setSelected] = useState<Set<Id<"finalists">>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { already: number; count: number; kind: "send" }
    | { kind: "cancelPerson"; row: Finalist }
    | null
  >(null);
  const [pending, setPending] = useState<"add" | "team" | "send" | Id<"finalists"> | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const candidates = useQuery(
    api.finalists.searchPeople,
    searchQuery.trim().length >= 2 ? { search: searchQuery } : "skip",
  );

  const candidateMap = useMemo(() => {
    const map = new Map<string, Candidate>();
    for (const candidate of candidates ?? []) {
      map.set(personKey(candidate), candidate);
    }
    return map;
  }, [candidates]);

  const visible = useMemo(() => {
    if (!rows) {
      return [];
    }
    const needle = listSearch.trim().toLowerCase();
    return rows.filter((row) => {
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
  }, [filter, listSearch, rows]);

  const selectableIds = visible
    .filter((row) => row.status === "in")
    .map((row) => row._id);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const allInIds = useMemo(
    () => (rows ?? []).filter((row) => row.status === "in").map((row) => row._id),
    [rows],
  );
  const sinceMs = parseLocalDateTime(since);
  const sinceIds = useMemo(() => {
    if (!rows || sinceMs === null) {
      return [];
    }
    return rows
      .filter((row) => row.status === "in" && row.addedAt >= sinceMs)
      .map((row) => row._id);
  }, [rows, sinceMs]);

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

  function selectIds(finalistIds: Id<"finalists">[]) {
    setSelected(new Set(finalistIds));
  }

  async function submitPeople() {
    const people = [...picked]
      .map((key) => candidateMap.get(key))
      .filter((person): person is Candidate => person !== undefined)
      .map((person) => ({
        signupId: person.signupId,
        userId: person.userId,
      }));
    if (people.length === 0 || pending) {
      return;
    }
    setPending("add");
    try {
      const result = await addPeople({ people });
      flash(addSummary(result));
      setPicked(new Set());
      setSearch("");
      setSearchQuery("");
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
    const idsToSend = [...selected];
    if (idsToSend.length === 0 || pending) {
      return;
    }
    setPending("send");
    setConfirm(null);
    try {
      const count = await sendEmails({ ids: idsToSend });
      flash(
        `En cola para ${count} ${plural(count, "destinatario", "destinatarios")}.`,
      );
      setSelected(new Set());
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
    const already =
      rows?.filter((row) => selected.has(row._id) && row.emailedAt !== undefined)
        .length ?? 0;
    setConfirm({ already, count: selected.size, kind: "send" });
  }

  async function submitStatus(row: Finalist, status: "in" | "canceled") {
    if (pending) {
      return;
    }
    setPending(row._id);
    setConfirm(null);
    try {
      await setStatus({ id: row._id, status });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(row._id);
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
  const searching = searchQuery.trim().length >= 2 && candidates === undefined;

  let confirmTitle = "Cancelar plaza";
  let confirmBody = "";
  if (confirm?.kind === "send") {
    confirmTitle = "Enviar correo";
    confirmBody = `¿Enviar el correo a ${confirm.count} ${plural(confirm.count, "persona", "personas")}?`;
    if (confirm.already > 0) {
      confirmBody += ` ${confirm.already} ya lo ${plural(confirm.already, "recibió", "recibieron")} y se reenvía.`;
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Añadir personas</CardTitle>
            <CardDescription>
              Busca por nombre, email o equipo. Quien ya está dentro no sale.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              aria-label="Buscar participantes"
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, email o equipo"
              value={search}
            />
            {searchQuery.trim().length > 0 ? (
              <SearchHits
                candidates={candidates}
                onToggle={togglePick}
                picked={picked}
                searchQuery={searchQuery}
                searching={searching}
              />
            ) : null}
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
              Añadir {picked.size > 0 ? picked.size : ""}
            </Button>
          </CardContent>
        </Card>

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
                    {team.name} · {team.memberCount}{" "}
                    {plural(team.memberCount, "persona", "personas")}
                    {team.alreadyIn > 0 ? ` · ${team.alreadyIn} ya dentro` : ""}
                    {team.addable === 0 ? " · completo" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTeam ? (
              <p className="text-sm text-hs-brown">
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
      </div>

      <FormNotice message={notice} />
      <FormError message={formError} />

      <section className="grid gap-3" aria-labelledby={`${ids}-list`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id={`${ids}-list`} className="font-bungee text-lg">
            En la final
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
                <SelectItem value="canceled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Filtrar la lista"
              className="w-full sm:w-56"
              onChange={(event) => setListSearch(event.target.value)}
              placeholder="Filtrar lista"
              value={listSearch}
            />
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
                  Entraron desde
                </Label>
                <Input
                  id={`${ids}-since`}
                  type="datetime-local"
                  step={60}
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

          {rows === undefined && (
            <div className="border-t-[3px] border-hs-ink bg-hs-paper px-3 py-6">
              <LoadingText />
            </div>
          )}
          {rows !== undefined && visible.length === 0 && (
            <div className="border-t-[3px] border-hs-ink bg-hs-paper px-4 py-8">
              <p className="font-bungee text-base">
                {rows.length === 0 ? "Todavía vacío" : "Nadie en este filtro"}
              </p>
              <p className="mt-1 text-sm text-hs-brown">
                {rows.length === 0
                  ? "Añade personas o un equipo para empezar."
                  : "Prueba otro estado o limpia el filtro."}
              </p>
            </div>
          )}
          {rows !== undefined && visible.length > 0 && (
            <Table containerClassName="border-0 border-t-[3px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar a quien está dentro"
                    checked={allVisibleSelected}
                    className="mt-0"
                    onCheckedChange={() => toggleAllVisible()}
                  />
                </TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Entró</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const busy = pending === row._id;
                return (
                  <TableRow
                    key={row._id}
                    data-state={selected.has(row._id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar a ${row.name}`}
                        checked={selected.has(row._id)}
                        className="mt-0"
                        disabled={row.status !== "in"}
                        onCheckedChange={() => toggleSelected(row._id)}
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
                    <TableCell className="text-xs tabular-nums text-hs-brown">
                      {ADDED_AT.format(row.addedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "in" ? "gold" : "default"}
                        className={cn(
                          "whitespace-nowrap",
                          row.status === "canceled" && "bg-hs-red text-hs-paper",
                        )}
                      >
                        {row.status === "in" ? "Dentro" : "Cancelado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-hs-brown">
                      {emailLabel(row)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "in" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-busy={busy}
                          className="text-hs-red"
                          onClick={() => setConfirm({ kind: "cancelPerson", row })}
                        >
                          Cancelar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-busy={busy}
                          onClick={() => void submitStatus(row, "in")}
                        >
                          Restaurar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </div>
      </section>

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
