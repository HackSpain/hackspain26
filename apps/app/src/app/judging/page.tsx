"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { Suspense, useState } from "react";
import { api } from "@convex/_generated/api";
import type { PartialScores } from "@convex/lib/judging";
import {
  AssessmentForm,
  formatScore,
} from "@/components/judging/assessment-form";
import type { AssessmentDraft } from "@/components/judging/assessment-form";
import {
  ProjectSheet,
  ProjectTable,
  ProjectTableFallback,
  useProjectPicker,
} from "@/components/judging/project-table";
import { EmptyState, Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type QueueItem = FunctionReturnType<typeof api.judging.myQueue>["items"][number];

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
    <Suspense fallback={<ProjectTableFallback title="Juzgar" />}>
      <JudgingPanel />
    </Suspense>
  );
}

function JudgingPanel() {
  const me = useQuery(api.users.me);
  const allowed = me?.canJudge === true;
  const queue = useQuery(api.judging.myQueue, allowed ? {} : "skip");
  const { projectId, triggerRef, openProject, closeProject } = useProjectPicker();
  const [saving, setSaving] = useState(false);
  const saveDraft = useMutation(api.judging.saveDraft);
  const submit = useMutation(api.judging.submit);

  if (me === undefined) {
    return <ProjectTableFallback title="Juzgar" />;
  }
  if (!allowed) {
    return (
      <Page title="Juzgar">
        <EmptyState title="Solo para el jurado">
          Esta página es para puntuar. Si deberías juzgar, pide a un admin que
          te asigne el tipo Jurado.
        </EmptyState>
      </Page>
    );
  }
  if (!queue) {
    return <ProjectTableFallback title="Juzgar" />;
  }

  const selected = queue.items.find((item) => item._id === projectId) ?? null;
  const total = queue.items.length;

  const wrap = (work: () => Promise<null>) => async () => {
    setSaving(true);
    try {
      await work();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Juzgar"
      description="Revisa cada proyecto con sus enlaces y la demo grabada. Puntúa craftsmanship, problem solving, creativity y overall con 1, 2, 4 o 5. Los cuatro pesan igual. Creativity va calibrada al track."
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
          <ProjectTable
            rows={queue.items}
            projectId={projectId}
            onOpen={openProject}
            extraHead={
              <>
                <TableHead className="text-right">Mi nota</TableHead>
                <TableHead>Estado</TableHead>
              </>
            }
            extraCell={(row) => {
              const item = row as QueueItem;
              return (
                <>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-block min-w-[4ch]">
                      {formatScore(item.assessment?.rawScore)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge item={item} />
                  </TableCell>
                </>
              );
            }}
            badges={(row) => {
              const item = row as QueueItem;
              return (
                <>
                  <StatusBadge item={item} />
                  <Badge className="tabular-nums">
                    <span className="inline-block min-w-[4ch] text-center">
                      {formatScore(item.assessment?.rawScore)}
                    </span>
                  </Badge>
                </>
              );
            }}
          />
        </>
      )}

      <ProjectSheet
        selected={projectId ? selected : null}
        emptyHint="No está entre tus proyectos asignados."
        onClose={closeProject}
        returnFocusRef={triggerRef}
      >
        {selected ? (
          <div
            className={cn(
              "border-t-[3px] border-hs-ink pt-5",
              saving && "opacity-70",
            )}
          >
            <AssessmentForm
              key={selected._id}
              initial={snapshotOf(selected)}
              saving={saving}
              onSaveDraft={(draft: AssessmentDraft) =>
                wrap(() =>
                  saveDraft({
                    ...draft.scores,
                    ownCriteriaComment: draft.ownCriteriaComment,
                    submissionId: selected._id,
                  }),
                )()
              }
              onSubmit={(draft: AssessmentDraft) =>
                wrap(() => {
                  const { craftsmanship, creativity, overall, problemSolving } =
                    draft.scores;
                  if (
                    craftsmanship === undefined ||
                    creativity === undefined ||
                    overall === undefined ||
                    problemSolving === undefined
                  ) {
                    throw new Error("Faltan criterios por puntuar");
                  }
                  return submit({
                    craftsmanship,
                    creativity,
                    overall,
                    ownCriteriaComment: draft.ownCriteriaComment,
                    problemSolving,
                    submissionId: selected._id,
                  });
                })()
              }
            />
          </div>
        ) : null}
      </ProjectSheet>
    </Page>
  );
}

function snapshotOf(item: QueueItem) {
  if (!item.assessment) {
    return null;
  }
  const scores: PartialScores = {
    craftsmanship: item.assessment.craftsmanship,
    creativity: item.assessment.creativity,
    overall: item.assessment.overall,
    problemSolving: item.assessment.problemSolving,
  };
  return {
    ownCriteriaComment: item.assessment.ownCriteriaComment,
    scores,
    status: item.assessment.status,
  };
}
