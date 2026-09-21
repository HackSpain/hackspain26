"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Network,
  PencilLine,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { DirectoryParticipant } from "./types";
import { personHeading } from "./types";
import { normalize, searchHaystack } from "./affinities";
import { ConnectionGraph } from "./connection-graph";
import { PersonSheet, PERSON_PARAM, usePersonPicker } from "./person-sheet";
import "./participant-directory.css";
import "./connection-graph.css";

type ParticipantView = "graph" | "directory";

const DIRECTORY_PARAM = "directorio";

function ParticipantList({
  participants,
  selectedId,
  onOpen,
}: {
  participants: DirectoryParticipant[];
  selectedId: string | null;
  onOpen: (id: string, from: HTMLElement | null) => void;
}) {
  const [query, setQuery] = useState("");
  const search = normalize(query);
  const filtered = useMemo(
    () =>
      participants.filter((participant) =>
        searchHaystack(participant).includes(search),
      ),
    [participants, search],
  );

  return (
    <section
      aria-label="Directorio de participantes"
      className="pd-list"
      id="pd-directory-panel"
    >
      <div className="pd-list-toolbar">
        <label className="pd-list-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Buscar en el directorio</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, equipo, proyecto…"
          />
        </label>
        <p aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "persona" : "personas"}
        </p>
      </div>

      {filtered.length ? (
        <div className="pd-list-grid">
          {filtered.map((participant) => (
            <article
              className="pd-person-card"
              data-selected={selectedId === participant.id ? "" : undefined}
              key={participant.id}
            >
              <div className="pd-person-heading">
                {participant.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- profile images may use authenticated app URLs or GitHub avatars.
                  <img src={participant.photoUrl} alt="" />
                ) : (
                  <span className="pd-person-initial" aria-hidden="true">
                    {participant.displayName.charAt(0)}
                  </span>
                )}
                <div>
                  <h2>
                    <button
                      className="pd-person-open"
                      type="button"
                      aria-pressed={selectedId === participant.id}
                      onClick={(event) =>
                        onOpen(participant.id, event.currentTarget)
                      }
                    >
                      {personHeading(participant)}
                    </button>
                  </h2>
                  <p>
                    {[participant.team?.name, participant.projectName]
                      .filter(Boolean)
                      .join(" · ") || participant.city}
                  </p>
                </div>
              </div>

              {participant.bio ? (
                <p className="pd-person-bio">{participant.bio}</p>
              ) : null}

              <dl className="pd-person-facts">
                <div>
                  <dt>
                    <MapPin aria-hidden="true" size={15} /> Ciudad
                  </dt>
                  <dd>{participant.city}</dd>
                </div>
                {participant.university ? (
                  <div>
                    <dt>
                      <GraduationCap aria-hidden="true" size={15} /> Universidad
                    </dt>
                    <dd>{participant.university}</dd>
                  </div>
                ) : null}
                {participant.company ? (
                  <div>
                    <dt>
                      <Building2 aria-hidden="true" size={15} /> Empresa
                    </dt>
                    <dd>{participant.company}</dd>
                  </div>
                ) : null}
                {participant.team ? (
                  <div>
                    <dt>
                      <Users aria-hidden="true" size={15} /> Equipo
                    </dt>
                    <dd>{participant.team.name}</dd>
                  </div>
                ) : null}
                {participant.projectName ? (
                  <div>
                    <dt>
                      <Network aria-hidden="true" size={15} /> Proyecto
                    </dt>
                    <dd>{participant.projectName}</dd>
                  </div>
                ) : null}
              </dl>

              {participant.skills.length ? (
                <ul className="pd-person-skills" aria-label="Habilidades">
                  {participant.skills.slice(0, 4).map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="pd-list-empty">
          No hay participantes que coincidan con esta búsqueda.
        </div>
      )}
    </section>
  );
}

export function ParticipantDirectory({
  participants,
  onEdit,
}: {
  participants: DirectoryParticipant[];
  onEdit?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { personId, triggerRef, openPerson, closePerson } = usePersonPicker();
  const view: ParticipantView = params.has(DIRECTORY_PARAM)
    ? "directory"
    : "graph";
  const container = contentWidth("/participantes");

  function setView(next: ParticipantView) {
    const persona = params.get(PERSON_PARAM);
    if (next === "directory") {
      router.replace(
        persona
          ? `${pathname}?${DIRECTORY_PARAM}&${PERSON_PARAM}=${persona}`
          : `${pathname}?${DIRECTORY_PARAM}`,
        { scroll: false },
      );
      return;
    }
    router.replace(
      persona ? `${pathname}?${PERSON_PARAM}=${persona}` : pathname,
      { scroll: false },
    );
  }

  return (
    // Proton Pass can add data-protonpass-form before React hydrates this wrapper.
    // Suppress attribute mismatches only here; descendants still hydrate normally.
    <div className="participant-directory" suppressHydrationWarning>
      <header className={cn("pd-header hs-enter", container)}>
        <div className="pd-header-copy">
          <h1>Participantes</h1>
          <p>
            {participants.length}{" "}
            {participants.length === 1 ? "persona" : "personas"} con ficha.
            Agrupa por equipo, reto, ciudad, universidad o empresa y toca a
            alguien para ver qué tenéis en común.
          </p>
        </div>
        <div className="pd-header-actions">
          <div
            className="pd-view-switcher"
            role="group"
            aria-label="Vista de participantes"
          >
            <button
              type="button"
              aria-controls="participantes"
              aria-pressed={view === "graph"}
              onClick={() => setView("graph")}
            >
              <Network aria-hidden="true" size={16} />
              Mapa
            </button>
            <button
              type="button"
              aria-controls="pd-directory-panel"
              aria-pressed={view === "directory"}
              onClick={() => setView("directory")}
            >
              <LayoutGrid aria-hidden="true" size={16} />
              Directorio
            </button>
          </div>
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <PencilLine aria-hidden /> Editar mi ficha
            </Button>
          ) : null}
        </div>
      </header>

      {view === "graph" ? (
        <ConnectionGraph
          participants={participants}
          selectedId={personId}
          onSelect={(id) => {
            if (id) {
              openPerson(id);
            } else {
              closePerson();
            }
          }}
        />
      ) : (
        <div className={container}>
          <ParticipantList
            participants={participants}
            selectedId={personId}
            onOpen={openPerson}
          />
        </div>
      )}

      <PersonSheet
        participants={participants}
        personId={personId}
        onClose={closePerson}
        onOpen={openPerson}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
