"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { api } from "@convex/_generated/api";
import { AddPeopleDialog } from "@/components/admin/add-people-dialog";
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs";
import { PeopleBulkBar } from "@/components/admin/people-bulk-bar";
import { useAdminEdition } from "@/components/admin/use-admin-edition";
import {
  ParticipantDetail,
  participantName,
  participantRef,
  useParticipant,
} from "@/components/admin/participant-detail";
import type { ParticipantRef } from "@/components/admin/participant-detail";
import {
  EmptyState,
  ListTableSkeleton,
  LoadingText,
  Page,
  RecordCard,
  Skeleton,
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PEOPLE_ATTENDANCE,
  PEOPLE_PAGE,
  PEOPLE_Q,
  PEOPLE_ROLE,
  PEOPLE_STATUS,
  peopleFiltersFrom,
  writePeopleFilter,
} from "@/lib/people-url";
import {
  attendanceLabel,
  cn,
  displayedAttendance,
  roleLabel,
} from "@/lib/utils";
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
const PAGE_SIZE = 40;

const RolesPanel = dynamic(
  () => import("@/components/admin/roles-panel").then((mod) => mod.RolesPanel),
  { loading: () => <LoadingText /> }
);

type ParticipantList = FunctionReturnType<typeof api.admin.listParticipants>;
type ParticipantRow = ParticipantList["items"][number];

function rowRef(row: ParticipantRow): ParticipantRef | null {
  if (row.signupId) {
    return { kind: "signup", id: row.signupId };
  }
  if (row.userId) {
    return { kind: "user", id: row.userId };
  }
  return null;
}

function rowKey(row: ParticipantRow) {
  return `${row.signupId ?? ""}-${row.userId ?? ""}`;
}

function refFromParams(params: URLSearchParams): ParticipantRef | null {
  const id = params.get(USER_PARAM);
  return id ? participantRef(params.get(KIND_PARAM), id) : null;
}

function sameRef(a: ParticipantRef | null, b: ParticipantRef | null) {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id;
}

function activateOnKey(event: KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.target !== event.currentTarget) {
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  open();
}

function useKeptQuery<T>(value: T | undefined) {
  const [kept, setKept] = useState(value);
  if (value !== undefined && value !== kept) {
    setKept(value);
  }
  return {
    data: value ?? kept,
    refreshing: value === undefined && kept !== undefined,
  };
}

export function CrmFallback() {
  return (
    <Page
      compact
      className="flex h-[calc(100dvh-8.5rem)] flex-col gap-3 space-y-0 sm:h-[calc(100dvh-9rem)]"
    >
      <CrmToolbarSkeleton />
      <ListTableSkeleton fill rows={8} />
    </Page>
  );
}

const STATUS_LABEL: Record<string, string> = {
  accepted: "Aceptado",
  applied: "Solicitado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
  interested: "Interesado",
  rejected: "Rechazado",
  waitlist: "Lista de espera",
};

