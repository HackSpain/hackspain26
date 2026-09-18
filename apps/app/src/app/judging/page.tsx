"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { JudgingContext } from "@convex/lib/validators";
import { ScoreSlider } from "@/components/judging/score-slider";
import { TrackTag } from "@/components/track-tag";
import { VideoFrame } from "@/components/judging/video-frame";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Field,
  FormError,
  MetaLink,
  MetaRow,
  Page,
  RecordCard,
  Skeleton,
  errorMessage,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UrlEntry, UrlKind } from "@/lib/urls";
import { urlDisplay, urlLabel, urlOf } from "@/lib/urls";
import { cn, perkName } from "@/lib/utils";

const DETAIL_URL_ORDER: UrlKind[] = [
  "repo",
  "demo",
  "web",
  "github",
  "video",
  "x",
  "linkedin",
];

const GROUP_PARAM = "grupo";
const PROJECT_PARAM = "proyecto";
const VIEW_PARAM = "vista";

type Meta = FunctionReturnType<typeof api.judging.meta>;
type QueueItem = FunctionReturnType<typeof api.judging.list>[number];
type RankingItem = FunctionReturnType<typeof api.judging.ranking>[number];
type ViewMode = "puntuar" | "clasificacion";

type GroupValue =
  | { kind: "general"; group: number; value: string }
  | { kind: "track"; slug: string; trackId: Id<"tracks">; value: string };

type SheetItem = QueueItem & { canScore: boolean };

function generalValue(group: number) {
  return `general-${group}`;
}

function trackValue(slug: string) {
  return `track-${slug}`;
}

function groupOptions(meta: Meta): GroupValue[] {
  if (!meta.isAdmin) {
    return meta.myAssignments.map((assignment) =>
      assignment.kind === "general"
        ? {
            kind: "general" as const,
            group: assignment.group,
            value: generalValue(assignment.group),
          }
        : {
            kind: "track" as const,
            slug: assignment.slug,
            trackId: assignment.trackId,
            value: trackValue(assignment.slug),
          },
    );
  }
  const generals: GroupValue[] = meta.generalGroups.map((group) => ({
    kind: "general" as const,
    group,
    value: generalValue(group),
  }));
  const tracks: GroupValue[] = meta.tracks.map((track) => ({
    kind: "track" as const,
    slug: track.slug,
    trackId: track._id,
    value: trackValue(track.slug),
  }));
  return [...generals, ...tracks];
}

function parseGrupo(raw: string | null, meta: Meta): GroupValue | null {
  const options = groupOptions(meta);
  if (!meta.isAdmin) {
    return options[0] ?? null;
  }
  const requested = options.find((option) => {
    if (option.value === raw) {
      return true;
    }
    if (option.kind === "track" && option.slug === raw) {
      return true;
    }
    if (option.kind === "general" && raw === String(option.group)) {
      return true;
    }
    return false;
  });
  return requested ?? options[0] ?? null;
}

function parseVista(raw: string | null): ViewMode {
  return raw === "clasificacion" ? "clasificacion" : "puntuar";
}

function contextFromGroup(group: GroupValue): JudgingContext {
  if (group.kind === "general") {
    return { kind: "general", group: group.group };
  }
  return { kind: "track", trackId: group.trackId };
}

function formatAverage(value: number | null) {
  if (value === null) {
    return "—";
  }
  return value.toFixed(1);
}

