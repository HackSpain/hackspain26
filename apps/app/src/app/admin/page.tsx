"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { api } from "@convex/_generated/api";
import {
  ParticipantDetail,
  participantHref,
  participantName,
  participantRef,
  useParticipant,
} from "@/components/admin/participant-detail";
import type { ParticipantRef } from "@/components/admin/participant-detail";
import { EmptyState, LoadingText, Page, RecordCard } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { attendanceLabel, displayedAttendance } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const USER_PARAM = "user";
const KIND_PARAM = "kind";

type ParticipantRow = FunctionReturnType<typeof api.admin.listParticipants>[number];

function rowRef(row: ParticipantRow): ParticipantRef | null {
  if (row.signupId) return { kind: "signup", id: row.signupId };
  if (row.userId) return { kind: "user", id: row.userId };
  return null;
}

function refFromParams(params: URLSearchParams): ParticipantRef | null {
  const id = params.get(USER_PARAM);
  return id ? participantRef(params.get(KIND_PARAM), id) : null;
}

function sameRef(a: ParticipantRef | null, b: ParticipantRef | null) {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id;
}

function activateOnKey(event: KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  open();
}

export default function AdminCrmPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminCrm />
    </Suspense>
  );
}

function AdminCrm() {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState<
    "all" | "attending" | "cancelled" | "undecided"
  >("all");
  const [accepted, setAccepted] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rows = useQuery(api.admin.listParticipants, {
    search: searchQuery || undefined,
    attendance: attendance === "all" ? undefined : attendance,
    accepted: accepted === "all" ? undefined : accepted === "yes",
  });

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = useMemo(() => refFromParams(searchParams), [searchParams]);
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selected) pushed.current = false;
  }, [selected]);

  const openParticipant = (ref: ParticipantRef, from: HTMLElement | null) => {
    triggerRef.current = from;
    const next = new URLSearchParams(window.location.search);
    const alreadyOpen = next.has(USER_PARAM);
    next.set(USER_PARAM, ref.id);
    if (ref.kind === "user") next.set(KIND_PARAM, "user");
    else next.delete(KIND_PARAM);
    const url = `${pathname}?${next.toString()}`;
    if (alreadyOpen) {
      window.history.replaceState(null, "", url);
    } else {
      window.history.pushState(null, "", url);
      pushed.current = true;
    }
  };

  const closeParticipant = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    const next = new URLSearchParams(window.location.search);
    next.delete(USER_PARAM);
    next.delete(KIND_PARAM);
    const query = next.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  const selectedRow = selected
    ? rows?.find((row) => sameRef(rowRef(row), selected))
    : undefined;

  return (
    <Page
      title="Participantes"
      className="flex h-[calc(100dvh-11rem)] flex-col gap-6 space-y-0 sm:h-[calc(100dvh-12rem)]"
    >
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar nombre, email, equipo"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          value={accepted}
          onValueChange={(value) => setAccepted(value as "all" | "yes" | "no")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la aceptación</SelectItem>
            <SelectItem value="yes">Aceptados</SelectItem>
            <SelectItem value="no">No aceptados</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={attendance}
          onValueChange={(value) =>
            setAttendance(value as "all" | "attending" | "cancelled" | "undecided")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la asistencia</SelectItem>
            <SelectItem value="attending">Asistiré</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="undecided">Sin decidir</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!rows ? (
        <LoadingText />
      ) : rows.length === 0 ? (
        <EmptyState title="Ningún participante coincide">
          Prueba otra búsqueda o quita los filtros.
        </EmptyState>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain md:hidden">
            {rows.map((row) => {
              const ref = rowRef(row);
              const attendance = displayedAttendance(
                row.attendanceStatus,
                row.onboardingComplete === true,
              );
              const open = (from: HTMLElement) => {
                if (ref) openParticipant(ref, from);
              };
              return (
                <div
                  key={`${row.signupId ?? ""}-${row.userId ?? ""}`}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-expanded={sameRef(ref, selected)}
                  onClick={(event) => open(event.currentTarget)}
                  onKeyDown={(event) =>
                    activateOnKey(event, () => open(event.currentTarget))
                  }
                  className="block cursor-pointer outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] hover:[&>[data-slot=card]]:bg-hs-sand/60 focus-visible:[&>[data-slot=card]]:border-hs-navy aria-expanded:[&>[data-slot=card]]:bg-hs-sand"
                >
                  <RecordCard
                    title={row.name}
                    subtitle={row.email}
                    badges={
                      <>
                        <Badge variant={row.accepted ? "gold" : "default"}>
                          {row.accepted ? "aceptado" : "no aceptado"}
                        </Badge>
                        <Badge>
                          {attendance ? attendanceLabel(attendance) : "—"}
                        </Badge>
                      </>
                    }
                  >
                    <p className="text-sm text-hs-brown">
                      {row.teamName ?? "Sin equipo"}
                      {row.travelOrigin ? ` · ${row.travelOrigin}` : ""}
                    </p>
                  </RecordCard>
                </div>
              );
            })}
          </div>
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <Table
              className="border-separate border-spacing-0"
              containerClassName="min-h-0 flex-1 overflow-auto overscroll-contain"
            >
              <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Aceptado</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Dieta</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead>Equipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const ref = rowRef(row);
                  const isSelected = sameRef(ref, selected);
                  const attendance = displayedAttendance(
                    row.attendanceStatus,
                    row.onboardingComplete === true,
                  );
                  return (
                    <TableRow
                      key={`${row.signupId ?? ""}-${row.userId ?? ""}`}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={(event) => {
                        if (!ref) return;
                        openParticipant(
                          ref,
                          event.currentTarget.querySelector<HTMLElement>(
                            "[data-row-trigger]",
                          ),
                        );
                      }}
                      className="cursor-pointer hover:bg-hs-sand/60 motion-safe:transition-colors motion-safe:duration-100 [&_td]:border-b [&_td]:border-hs-ink/20"
                    >
                      <TableCell>
                        <button
                          type="button"
                          data-row-trigger
                          aria-haspopup="dialog"
                          aria-expanded={isSelected}
                          className="-mx-1 max-w-full truncate px-1 text-left underline-offset-2 outline-none hover:underline focus-visible:border-[3px] focus-visible:border-hs-navy"
                        >
                          {row.name}
                        </button>
                      </TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>
                        <Badge variant={row.accepted ? "gold" : "default"}>
                          {row.accepted ? "aceptado" : "no aceptado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.phone ?? "—"}</TableCell>
                      <TableCell>{row.dietaryRestrictions ?? "—"}</TableCell>
                      <TableCell>{row.travelOrigin ?? "—"}</TableCell>
                      <TableCell>
                        <Badge>
                          {attendance ? attendanceLabel(attendance) : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.teamName ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <ParticipantSheet
        selected={selected}
        fallbackName={selectedRow?.name}
        fallbackEmail={selectedRow?.email}
        onClose={closeParticipant}
        returnFocusRef={triggerRef}
      />
    </Page>
  );
}

function ParticipantSheet({
  selected,
  fallbackName,
  fallbackEmail,
  onClose,
  returnFocusRef,
}: {
  selected: ParticipantRef | null;
  fallbackName?: string;
  fallbackEmail?: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState(selected);
  if (selected && !sameRef(selected, shown)) setShown(selected);

  const detail = useParticipant(shown);
  const name = detail ? participantName(detail) : (fallbackName ?? "Participante");
  const email = detail?.signup?.email ?? detail?.user?.email ?? fallbackEmail;

  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) target.focus();
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>{email ?? "Ficha del participante"}</SheetDescription>
          {shown ? (
            <Link
              href={participantHref(shown)}
              className="inline-flex min-h-11 items-center font-bungee text-xs uppercase text-hs-navy motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
            >
              Abrir página completa
            </Link>
          ) : null}
        </SheetHeader>
        <SheetBody className="space-y-4">
          {detail === undefined ? (
            <LoadingText />
          ) : detail === null ? (
            <EmptyState title="Participante no encontrado">
              Falta esta solicitud o este usuario.
            </EmptyState>
          ) : (
            <ParticipantDetail key={shown?.id} detail={detail} layout="sheet" />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
