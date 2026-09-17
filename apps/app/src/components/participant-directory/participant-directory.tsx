"use client";

import { PencilLine } from "lucide-react";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { DirectoryParticipant } from "./types";
import { ConnectionGraph } from "./connection-graph";

/**
 * The hub graph is the page. The viewer's card was filled during onboarding;
 * "Editar mi ficha" goes to `/profile#ficha`. `fullBleed` lets the stage use
 * the viewport, so we keep the graph inside contentWidth.
 */
export function ParticipantDirectory({
  participants,
  onEdit,
}: {
  participants: DirectoryParticipant[];
  onEdit?: () => void;
}) {
  const teams = new Set(
    participants.flatMap((person) => (person.team ? [person.team.id] : [])),
  ).size;
  const peopleLabel = participants.length === 1 ? "persona" : "personas";
  const teamLabel = teams === 1 ? "equipo" : "equipos";

  return (
    <div className={cn(contentWidth("/participantes"), "pb-8")}>
      <Page
        title={
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-bungee text-2xl leading-tight sm:text-3xl">
              Participantes
            </h1>
            {onEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <PencilLine aria-hidden /> Editar mi ficha
              </Button>
            ) : null}
          </div>
        }
        description={`${participants.length} ${peopleLabel} y ${teams} ${teamLabel}. Cada persona cuelga de su equipo, universidad y empresa: toca un nodo para ver quién comparte cada uno.`}
      >
        <ConnectionGraph participants={participants} />
      </Page>
    </div>
  );
}
