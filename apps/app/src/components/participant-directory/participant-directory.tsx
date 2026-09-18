"use client";

import { useMemo, useState } from "react";
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
import { normalize } from "./affinities";
import { ConnectionGraph } from "./connection-graph";
import { photoThumbnail } from "./photo";
import "./participant-directory.css";

type ParticipantView = "graph" | "directory";

function ParticipantList({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  const [query, setQuery] = useState("");
  const search = normalize(query);
  const filtered = useMemo(
    () =>
      participants.filter((participant) =>
        normalize(
          [
            participant.displayName,
            participant.role,
            participant.city,
            participant.university,
            participant.company,
            participant.degree,
            participant.team?.name,
            ...participant.skills,
            ...(participant.interests ?? []),
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(search),
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
            placeholder="Buscar por nombre, ciudad, universidad…"
          />
        </label>
        <p aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "persona" : "personas"}
        </p>
      </div>

      {filtered.length ? (
        <div className="pd-list-grid">
          {filtered.map((participant) => (
            <article className="pd-person-card" key={participant.id}>
              <div className="pd-person-heading">
                {participant.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- profile images may use authenticated app URLs or GitHub avatars.
                  <img src={photoThumbnail(participant.photoUrl)} alt="" />
                ) : (
                  <span className="pd-person-initial" aria-hidden="true">
                    {participant.displayName.charAt(0)}
                  </span>
                )}
                <div>
                  <h2>{participant.displayName}</h2>
                  <p>{participant.role}</p>
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

/**
 * The map is the page: it bleeds edge to edge below a compact header. The
 * card directory stays one click away inside the regular content width.
 */
export function ParticipantDirectory({
  participants,
  onEdit,
}: {
  participants: DirectoryParticipant[];
  onEdit?: () => void;
}) {
  const [view, setView] = useState<ParticipantView>("graph");
  const container = contentWidth("/participantes");

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
        <ConnectionGraph participants={participants} />
      ) : (
        <div className={container}>
          <ParticipantList participants={participants} />
        </div>
      )}
    </div>
  );
}
