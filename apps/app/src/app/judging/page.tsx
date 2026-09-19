"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PROJECTS_PER_JUDGE } from "@convex/lib/judging";
import type { PartialScores } from "@convex/lib/judging";
import {
  AssessmentForm,
  formatScore,
} from "@/components/judging/assessment-form";
import type { AssessmentDraft } from "@/components/judging/assessment-form";
import { ProjectDetails } from "@/components/judging/project-details";
import { VideoFrame } from "@/components/judging/video-frame";
import { EmptyState, Page, RecordCard, Skeleton } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
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
import { urlOf } from "@/lib/urls";
import { cn } from "@/lib/utils";

const PROJECT_PARAM = "proyecto";

type Queue = FunctionReturnType<typeof api.judging.myQueue>;
type QueueItem = Queue["items"][number];

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

function StatusBadge({ item }: { item: QueueItem }) {
  if (item.assessment?.status === "submitted") {
    return <Badge variant="gold">Enviada</Badge>;
  }
  if (item.assessment) {
    return <Badge>Borrador</Badge>;
  }
  return <span className="font-medium text-hs-brown">Pendiente</span>;
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
      <Skeleton className="h-11 w-56" />
      <QueueSkeleton />
    </Page>
  );
}

function JudgingPanel() {
  const me = useQuery(api.users.me);
  const allowed = me?.canJudge === true;
  const queue = useQuery(api.judging.myQueue, allowed ? {} : "skip");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get(PROJECT_PARAM) as Id<"submissions"> | null;
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

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
  if (!queue) {
    return <JudgingFallback />;
  }

  const openProject = (id: Id<"submissions">, from: HTMLElement | null) => {
    triggerRef.current = from;
    const alreadyOpen = new URLSearchParams(window.location.search).has(
      PROJECT_PARAM,
    );
    writeParams(
      pathname,
      (params) => params.set(PROJECT_PARAM, id),
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
    writeParams(pathname, (params) => params.delete(PROJECT_PARAM), "replace");
  };

  const selected = queue.items.find((item) => item._id === projectId) ?? null;
  const total = queue.items.length || PROJECTS_PER_JUDGE;

  return (
    <Page
      title="Juzgar"
      description="Revisa cada proyecto con sus enlaces y la demo grabada. Puntúa cada criterio con 1, 2, 4 o 5. Los cuatro pesan igual."
      className="space-y-4"
    >
      {queue.items.length === 0 ? (
        me.role === "admin" ? (
          <EmptyState title="No tienes proyectos asignados">
            Las asignaciones y el seguimiento del jurado están en el panel de
            organización.
            <span className="mt-3 block">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/judging">Abrir organización</Link>
              </Button>
            </span>
          </EmptyState>
        ) : queue.hasRound ? (
          <EmptyState title="No tienes proyectos asignados">
            El reparto ya está hecho y no te incluye. Habla con la
            organización.
          </EmptyState>
        ) : (
          <EmptyState title="Aún no hay asignaciones">
            La organización repartirá los proyectos antes de empezar. Vuelve
            entonces.
          </EmptyState>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-bungee text-sm tabular-nums">
              {queue.submittedCount} de {total} enviadas
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={queue.submittedCount}
              aria-label="Evaluaciones enviadas"
              className="h-3 min-w-40 flex-1 overflow-hidden border-[3px] border-hs-ink bg-hs-paper sm:max-w-xs"
            >
              <div
                className="h-full w-full origin-left bg-hs-gold motion-safe:transition-transform motion-safe:duration-[var(--duration-enter)] motion-safe:ease-[var(--ease-out)]"
                style={{ transform: `scaleX(${queue.submittedCount / total})` }}
              />
            </div>
          </div>
          <p className="text-sm font-medium text-pretty text-hs-brown">
            Otro juez evalúa cada proyecto de forma independiente. Sus notas y
            la clasificación no se muestran hasta que termine el jurado.
          </p>
          <QueueLists
            rows={queue.items}
            projectId={projectId}
            onOpen={openProject}
          />
        </>
      )}

      <ProjectSheet
        selected={projectId ? selected : null}
        onClose={closeProject}
        returnFocusRef={triggerRef}
      />
    </Page>
  );
}

function QueueSkeleton() {
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
      <div className="hidden border-[3px] border-hs-ink md:block" aria-hidden>
        <div className="h-11 border-b-[3px] border-hs-ink bg-hs-sand" />
        {["a", "b", "c"].map((key) => (
          <div
            key={key}
            className="flex h-11 items-center gap-3 border-b border-hs-ink/20 px-3"
          >
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
  onOpen,
}: {
  rows: QueueItem[];
  projectId: Id<"submissions"> | null;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  return (
    <div>
      <div className="hs-stagger grid gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row._id}
            role="button"
            tabIndex={0}
            aria-label={`${row.name}, ${row.teamName ?? "sin equipo"}`}
            aria-haspopup="dialog"
            aria-expanded={row._id === projectId}
            onClick={(event) => onOpen(row._id, event.currentTarget)}
            onKeyDown={(event) =>
              activateOnKey(event, () => onOpen(row._id, event.currentTarget))
            }
            className="block cursor-pointer outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:[&>[data-slot=card]]:bg-hs-sand/60 focus-visible:[&>[data-slot=card]]:border-hs-navy aria-expanded:[&>[data-slot=card]]:bg-hs-sand"
          >
            <RecordCard
              title={row.name || "Sin título"}
              subtitle={row.teamName ?? "Sin equipo"}
              badges={
                <>
                  <StatusBadge item={row} />
                  <Badge className="tabular-nums">
                    <span className="inline-block min-w-[4ch] text-center">
                      {formatScore(row.assessment?.rawScore)}
                    </span>
                  </Badge>
                </>
              }
            >
              <p className="text-sm font-medium text-hs-brown">
                {row.challenges.map((challenge) => challenge.label).join(" · ") ||
                  "Sin retos"}
              </p>
            </RecordCard>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table
          className="border-separate border-spacing-0 font-medium"
          containerClassName="max-h-[min(40rem,calc(100dvh-18rem))] overflow-auto overscroll-contain"
        >
          <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Retos</TableHead>
              <TableHead className="text-right">Mi nota</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row._id}
                data-state={row._id === projectId ? "selected" : undefined}
                onClick={(event) =>
                  onOpen(
                    row._id,
                    event.currentTarget.querySelector<HTMLElement>(
                      "[data-row-trigger]",
                    ),
                  )
                }
                className="h-11 cursor-pointer motion-safe:transition-colors motion-safe:duration-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 [&_td]:border-b [&_td]:border-hs-ink/20"
              >
                <TableCell>
                  <button
                    type="button"
                    data-row-trigger
                    aria-haspopup="dialog"
                    aria-expanded={row._id === projectId}
                    className="-mx-1 min-w-0 truncate px-1 text-left underline-offset-2 outline-none focus-visible:border-[3px] focus-visible:border-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                  >
                    {row.name || "Sin título"}
                  </button>
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {row.teamName ?? "—"}
                </TableCell>
                <TableCell className="max-w-72 truncate">
                  {row.challenges.map((challenge) => challenge.label).join(" · ") ||
                    "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-block min-w-[4ch]">
                    {formatScore(row.assessment?.rawScore)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge item={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function snapshotOf(item: QueueItem) {
  if (!item.assessment) {
    return null;
  }
  const scores: PartialScores = {
    craftsmanship: item.assessment.craftsmanship,
    creativity: item.assessment.creativity,
    ownCriteria: item.assessment.ownCriteria,
    problemSolving: item.assessment.problemSolving,
  };
  return {
    ownCriteriaComment: item.assessment.ownCriteriaComment,
    scores,
    status: item.assessment.status,
  };
}

function ProjectSheet({
  selected,
  onClose,
  returnFocusRef,
}: {
  selected: QueueItem | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState<QueueItem | null>(selected);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const saveDraft = useMutation(api.judging.saveDraft);
  const submit = useMutation(api.judging.submit);
  const [saving, setSaving] = useState(false);
  const item = selected ?? shown;

  const wrap = (work: () => Promise<null>) => async () => {
    setSaving(true);
    try {
      await work();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={selected !== null}
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
      >
        <SheetHeader>
          <SheetTitle>{item?.name || "Proyecto"}</SheetTitle>
          <SheetDescription className="font-medium">
            {item?.teamName ?? "Sin equipo"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {item === null ? (
            <EmptyState title="Proyecto no encontrado">
              No está entre tus proyectos asignados.
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <VideoFrame url={urlOf(item.urls, "video")} />
                <ProjectDetails item={item} />
              </div>
              <div
                className={cn(
                  "border-t-[3px] border-hs-ink pt-5",
                  saving && "opacity-70",
                )}
              >
                <AssessmentForm
                  key={item._id}
                  initial={snapshotOf(item)}
                  saving={saving}
                  onSaveDraft={(draft: AssessmentDraft) =>
                    wrap(() =>
                      saveDraft({
                        ...draft.scores,
                        ownCriteriaComment: draft.ownCriteriaComment,
                        submissionId: item._id,
                      }),
                    )()
                  }
                  onSubmit={(draft: AssessmentDraft) =>
                    wrap(() => {
                      const { craftsmanship, creativity, ownCriteria, problemSolving } =
                        draft.scores;
                      if (
                        craftsmanship === undefined ||
                        creativity === undefined ||
                        ownCriteria === undefined ||
                        problemSolving === undefined
                      ) {
                        throw new Error("Faltan criterios por puntuar");
                      }
                      return submit({
                        craftsmanship,
                        creativity,
                        ownCriteria,
                        ownCriteriaComment: draft.ownCriteriaComment,
                        problemSolving,
                        submissionId: item._id,
                      });
                    })()
                  }
                />
              </div>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
