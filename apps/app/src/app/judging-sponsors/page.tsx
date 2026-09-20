"use client";

import { useQuery } from "convex/react";
import { Suspense, useId } from "react";
import { api } from "@convex/_generated/api";
import {
  PROJECT_PARAM,
  ProjectSheet,
  ProjectTable,
  ProjectTableFallback,
  TRACK_PARAM,
  useProjectPicker,
  writeParams,
} from "@/components/judging/project-table";
import { EmptyState, Field, Page } from "@/components/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableHead } from "@/components/ui/table";

export default function SponsorJudgingPage() {
  return (
    <Suspense fallback={<ProjectTableFallback title="Entregas" />}>
      <SponsorPanel />
    </Suspense>
  );
}

function SponsorPanel() {
  const me = useQuery(api.users.me);
  const allowed =
    me?.role === "admin" ||
    (me?.sections.includes("judgingSponsors") ?? false);
  const { pathname, projectId, searchParams, triggerRef, openProject, closeProject } =
    useProjectPicker();
  const trackSlug = searchParams.get(TRACK_PARAM) ?? undefined;
  const catalog = useQuery(
    api.judging.trackCatalog,
    allowed ? { trackSlug } : "skip",
  );
  const trackSelectId = useId();

  if (me === undefined) {
    return <ProjectTableFallback title="Entregas" />;
  }
  if (!allowed) {
    return (
      <Page title="Entregas">
        <EmptyState title="Solo para sponsors">
          Este listado es para partners. El jurado puntúa en otra página.
        </EmptyState>
      </Page>
    );
  }
  if (!catalog) {
    return <ProjectTableFallback title="Entregas" />;
  }

  const selectedTrack =
    catalog.tracks.find((track) => track._id === catalog.selectedTrackId) ??
    null;
  const selected =
    catalog.items.find((item) => item._id === projectId) ?? null;

  return (
    <Page
      title="Entregas"
      description="Elige un reto y revisa todas las submissions. Aquí no se puntúa."
      className="space-y-4"
    >
      {catalog.tracks.length === 0 ? (
        <EmptyState title="No hay retos">
          Cuando la organización publique los retos, las entregas aparecerán
          aquí.
        </EmptyState>
      ) : (
        <>
          <Field
            label="Reto"
            htmlFor={trackSelectId}
            meta={`${catalog.items.length} entregas`}
          >
            <Select
              value={selectedTrack?.slug}
              onValueChange={(slug) => {
                writeParams(
                  pathname,
                  (params) => {
                    params.set(TRACK_PARAM, slug);
                    params.delete(PROJECT_PARAM);
                  },
                  "replace",
                );
              }}
            >
              <SelectTrigger
                id={trackSelectId}
                aria-label="Reto"
                className="max-w-md"
              >
                <SelectValue placeholder="Elige un reto" />
              </SelectTrigger>
              <SelectContent>
                {catalog.tracks.map((track) => (
                  <SelectItem key={track._id} value={track.slug}>
                    {track.label}
                    <span className="text-xs text-hs-brown">
                      · {track.submittedCount}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {catalog.items.length === 0 ? (
            <EmptyState title="Nadie ha entregado en este reto">
              Las submissions aparecen aquí en cuanto un equipo entrega.
            </EmptyState>
          ) : (
            <ProjectTable
              rows={catalog.items}
              projectId={projectId}
              onOpen={openProject}
              extraHead={<TableHead>Miembros</TableHead>}
              extraCell={(row) => (
                <TableCell className="max-w-72 truncate">
                  {row.members.join(" · ") || "—"}
                </TableCell>
              )}
            />
          )}
        </>
      )}

      <ProjectSheet
        selected={projectId ? selected : null}
        emptyHint="No está en este reto."
        onClose={closeProject}
        returnFocusRef={triggerRef}
      />
    </Page>
  );
}
