"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Network,
  Search,
  Users,
} from "lucide-react";
import type { DirectoryParticipant } from "./types";
import { normalize } from "./affinities";
import { ConnectionGraph } from "./connection-graph";
import "./participant-directory.css";

type ParticipantView = "directory" | "graph";

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
                  <img src={participant.photoUrl} alt="" />
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

export function ParticipantDirectory({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  const [view, setView] = useState<ParticipantView>("directory");

  return (
    // Proton Pass can add data-protonpass-form before React hydrates this wrapper.
    // Suppress attribute mismatches only here; descendants still hydrate normally.
    <div className="participant-directory" suppressHydrationWarning>
      <section className="pd-hero">
        <div className="pd-hero-copy">
          <h1>
            CONOCE A LOS <em>BUILDERS</em> DEL FUTURO.
          </h1>
          <p>
            Conoce a quienes comparten tu ciudad, universidad, habilidades e
            intereses.
          </p>
        </div>
      </section>

      <div
        className="pd-view-switcher"
        role="group"
        aria-label="Vista de participantes"
      >
        <button
          type="button"
          aria-controls="pd-directory-panel"
          aria-pressed={view === "directory"}
          onClick={() => setView("directory")}
        >
          <LayoutGrid aria-hidden="true" size={17} />
          Directorio
        </button>
        <button
          type="button"
          aria-controls="pd-graph-panel"
          aria-pressed={view === "graph"}
          onClick={() => setView("graph")}
        >
          <Network aria-hidden="true" size={17} />
          Grafo
        </button>
      </div>

      {view === "directory" ? (
        <ParticipantList participants={participants} />
      ) : (
        <div id="pd-graph-panel">
          <ConnectionGraph participants={participants} />
        </div>
      )}
    </div>
  );
}