export function AdminCrm() {
  const { editionId, isCurrent, ready } = useAdminEdition();
  const tab = useAdminTab("personas");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => peopleFiltersFrom(searchParams),
    [searchParams]
  );
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [appliedQ, setAppliedQ] = useState(filters.q);
  if (appliedQ !== filters.q) {
    setAppliedQ(filters.q);
    if (searchDraft !== null) {
      setSearchDraft(null);
    }
  }
  const search = searchDraft ?? filters.q;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const userTypes = useQuery(api.userTypes.list, tab === "roles" ? "skip" : {});
  const ensureDefaults = useMutation(api.userTypes.ensureDefaults);

  useEffect(() => {
    void ensureDefaults({});
  }, [ensureDefaults]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() === filters.q) {
        return;
      }
      const next = writePeopleFilter(searchParams, PEOPLE_Q, search.trim());
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters.q, pathname, router, search, searchParams]);

  function setFilter(
    key:
      | typeof PEOPLE_ROLE
      | typeof PEOPLE_STATUS
      | typeof PEOPLE_ATTENDANCE
      | typeof PEOPLE_PAGE,
    value: string
  ) {
    const next = writePeopleFilter(searchParams, key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const result = useQuery(
    api.admin.listParticipants,
    tab === "roles" || !ready || !editionId
      ? "skip"
      : {
          attendance:
            filters.attendance === "all" ? undefined : filters.attendance,
          editionId,
          page: filters.page,
          pageSize: PAGE_SIZE,
          search: filters.q || undefined,
          status: filters.status === "all" ? undefined : filters.status,
          userType:
            filters.role === "all"
              ? undefined
              : filters.role === "none"
                ? "none"
                : (filters.role as Id<"userTypes">),
        }
  );
  const { data, refreshing } = useKeptQuery(result);
  const rows = data?.items;
  const total = data?.total ?? 0;
  const currentPage = data?.page ?? filters.page;
  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const selected = useMemo(() => refFromParams(searchParams), [searchParams]);
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) {
      pushed.current = false;
    }
  }, [selected]);

  const openParticipant = (ref: ParticipantRef, from: HTMLElement | null) => {
    triggerRef.current = from;
    const next = new URLSearchParams(window.location.search);
    const alreadyOpen = next.has(USER_PARAM);
    next.set(USER_PARAM, ref.id);
    if (ref.kind === "user") {
      next.set(KIND_PARAM, "user");
    } else {
      next.delete(KIND_PARAM);
    }
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
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname
    );
  };

  const selectedRow = selected
    ? rows?.find((row) => sameRef(rowRef(row), selected))
    : undefined;

  const goPage = (nextPage: number) => {
    setFilter(PEOPLE_PAGE, String(nextPage));
    listRef.current?.scrollTo({ top: 0 });
    tableRef.current?.scrollTo({ top: 0 });
  };

  const toggleSelected = (signupId: string, on: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (on) {
        next.add(signupId);
      } else {
        next.delete(signupId);
      }
      return next;
    });
  };

  return (
    <Page
      compact
      className={
        tab === "roles"
          ? undefined
          : "flex h-[calc(100dvh-8.5rem)] flex-col gap-3 space-y-0 sm:h-[calc(100dvh-9rem)]"
      }
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <AdminTabs
          className="min-w-0 flex-1"
          defaultTab="personas"
          tabs={[
            { value: "personas", label: "Lista" },
            { value: "roles", label: "Roles" },
          ]}
        />
        {tab === "personas" && isCurrent ? <AddPeopleDialog /> : null}
      </div>
      {tab === "roles" ? (
        <RolesPanel />
      ) : (
        <>
          <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar nombre, email, equipo"
              aria-label="Buscar participantes"
              className="sm:col-span-2 lg:col-span-1"
            />
            <Select
              value={filters.role}
              onValueChange={(value) => setFilter(PEOPLE_ROLE, value)}
            >
              <SelectTrigger aria-label="Rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="none">Sin rol</SelectItem>
                {(userTypes ?? []).map((type) => (
                  <SelectItem key={type._id} value={type._id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilter(PEOPLE_STATUS, value)}
            >
              <SelectTrigger aria-label="Estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el estado</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.attendance}
              onValueChange={(value) => setFilter(PEOPLE_ATTENDANCE, value)}
            >
              <SelectTrigger aria-label="Asistencia">
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
          {isCurrent ? (
            <PeopleBulkBar
              selectedIds={[...selectedIds]}
              onCleared={() => setSelectedIds(new Set())}
            />
          ) : null}
          <div className="flex h-5 shrink-0 items-center justify-between">
            <p
              className="text-sm text-hs-brown tabular-nums"
              aria-live="polite"
            >
              {data === undefined
                ? " "
                : refreshing
                  ? "Actualizando…"
                  : total === 1
                    ? "1 participante"
                    : `${total} participantes`}
            </p>
          </div>
          {data === undefined ? (
            <ListTableSkeleton fill rows={8} />
          ) : !rows || rows.length === 0 ? (
            <EmptyState title="Ningún participante coincide">
              Prueba otra búsqueda o quita los filtros.
            </EmptyState>
          ) : (
            <>
              <div
                className={cn(
                  "min-h-0 flex-1",
                  refreshing &&
                    "opacity-60 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-[var(--ease-out)]"
                )}
              >
                <div
                  ref={listRef}
                  className="grid h-full gap-3 overflow-y-auto overscroll-contain md:hidden"
                >
                  {rows.map((row) => {
                    const ref = rowRef(row);
                    const status = displayedAttendance(
                      row.attendanceStatus,
                      row.onboardingComplete === true
                    );
                    const staff = roleLabel(row.role);
                    const open = (from: HTMLElement) => {
                      if (ref) {
                        openParticipant(ref, from);
                      }
                    };
                    return (
                      <div
                        key={rowKey(row)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${row.name}, ${row.email}`}
                        aria-haspopup="dialog"
                        aria-expanded={sameRef(ref, selected)}
                        onClick={(event) => open(event.currentTarget)}
                        onKeyDown={(event) =>
                          activateOnKey(event, () => open(event.currentTarget))
                        }
                        className="block cursor-pointer outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:[&>[data-slot=card]]:bg-hs-sand/60 focus-visible:[&>[data-slot=card]]:border-hs-navy aria-expanded:[&>[data-slot=card]]:bg-hs-sand"
                      >
                        <RecordCard
                          title={row.name}
                          subtitle={row.email}
                          badges={
                            <>
                              <Badge
                                variant={row.accepted ? "gold" : "default"}
                              >
                                {row.accepted ? "aceptado" : "no aceptado"}
                              </Badge>
                              <Badge>
                                {status ? attendanceLabel(status) : "—"}
                              </Badge>
                              {staff ? <Badge>{staff}</Badge> : null}
                            </>
                          }
                        >
                          {isCurrent && row.signupId ? (
                            <div className="mb-2">
                              <Checkbox
                                aria-label={`Seleccionar ${row.name}`}
                                checked={selectedIds.has(row.signupId)}
                                onClick={(event) => event.stopPropagation()}
                                onCheckedChange={(checked) =>
                                  toggleSelected(
                                    row.signupId as string,
                                    checked === true
                                  )
                                }
                              />
                            </div>
                          ) : null}
                          <p className="text-sm text-hs-brown">
                            {row.teamName ?? "Sin equipo"}
                            {row.userTypeLabel ? ` · ${row.userTypeLabel}` : ""}
                          </p>
                        </RecordCard>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden h-full min-h-0 flex-col md:flex">
                  <Table
                    className="border-separate border-spacing-0"
                    containerClassName="min-h-0 flex-1 overflow-auto overscroll-contain"
                    containerRef={tableRef}
                  >
                    <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
                      <TableRow>
                        {isCurrent ? (
                          <TableHead className="w-10">
                            <span className="sr-only">Seleccionar</span>
                          </TableHead>
                        ) : null}
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Aceptado</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Dieta</TableHead>
                        <TableHead>Asistencia</TableHead>
                        <TableHead>Equipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const ref = rowRef(row);
                        const isSelected = sameRef(ref, selected);
                        const status = displayedAttendance(
                          row.attendanceStatus,
                          row.onboardingComplete === true
                        );
                        const staff = roleLabel(row.role);
                        return (
                          <TableRow
                            key={rowKey(row)}
                            data-state={isSelected ? "selected" : undefined}
                            onClick={(event) => {
                              if (!ref) {
                                return;
                              }
                              openParticipant(
                                ref,
                                event.currentTarget.querySelector<HTMLElement>(
                                  "[data-row-trigger]"
                                )
                              );
                            }}
                            className="h-11 cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 motion-safe:transition-colors motion-safe:duration-100 [&_td]:border-b [&_td]:border-hs-ink/20"
                          >
                            {isCurrent && row.signupId ? (
                              <TableCell
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  aria-label={`Seleccionar ${row.name}`}
                                  checked={selectedIds.has(row.signupId)}
                                  onCheckedChange={(checked) =>
                                    toggleSelected(
                                      row.signupId as string,
                                      checked === true
                                    )
                                  }
                                />
                              </TableCell>
                            ) : isCurrent ? (
                              <TableCell />
                            ) : null}
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  type="button"
                                  data-row-trigger
                                  aria-haspopup="dialog"
                                  aria-expanded={isSelected}
                                  className="-mx-1 min-w-0 truncate px-1 text-left underline-offset-2 outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:border-[3px] focus-visible:border-hs-navy"
                                >
                                  {row.name}
                                </button>
                                {staff ? (
                                  <Badge className="whitespace-nowrap">
                                    {staff}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-56 truncate">
                              {row.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={row.accepted ? "gold" : "default"}
                              >
                                {row.accepted ? "aceptado" : "no aceptado"}
                              </Badge>
                            </TableCell>
                            <TableCell>{row.phone ?? "—"}</TableCell>
                            <TableCell className="max-w-36 truncate">
                              {row.userTypeLabel ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-40 truncate">
                              {row.dietaryRestrictions ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge>
                                {status ? attendanceLabel(status) : "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-40 truncate">
                              {row.teamName ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <CrmPager
                page={currentPage}
                pageSize={pageSize}
                total={total}
                onPage={goPage}
              />
            </>
          )}
          <ParticipantSheet
            selected={selected}
            fallbackName={selectedRow?.name}
            fallbackEmail={selectedRow?.email}
            onClose={closeParticipant}
            returnFocusRef={triggerRef}
          />
        </>
      )}
    </Page>
  );
}

function CrmPager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-[3px] border-hs-ink bg-hs-sand px-3">
      <p className="text-sm text-hs-brown tabular-nums">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-hs-paper"
          disabled={page <= 1}
          aria-label="Página anterior"
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
          Anterior
        </Button>
        <p
          className="min-w-16 text-center text-sm tabular-nums"
          aria-live="polite"
        >
          {page} / {pages}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-hs-paper"
          disabled={page >= pages}
          aria-label="Página siguiente"
          onClick={() => onPage(page + 1)}
        >
          Siguiente
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function CrmToolbarSkeleton() {
  return (
    <div
      className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-hidden
    >
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="border-[3px] border-hs-ink p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
      <div className="border-[3px] border-hs-ink p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-11 w-40" />
        <Skeleton className="mt-2 h-11 w-36" />
      </div>
    </div>
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
  if (selected && !sameRef(selected, shown)) {
    setShown(selected);
  }
  const visible = selected ?? shown;

  const detail = useParticipant(visible);
  const name = detail
    ? participantName(detail)
    : (fallbackName ?? "Participante");
  const email = detail?.signup?.email ?? detail?.user?.email ?? fallbackEmail;

  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            target.focus();
          }
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            {email ?? "Ficha del participante"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {detail === undefined ? (
            <SheetSkeleton />
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