function notesLabel(count: number | null) {
  if (count === null) {
    return null;
  }
  return count === 1 ? "1 nota" : `${count} notas`;
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

function useKeptQuery<T>(value: T | undefined, resetKey: string) {
  const [kept, setKept] = useState(value);
  const [key, setKey] = useState(resetKey);
  if (resetKey !== key) {
    setKey(resetKey);
    setKept(value);
  } else if (value !== undefined && value !== kept) {
    setKept(value);
  }
  return {
    data: resetKey === key ? (value ?? kept) : value,
    refreshing: value === undefined && kept !== undefined && resetKey === key,
  };
}

function writeParams(
  pathname: string,
  mutate: (params: URLSearchParams) => void,
  mode: "push" | "replace",
) {
  const next = new URLSearchParams(window.location.search);
  mutate(next);
  const query = next.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  if (mode === "push") {
    window.history.pushState(null, "", url);
    return;
  }
  window.history.replaceState(null, "", url);
}

function contextHint(
  kind: "general" | "track",
  view: ViewMode,
  isAdmin: boolean,
) {
  if (kind === "general") {
    return view === "puntuar"
      ? "Puntúas todos los enviados de este grupo, de cualquier reto. La clasificación junta las notas generales."
      : isAdmin
        ? "Media de todas las notas generales, de cualquier grupo."
        : "Tus notas en este grupo. La media y el puesto los ve el admin.";
  }
  return view === "puntuar"
    ? "Puntúas todos los enviados a este reto. Estas notas no cuentan en la clasificación general."
    : isAdmin
      ? "Solo notas de este reto. Independiente de la clasificación general."
      : "Tus notas en este reto. La media la ve el admin.";
}

function staffLabel(person: { email?: string; name?: string }) {
  return person.name?.trim() || person.email || "Sin nombre";
}

function emptyQueueTitle(kind: "general" | "track", view: ViewMode): string {
  if (view === "clasificacion" && kind === "general") {
    return "Nada enviado";
  }
  return kind === "general" ? "Nada en este grupo" : "Nada en este reto";
}

function findNextPending(
  rows: QueueItem[] | undefined,
  currentId: Id<"submissions"> | null,
): Id<"submissions"> | undefined {
  if (!rows || !currentId) {
    return undefined;
  }
  const index = rows.findIndex((row) => row._id === currentId);
  if (index === -1) {
    return undefined;
  }
  return rows.slice(index + 1).find((row) => row.myScore === null)?._id;
}

export default function JudgingPage() {
  return (
    <Suspense fallback={<JudgingFallback />}>
      <JudgingPanel />
    </Suspense>
  );
}

function JudgingFallback() {
  return (
    <Page title="Juzgar" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-72" />
      </div>
      <Skeleton className="h-2 w-full" />
      <JudgingListSkeleton ranking />
    </Page>
  );
}

function JudgingPanel() {
  const me = useQuery(api.users.me);
  const allowed = me?.canJudge === true;
  const meta = useQuery(api.judging.meta, allowed ? {} : "skip");
  const ensureGroups = useMutation(api.judging.ensureGeneralGroups);
  const ensureAssignments = useMutation(api.judging.ensureAssignmentShape);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawGrupo = searchParams.get(GROUP_PARAM);
  const view = parseVista(searchParams.get(VIEW_PARAM));
  const projectId = searchParams.get(PROJECT_PARAM) as Id<"submissions"> | null;

  const selectedGroup = meta ? parseGrupo(rawGrupo, meta) : null;
  const context = selectedGroup ? contextFromGroup(selectedGroup) : null;
  const queue = useQuery(
    api.judging.list,
    context && view === "puntuar" ? { context } : "skip",
  );
  const ranking = useQuery(
    api.judging.ranking,
    context && view === "clasificacion" ? { context } : "skip",
  );

  useEffect(() => {
    if (!meta?.submittedMissingGroup) {
      return;
    }
    void ensureGroups({});
  }, [ensureGroups, meta?.submittedMissingGroup]);

  useEffect(() => {
    if (!allowed) {
      return;
    }
    void ensureAssignments({});
  }, [allowed, ensureAssignments]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }
    const vistaOk =
      searchParams.get(VIEW_PARAM) === view ||
      (view === "puntuar" && searchParams.get(VIEW_PARAM) === null);
    if (rawGrupo === selectedGroup.value && vistaOk) {
      return;
    }
    writeParams(
      pathname,
      (params) => {
        params.set(GROUP_PARAM, selectedGroup.value);
        if (view === "clasificacion") {
          params.set(VIEW_PARAM, view);
        } else {
          params.delete(VIEW_PARAM);
        }
      },
      "replace",
    );
  }, [pathname, rawGrupo, searchParams, selectedGroup, view]);

  const keepKey = selectedGroup?.value ?? "";
  const { data: queueRows, refreshing: queueRefreshing } = useKeptQuery(
    queue,
    keepKey,
  );
  const { data: rankingRows, refreshing: rankingRefreshing } = useKeptQuery(
    ranking,
    keepKey,
  );

  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const selected = useMemo((): SheetItem | null => {
    if (view === "puntuar") {
      const row = queueRows?.find((item) => item._id === projectId);
      return row ? { ...row, canScore: true } : null;
    }
    return rankingRows?.find((item) => item._id === projectId) ?? null;
  }, [projectId, queueRows, rankingRows, view]);

  if (me === undefined) {
    return <JudgingFallback />;
  }
  if (!allowed) {
    return (
      <Page title="Juzgar">
        <EmptyState title="Solo para jueces">
          Esta página es para el jurado. Si deberías juzgar, pide a un admin que
          te asigne el rol.
        </EmptyState>
      </Page>
    );
  }
  if (!meta) {
    return <JudgingFallback />;
  }

  const options = groupOptions(meta);
  if (options.length === 0) {
    return (
      <Page
        title="Juzgar"
        description="Los grupos generales no son retos: son colas de jueces. Los equipos no eligen grupo."
      >
        <EmptyState title="No tienes grupo asignado">
          Un admin tiene que asignarte un grupo general o un reto.
        </EmptyState>
      </Page>
    );
  }
  if (!selectedGroup) {
    return <JudgingFallback />;
  }
  const rows = view === "puntuar" ? queueRows : rankingRows;
  const refreshing = view === "puntuar" ? queueRefreshing : rankingRefreshing;
  const loading = view === "puntuar" ? queue === undefined && queueRows === undefined : ranking === undefined && rankingRows === undefined;

  const setGrupo = (value: string) => {
    writeParams(
      pathname,
      (params) => {
        params.set(GROUP_PARAM, value);
        params.delete(PROJECT_PARAM);
        if (view === "clasificacion") {
          params.set(VIEW_PARAM, view);
        } else {
          params.delete(VIEW_PARAM);
        }
      },
      "replace",
    );
  };

  const setVista = (next: ViewMode) => {
    writeParams(
      pathname,
      (params) => {
        params.set(GROUP_PARAM, selectedGroup.value);
        params.delete(PROJECT_PARAM);
        if (next === "clasificacion") {
          params.set(VIEW_PARAM, next);
        } else {
          params.delete(VIEW_PARAM);
        }
      },
      "replace",
    );
  };

  const openProject = (id: Id<"submissions">, from: HTMLElement | null) => {
    triggerRef.current = from;
    const alreadyOpen = new URLSearchParams(window.location.search).has(
      PROJECT_PARAM,
    );
    writeParams(
      pathname,
      (params) => {
        params.set(GROUP_PARAM, selectedGroup.value);
        params.set(PROJECT_PARAM, id);
        if (view === "clasificacion") {
          params.set(VIEW_PARAM, view);
        } else {
          params.delete(VIEW_PARAM);
        }
      },
      alreadyOpen ? "replace" : "push",
    );
    if (!alreadyOpen) {
      pushed.current = true;
    }
  };

  const closeProject = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    writeParams(
      pathname,
      (params) => {
        params.delete(PROJECT_PARAM);
      },
      "replace",
    );
  };

  const groupLabel =
    selectedGroup.kind === "general"
      ? `General ${selectedGroup.group}`
      : (meta.tracks.find((track) => track._id === selectedGroup.trackId)
          ?.label ?? selectedGroup.slug);
  const showGrupoSelect = meta.isAdmin;

  const scoredCount =
    view === "puntuar"
      ? (queueRows?.filter((row) => row.myScore !== null).length ?? 0)
      : 0;
  const totalCount = view === "puntuar" ? (queueRows?.length ?? 0) : 0;
  const queueIds = (view === "puntuar" ? queueRows : rankingRows)?.map(
    (row) => row._id,
  );
  const pendingAfter =
    view === "puntuar" ? findNextPending(queueRows, projectId) : undefined;

  return (
    <Page
      title={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-bungee text-2xl leading-tight text-balance sm:text-3xl">
              Juzgar
            </h1>
            <p className="mt-1 text-sm font-medium text-pretty text-hs-brown">
              {groupLabel}
              {" · "}
              {contextHint(selectedGroup.kind, view, meta.isAdmin)}
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[16rem] sm:max-w-80">
            <ViewToggle value={view} onChange={setVista} />
          </div>
        </div>
      }
      className="space-y-4"
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {showGrupoSelect ? (
          <div className="min-w-[12rem] flex-1 basis-56 sm:max-w-64 sm:flex-none">
            <Field label="Grupo" htmlFor="judging-group">
              <Select value={selectedGroup.value} onValueChange={setGrupo}>
                <SelectTrigger id="judging-group" aria-label="Grupo de juzgado">
                  <SelectValue>{groupLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.kind === "general"
                        ? `General ${option.group}`
                        : (meta.tracks.find(
                            (track) => track._id === option.trackId,
                          )?.label ?? option.slug)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        {view === "puntuar" && !loading && totalCount > 0 ? (
          <ScoreProgress scored={scoredCount} total={totalCount} />
        ) : null}
      </div>

      {loading ? (
        <JudgingListSkeleton ranking={view === "clasificacion"} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title={emptyQueueTitle(selectedGroup.kind, view)}>
          {selectedGroup.kind === "general"
            ? "Los equipos no eligen grupo: el proyecto entra aquí al enviarse."
            : "Aún no hay proyectos enviados a este reto."}
        </EmptyState>
      ) : (
        <div
          className={cn(
            refreshing &&
              "opacity-60 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-[var(--ease-out)]",
          )}
        >
          {view === "clasificacion" ? (
            <RankingLists
              rows={rankingRows ?? []}
              projectId={projectId}
              showAverages={meta.isAdmin}
              onOpen={openProject}
            />
          ) : (
            <QueueLists
              rows={queueRows ?? []}
              projectId={projectId}
              showAverages={meta.isAdmin}
              onOpen={openProject}
            />
          )}
        </div>
      )}

      {meta.isAdmin && context ? (
        <AdminSection
          count={meta.generalGroupCount}
          context={context}
          contextLabel={groupLabel}
        />
      ) : null}

      <ProjectSheet
        context={context}
        selected={projectId ? (selected ?? undefined) : null}
        fallbackName={selected?.name}
        queueIds={queueIds}
        nextPendingId={pendingAfter}
        onClose={closeProject}
        onOpen={openProject}
        returnFocusRef={triggerRef}
      />
    </Page>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Vista de juzgado"
      className="box-border grid h-11 grid-cols-2 border-[3px] border-hs-ink [&>:first-child]:border-r-[3px] [&>:first-child]:border-hs-ink"
    >
      <ViewTab
        id="vista-puntuar"
        selected={value === "puntuar"}
        onSelect={() => onChange("puntuar")}
      >
        Por puntuar
      </ViewTab>
      <ViewTab
        id="vista-clasificacion"
        selected={value === "clasificacion"}
        onSelect={() => onChange("clasificacion")}
      >
        Clasificación
      </ViewTab>
    </div>
  );
}

function ScoreProgress({ scored, total }: { scored: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((scored / total) * 100);
  return (
    <div className="min-w-[12rem] flex-1 basis-56 sm:max-w-sm">
      <p className="font-bungee text-xs uppercase text-hs-brown">
        <span className="tabular-nums text-hs-ink">{scored}</span>
        {" / "}
        <span className="tabular-nums">{total}</span>
        {" puntuados"}
      </p>
      <div
        className="mt-2 h-4 border-[3px] border-hs-ink bg-hs-sand"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={scored}
        aria-label="Proyectos puntuados"
      >
        <div
          className="h-full bg-hs-gold motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-[var(--ease-out)]"
          style={{
            minWidth: scored > 0 ? 8 : 0,
            width: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
}

function ViewTab({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      className={cn(
        "h-full px-3 font-bungee text-xs uppercase outline-none focus-visible:border-[3px] focus-visible:border-hs-navy",
        selected
          ? "bg-hs-gold text-hs-ink"
          : "bg-hs-paper text-hs-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand",
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function AdminSection({
  count,
  context,
  contextLabel,
}: {
  count: number;
  context: JudgingContext;
  contextLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jueces y grupos</CardTitle>
        <CardDescription>
          Cada proyecto entra al enviar en el grupo general con menos equipos y
          no se mueve. Bajar el número no reasigna los ya enviados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-40">
          <AdminGroupCount count={count} />
        </div>
        <AdminGroupRoster context={context} label={contextLabel} />
      </CardContent>
    </Card>
  );
}

function AdminGroupRoster({
  context,
  label,
}: {
  context: JudgingContext;
  label: string;
}) {
  const roster = useQuery(api.judging.groupRoster, { context });
  const addJudge = useMutation(api.judging.addJudgeToGroup);
  const removeJudge = useMutation(api.judging.removeJudgeFromGroup);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<Id<"users"> | "add" | null>(null);
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="space-y-2">
      <p className="font-bungee text-xs uppercase text-hs-brown">
        Jueces de {label}
      </p>
      {roster === undefined ? (
        <Skeleton className="h-11 w-full max-w-xl" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {roster.assigned.length === 0 ? (
            <p className="text-sm font-medium text-hs-brown">Nadie asignado.</p>
          ) : (
            roster.assigned.map((person) => (
              <span
                key={person._id}
                className="inline-flex min-h-11 items-center gap-2 border-[3px] border-hs-ink bg-hs-paper px-3"
              >
                <span className="text-sm font-medium">
                  {staffLabel(person)}
                </span>
                <button
                  type="button"
                  disabled={pendingId !== null}
                  className="text-sm font-medium underline underline-offset-2 outline-none focus-visible:border-[3px] focus-visible:border-hs-navy disabled:opacity-50"
                  onClick={() => {
                    setSaveError(null);
                    setPendingId(person._id);
                    void removeJudge({ context, userId: person._id })
                      .catch((error: unknown) =>
                        setSaveError(
                          errorMessage(
                            error,
                            "No se ha podido quitar al juez",
                          ),
                        ),
                      )
                      .finally(() => setPendingId(null));
                  }}
                >
                  Quitar
                </button>
              </span>
            ))
          )}
          {roster.available.length > 0 ? (
            <Select
              key={addKey}
              disabled={pendingId !== null}
              onValueChange={(userId) => {
                setSaveError(null);
                setPendingId("add");
                void addJudge({
                  context,
                  userId: userId as Id<"users">,
                })
                  .then(() => setAddKey((value) => value + 1))
                  .catch((error: unknown) =>
                    setSaveError(
                      errorMessage(error, "No se ha podido añadir al juez"),
                    ),
                  )
                  .finally(() => setPendingId(null));
              }}
            >
              <SelectTrigger
                className="w-56"
                aria-label="Añadir juez a este grupo"
              >
                <SelectValue placeholder="Añadir juez" />
              </SelectTrigger>
              <SelectContent>
                {roster.available.map((person) => (
                  <SelectItem key={person._id} value={person._id}>
                    {staffLabel(person)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      )}
      <FormError message={saveError} />
    </div>
  );
}

function AdminGroupCount({ count }: { count: number }) {
  const setCount = useMutation(api.judging.setGeneralGroupCount);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <Field label="Grupos generales" htmlFor="judging-group-count">
        <Select
          value={String(count)}
          disabled={pending}
          onValueChange={(value) => {
            setSaveError(null);
            setPending(true);
            void setCount({ generalGroupCount: Number(value) })
              .catch((error: unknown) =>
                setSaveError(
                  errorMessage(error, "No se ha podido guardar el número de grupos"),
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <SelectTrigger
            id="judging-group-count"
            aria-label="Número de grupos generales"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <FormError message={saveError} />
    </div>
  );
}

function JudgingListSkeleton({ ranking }: { ranking?: boolean }) {
  return (
    <>
      <div className="grid gap-3 md:hidden" aria-hidden>
        {["a", "b", "c"].map((key) => (
          <div key={key} className="border-[3px] border-hs-ink bg-hs-paper p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
      <div
        className="hidden border-[3px] border-hs-ink md:block"
        aria-hidden
      >
        <div className="h-11 border-b-[3px] border-hs-ink bg-hs-sand" />
        {["a", "b", "c"].map((key) => (
          <div
            key={key}
            className="flex h-11 items-center gap-3 border-b border-hs-ink/20 px-3"
          >
            {ranking ? <Skeleton className="h-3 w-6" /> : null}
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </>
  );
}

function QueueLists({
  rows,
  projectId,
  showAverages,
  onOpen,
}: {
  rows: QueueItem[];
  projectId: Id<"submissions"> | null;
  showAverages: boolean;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  const pending = rows.filter((row) => row.myScore === null);
  const scored = rows.filter((row) => row.myScore !== null);
  return (
    <div role="tabpanel" aria-labelledby="vista-puntuar">
      <div className="grid gap-3 md:hidden">
        {pending.map((row) => (
          <ProjectCard
            key={row._id}
            name={row.name}
            teamName={row.teamName}
            average={row.average}
            scoreCount={row.scoreCount}
            challenges={row.challenges}
            myScore={row.myScore}
            selected={row._id === projectId}
            showAverages={showAverages}
            onOpen={(from) => onOpen(row._id, from)}
          />
        ))}
        {scored.length > 0 && pending.length > 0 ? (
          <p className="pt-1 font-bungee text-xs uppercase text-hs-brown">
            Puntuados
          </p>
        ) : null}
        {scored.map((row) => (
          <ProjectCard
            key={row._id}
            name={row.name}
            teamName={row.teamName}
            average={row.average}
            scoreCount={row.scoreCount}
            challenges={row.challenges}
            myScore={row.myScore}
            selected={row._id === projectId}
            showAverages={showAverages}
            onOpen={(from) => onOpen(row._id, from)}
          />
        ))}
      </div>
      <div className="hidden md:block">
        <ProjectTable
          pending={pending}
          scored={scored}
          projectId={projectId}
          showAverages={showAverages}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function RankingLists({
  rows,
  projectId,
  showAverages,
  onOpen,
}: {
  rows: RankingItem[];
  projectId: Id<"submissions"> | null;
  showAverages: boolean;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  const scored = rows.filter((row) =>
    showAverages ? row.rank !== null : row.myScore !== null,
  );
  const unscored = rows.filter((row) =>
    showAverages ? row.rank === null : row.myScore === null,
  );
  return (
    <div role="tabpanel" aria-labelledby="vista-clasificacion">
      <div className="grid content-start gap-3 md:hidden">
        {scored.map((row) => (
          <ProjectCard
            key={row._id}
            name={row.name}
            teamName={row.teamName}
            average={row.average}
            scoreCount={row.scoreCount}
            challenges={row.challenges}
            myScore={row.canScore ? row.myScore : null}
            selected={row._id === projectId}
            rank={showAverages ? row.rank : undefined}
            outside={!row.canScore}
            showAverages={showAverages}
            onOpen={(from) => onOpen(row._id, from)}
          />
        ))}
        {unscored.length > 0 ? (
          <>
            <p className="pt-1 font-bungee text-xs uppercase text-hs-brown">
              {showAverages ? "Sin notas" : "Pendiente"}
            </p>
            {unscored.map((row) => (
              <ProjectCard
                key={row._id}
                name={row.name}
                teamName={row.teamName}
                average={row.average}
                scoreCount={row.scoreCount}
                challenges={row.challenges}
                myScore={row.canScore ? row.myScore : null}
                selected={row._id === projectId}
                rank={showAverages ? null : undefined}
                outside={!row.canScore}
                showAverages={showAverages}
                onOpen={(from) => onOpen(row._id, from)}
              />
            ))}
          </>
        ) : null}
      </div>
      <div className="hidden md:block">
        <RankingTable
          scored={scored}
          unscored={unscored}
          projectId={projectId}
          showAverages={showAverages}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  name,
  teamName,
  average,
  scoreCount,
  challenges,
  myScore,
  selected,
  rank,
  outside,
  showAverages,
  onOpen,
}: {
  name: string;
  teamName?: string;
  average: number | null;
  scoreCount: number | null;
  challenges: QueueItem["challenges"];
  myScore: number | null;
  selected: boolean;
  rank?: number | null;
  outside?: boolean;
  showAverages: boolean;
  onOpen: (from: HTMLElement) => void;
}) {
  const notes = notesLabel(scoreCount);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${rank !== undefined && rank !== null ? `Puesto ${rank}, ` : ""}${name}, ${teamName ?? "sin equipo"}`}
      aria-haspopup="dialog"
      aria-expanded={selected}
      onClick={(event) => onOpen(event.currentTarget)}
      onKeyDown={(event) =>
        activateOnKey(event, () => onOpen(event.currentTarget))
      }
      className="block cursor-pointer outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:[&>[data-slot=card]]:bg-hs-sand/60 focus-visible:[&>[data-slot=card]]:border-hs-navy aria-expanded:[&>[data-slot=card]]:bg-hs-sand"
    >
      <RecordCard
        title={name || "Sin título"}
        subtitle={teamName ?? "Sin equipo"}
        badges={
          <>
            {rank !== undefined ? <RankMark rank={rank} /> : null}
            {outside ? <Badge>Otro grupo</Badge> : null}
            <Badge
              variant={myScore !== null ? "gold" : "default"}
              className="tabular-nums"
            >
              {myScore !== null ? (
                <span className="inline-block min-w-[2ch] text-center">
                  {myScore}
                </span>
              ) : showAverages ? (
                formatAverage(average)
              ) : (
                "Puntuar"
              )}
            </Badge>
          </>
        }
      >
        <p className="text-sm font-medium text-hs-brown">
          {challenges.map((challenge) => challenge.label).join(" · ") ||
            "Sin retos"}
          {showAverages && notes ? (
            <>
              {" · "}
              <span className="inline-block min-w-[5ch] tabular-nums">
                {notes}
              </span>
            </>
          ) : null}
        </p>
      </RecordCard>
    </div>
  );
}

function ProjectTable({
  pending,
  scored,
  projectId,
  showAverages,
  onOpen,
}: {
  pending: QueueItem[];
  scored: QueueItem[];
  projectId: Id<"submissions"> | null;
  showAverages: boolean;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  const scoreCols = showAverages ? 2 : 0;
  const renderRow = (row: QueueItem) => (
    <ProjectTableRow
      key={row._id}
      name={row.name}
      teamName={row.teamName}
      challenges={row.challenges}
      average={row.average}
      scoreCount={row.scoreCount}
      myScore={row.myScore}
      showAverages={showAverages}
      status={<ScoreMark score={row.myScore} />}
      selected={row._id === projectId}
      onOpen={(from) => onOpen(row._id, from)}
    />
  );
  return (
    <Table
      className="border-separate border-spacing-0 font-medium"
      containerClassName="max-h-[min(40rem,calc(100dvh-18rem))] overflow-auto overscroll-contain"
    >
      <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
        <TableRow>
          <TableHead>Proyecto</TableHead>
          <TableHead>Equipo</TableHead>
          <TableHead>Retos</TableHead>
          {showAverages ? (
            <>
              <TableHead className="text-right">Media</TableHead>
              <TableHead className="text-right">Notas</TableHead>
            </>
          ) : null}
          <TableHead className="text-right">Nota</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pending.map(renderRow)}
        {scored.length > 0 && pending.length > 0 ? (
          <TableRow>
            <TableCell
              colSpan={4 + scoreCols}
              className="bg-hs-sand font-bungee text-xs uppercase"
            >
              Puntuados
            </TableCell>
          </TableRow>
        ) : null}
        {scored.map(renderRow)}
      </TableBody>
    </Table>
  );
}

function RankingTable({
  scored,
  unscored,
  projectId,
  showAverages,
  onOpen,
}: {
  scored: RankingItem[];
  unscored: RankingItem[];
  projectId: Id<"submissions"> | null;
  showAverages: boolean;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  const scoreCols = showAverages ? 2 : 0;
  const renderRow = (row: RankingItem, rank = row.rank) => (
    <ProjectTableRow
      key={row._id}
      rank={showAverages ? rank : undefined}
      name={row.name}
      teamName={row.teamName}
      challenges={row.challenges}
      average={row.average}
      scoreCount={row.scoreCount}
      myScore={row.canScore ? row.myScore : null}
      showAverages={showAverages}
      status={<RankingStatus row={row} />}
      selected={row._id === projectId}
      onOpen={(from) => onOpen(row._id, from)}
    />
  );
  return (
    <Table
      className="border-separate border-spacing-0 font-medium"
      containerClassName="max-h-[min(40rem,calc(100dvh-18rem))] overflow-auto overscroll-contain"
    >
      <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
        <TableRow>
          {showAverages ? (
            <TableHead className="w-14 text-right">#</TableHead>
          ) : null}
          <TableHead>Proyecto</TableHead>
          <TableHead>Equipo</TableHead>
          <TableHead>Retos</TableHead>
          {showAverages ? (
            <>
              <TableHead className="text-right">Media</TableHead>
              <TableHead className="text-right">Notas</TableHead>
            </>
          ) : null}
          <TableHead className="text-right">Nota</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scored.map((row) => renderRow(row))}
        {unscored.length > 0 ? (
          <>
            <TableRow>
              <TableCell
                colSpan={4 + scoreCols + (showAverages ? 1 : 0)}
                className="bg-hs-sand font-bungee text-xs uppercase"
              >
                {showAverages ? "Sin notas" : "Pendiente"}
              </TableCell>
            </TableRow>
            {unscored.map((row) => renderRow(row, null))}
          </>
        ) : null}
      </TableBody>
    </Table>
  );
}

function RankingStatus({ row }: { row: RankingItem }) {
  if (!row.canScore) {
    return <span className="font-medium text-hs-brown">Otro grupo</span>;
  }
  return <ScoreMark score={row.myScore} />;
}

function ScoreMark({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="font-medium text-hs-brown">Pendiente</span>;
  }
  return (
    <span className="inline-block min-w-[2ch] font-bungee text-sm tabular-nums">
      {score}
    </span>
  );
}

function ProjectTableRow({
  rank,
  name,
  teamName,
  challenges,
  average,
  scoreCount,
  myScore,
  showAverages,
  status,
  selected,
  onOpen,
}: {
  rank?: number | null;
  name: string;
  teamName?: string;
  challenges: QueueItem["challenges"];
  average: number | null;
  scoreCount: number | null;
  myScore: number | null;
  showAverages: boolean;
  status: ReactNode;
  selected: boolean;
  onOpen: (from: HTMLElement | null) => void;
}) {
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      onClick={(event) => {
        onOpen(
          event.currentTarget.querySelector<HTMLElement>("[data-row-trigger]"),
        );
      }}
      className={cn(
        "h-11 cursor-pointer motion-safe:transition-colors motion-safe:duration-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 [&_td]:border-b [&_td]:border-hs-ink/20",
        selected && "bg-hs-sand",
        myScore !== null && !selected && "text-hs-brown",
      )}
    >
      {rank !== undefined ? (
        <TableCell className="text-right">
          <RankMark rank={rank} />
        </TableCell>
      ) : null}
      <TableCell>
        <button
          type="button"
          data-row-trigger
          aria-haspopup="dialog"
          aria-expanded={selected}
          className="-mx-1 min-w-0 truncate px-1 text-left underline-offset-2 outline-none focus-visible:border-[3px] focus-visible:border-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
        >
          {name || "Sin título"}
        </button>
      </TableCell>
      <TableCell className="max-w-48 truncate">{teamName ?? "—"}</TableCell>
      <TableCell className="max-w-72 truncate">
        {challenges.map((challenge) => challenge.label).join(" · ") || "—"}
      </TableCell>
      {showAverages ? (
        <>
          <TableCell className="text-right tabular-nums">
            <span className="inline-block min-w-[3.5ch]">
              {formatAverage(average)}
            </span>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <span className="inline-block min-w-[2ch]">{scoreCount ?? "—"}</span>
          </TableCell>
        </>
      ) : null}
      <TableCell className="text-right">{status}</TableCell>
    </TableRow>
  );
}

function RankMark({ rank }: { rank: number | null }) {
  if (rank === null) {
    return (
      <span className="inline-block min-w-[2.5ch] text-right tabular-nums text-hs-brown">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex min-h-7 min-w-[2.5ch] items-center justify-end px-1 font-bungee text-sm tabular-nums",
        rank === 1 && "bg-hs-gold text-hs-ink",
      )}
    >
      {rank}
    </span>
  );
}

function ProjectSheet({
  context,
  selected,
  fallbackName,
  queueIds,
  nextPendingId,
  onClose,
  onOpen,
  returnFocusRef,
}: {
  context: JudgingContext | null;
  selected: SheetItem | null | undefined;
  fallbackName?: string;
  queueIds?: Id<"submissions">[];
  nextPendingId?: Id<"submissions">;
  onClose: () => void;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState<SheetItem | null>(selected ?? null);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const setScore = useMutation(api.judging.setScore);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const item = selected ?? shown;
  const open = selected !== null && selected !== undefined;
  const canScore = item?.canScore === true && context !== null;
  const index = item && queueIds ? queueIds.indexOf(item._id) : -1;
  const prevId = index > 0 ? queueIds?.[index - 1] : undefined;
  const nextId =
    index >= 0 && queueIds && index < queueIds.length - 1
      ? queueIds[index + 1]
      : undefined;

  const go = (id: Id<"submissions"> | undefined) => {
    if (id) {
      onOpen(id, null);
    }
  };

  return (
    <Sheet
      open={open && item !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent
        className="sm:max-w-3xl lg:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            target.focus();
          }
          returnFocusRef.current = null;
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented) {
            return;
          }
          if (
            event.target instanceof HTMLElement &&
            event.target.closest('[role="radiogroup"]')
          ) {
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(prevId);
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(nextId);
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>{item?.name || fallbackName || "Proyecto"}</SheetTitle>
          <SheetDescription className="font-medium">
            {item?.teamName ?? "Sin equipo"}
            {index >= 0 && queueIds && queueIds.length > 0 ? (
              <span className="mt-1 block font-bungee text-xs uppercase text-hs-brown">
                <span className="tabular-nums">{index + 1}</span>
                {" / "}
                <span className="tabular-nums">{queueIds.length}</span>
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {item === null ? (
            <EmptyState title="Proyecto no encontrado">
              No está en este grupo o aún no se ha enviado.
            </EmptyState>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <VideoFrame url={urlOf(item.urls, "video")} />
              <ProjectDetails item={item} />
            </div>
          )}
        </SheetBody>
        {item ? (
          <SheetFooter className="flex-col gap-4 sm:flex-col sm:items-stretch">
            <FormError message={saveError} />
            {queueIds && queueIds.length > 1 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!prevId}
                  onClick={() => go(prevId)}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!nextId}
                  onClick={() => go(nextId)}
                >
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : null}
            {canScore && context ? (
              <ScoreSlider
                value={item.myScore}
                disabled={saving}
                onCommit={(score) => {
                  const advanceTo =
                    item.myScore === null ? nextPendingId : undefined;
                  setSaveError(null);
                  setSaving(true);
                  void setScore({
                    context,
                    score,
                    submissionId: item._id,
                  })
                    .then(() => {
                      if (advanceTo) {
                        onOpen(advanceTo, null);
                      }
                    })
                    .catch((error: unknown) =>
                      setSaveError(
                        errorMessage(error, "No se ha podido guardar la nota"),
                      ),
                    )
                    .finally(() => setSaving(false));
                }}
              />
            ) : (
              <p className="text-sm font-medium text-pretty text-hs-brown">
                Este proyecto no está en tu grupo. Puedes verlo; no puntuarlo.
              </p>
            )}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProjectDetails({ item }: { item: SheetItem }) {
  const links = DETAIL_URL_ORDER.flatMap((kind) => {
    const entry = item.urls.find((url) => url.kind === kind);
    return entry ? [entry] : [];
  });
  const leftover = item.urls.filter(
    (entry) => !DETAIL_URL_ORDER.includes(entry.kind),
  );
  const urlRows = [...links, ...leftover];
  const hasMeta =
    Boolean(item.teamName) ||
    item.members.length > 0 ||
    item.generalGroup !== undefined ||
    item.perks.length > 0 ||
    item.techStack.length > 0 ||
    urlRows.length > 0;
  return (
    <div className="space-y-4">
      {item.challenges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.challenges.map((challenge) => (
            <TrackTag key={challenge._id} track={challenge} />
          ))}
        </div>
      ) : null}
      {item.description.trim() ? (
        <p className="text-sm font-medium text-pretty whitespace-pre-wrap">
          {item.description}
        </p>
      ) : null}
      {hasMeta ? (
        <div className="grid gap-3">
          {item.teamName ? (
            <MetaRow label="Equipo">{item.teamName}</MetaRow>
          ) : null}
          {item.members.length > 0 ? (
            <MetaRow label="Miembros">{item.members.join(" · ")}</MetaRow>
          ) : null}
          {item.generalGroup !== undefined ? (
            <MetaRow label="Grupo general">
              General {item.generalGroup}
            </MetaRow>
          ) : null}
          {item.perks.length > 0 ? (
            <MetaRow label="Partners">
              {item.perks
                .map((perk) => perkName(perk.company, perk.title))
                .join(" · ")}
            </MetaRow>
          ) : null}
          {item.techStack.length > 0 ? (
            <MetaRow label="Stack">
              <span className="flex flex-wrap gap-2">
                {item.techStack.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </span>
            </MetaRow>
          ) : null}
          {urlRows.map((entry) => (
            <UrlRow key={entry.kind} entry={entry} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UrlRow({ entry }: { entry: UrlEntry }) {
  return (
    <MetaRow label={urlLabel(entry.kind)}>
      <MetaLink href={entry.url}>{urlDisplay(entry.kind, entry.url)}</MetaLink>
    </MetaRow>
  );
}
