"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Move, Search, X } from "lucide-react";
import { TrackTag } from "@/components/track-tag";
import {
  HUB_KINDS,
  HUB_STYLES,
  buildNetwork,
  normalize,
} from "./network-model";
import type { HubKind } from "./network-model";
import { NetworkCanvas } from "./network-canvas";
import type { NetworkHandle } from "./network-canvas";
import type { DirectoryParticipant } from "./types";
import "./connection-graph.css";

export function ConnectionGraph({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  const network = useMemo(() => buildNetwork(participants), [participants]);
  const [visibleKinds, setVisibleKinds] = useState(
    () => new Set<HubKind>(HUB_KINDS)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const mapRef = useRef<NetworkHandle>(null);
  const profileRef = useRef<HTMLElement>(null);

  const personById = new Map(
    network.participants.map((person) => [person.id, person])
  );
  const hubById = new Map(network.hubs.map((hub) => [hub.id, hub]));
  const hubsOf = (personId: string) =>
    network.hubs.filter(
      (hub) => visibleKinds.has(hub.kind) && hub.members.includes(personId)
    );

  const selectedPerson = selectedId ? personById.get(selectedId) : undefined;
  const selectedHub = selectedId ? hubById.get(selectedId) : undefined;

  const search = normalize(query);
  const matchedPeople = search
    ? network.participants.filter((person) =>
        normalize(
          [
            person.displayName,
            person.role,
            person.city,
            person.university,
            person.company,
            person.degree,
            ...(person.tracks?.map((track) => track.label) ?? []),
            ...hubsOf(person.id).map((hub) => hub.label),
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(search)
      )
    : [];
  const matchedHubs = search
    ? network.hubs.filter(
        (hub) =>
          visibleKinds.has(hub.kind) && normalize(hub.label).includes(search)
      )
    : [];
  const matches = new Set([
    ...matchedPeople.map((person) => person.id),
    ...matchedHubs.map((hub) => hub.id),
  ]);

  function toggleKind(kind: HubKind) {
    setVisibleKinds((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }
  function select(id: string | null) {
    setSelectedId(id);
    setQuery("");
    if (id && window.matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() =>
        profileRef.current?.scrollIntoView({ block: "start" })
      );
    }
  }

  return (
    <section
      className="connection-graph"
      id="participantes"
      aria-label="Grafo de participantes"
    >
      <div className="ng-toolbar">
        <div className="ng-search-wrap">
          <div className="ng-search">
            <Search size={18} strokeWidth={2.5} aria-hidden="true" />
            <input
              aria-label="Buscar en el grafo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca persona, equipo, universidad o empresa"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
          {search && (
            <div className="ng-search-results" aria-label="Resultados de búsqueda">
              <p aria-live="polite">
                {matches.size
                  ? `${matches.size} resultados`
                  : "Nada que coincida"}
              </p>
              {matchedHubs.map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => mapRef.current?.focus(hub.id)}
                >
                  <span
                    className="ng-swatch"
                    style={{ background: HUB_STYLES[hub.kind].color }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{hub.label}</strong>
                    <small>
                      {HUB_STYLES[hub.kind].label} · {hub.members.length} personas
                    </small>
                  </span>
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </button>
              ))}
              {matchedPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => mapRef.current?.focus(person.id)}
                >
                  <span className="ng-swatch ng-swatch-person" aria-hidden="true" />
                  <span>
                    <strong>{person.displayName}</strong>
                    <small>
                      {person.role} · {person.city}
                    </small>
                  </span>
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ng-kinds" role="group" aria-label="Tipos de nodo">
          {HUB_KINDS.map((kind) => {
            const count = network.hubs.filter((hub) => hub.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                className="ng-kind"
                aria-pressed={visibleKinds.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                <span
                  className="ng-swatch"
                  style={{ background: HUB_STYLES[kind].color }}
                  aria-hidden="true"
                />
                {HUB_STYLES[kind].plural}
                <span className="ng-kind-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ng-stage">
        <NetworkCanvas
          key={network.participants.map((person) => person.id).join("|")}
          ref={mapRef}
          network={network}
          visibleKinds={visibleKinds}
          selectedId={selectedPerson || selectedHub ? selectedId : null}
          matches={matches}
          queryActive={Boolean(search)}
          onSelect={select}
        />
        <aside
          ref={profileRef}
          className="ng-panel"
          aria-label={
            selectedPerson
              ? `Perfil de ${selectedPerson.displayName}`
              : selectedHub
                ? `${HUB_STYLES[selectedHub.kind].label} ${selectedHub.label}`
                : "Cómo usar el grafo"
          }
        >
          <div key={selectedId ?? "idle"} className="ng-panel-body">
            {selectedPerson ? (
              <>
                <div className="ng-panel-top">
                  <span className="ng-eyebrow">
                    <span className="ng-swatch ng-swatch-person" aria-hidden="true" />
                    Participante
                  </span>
                  <button
                    type="button"
                    aria-label="Cerrar perfil"
                    onClick={() => mapRef.current?.clear()}
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <h3>{selectedPerson.displayName}</h3>
                <p className="ng-role">
                  {selectedPerson.isMe ? "Tú · " : null}
                  {selectedPerson.role} · {selectedPerson.city}
                  {selectedPerson.degree ? ` · ${selectedPerson.degree}` : null}
                </p>
                {selectedPerson.tracks?.length ? (
                  <div className="ng-tracks">
                    {selectedPerson.tracks.map((track) => (
                      <TrackTag key={track.id} track={track} />
                    ))}
                  </div>
                ) : null}
                {selectedPerson.bio && (
                  <p className="ng-bio">{selectedPerson.bio}</p>
                )}
                <div className="ng-list-heading">
                  <strong>Conectado a</strong>
                  <span>{hubsOf(selectedPerson.id).length}</span>
                </div>
                <div className="ng-list">
                  {hubsOf(selectedPerson.id).map((hub) => (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => mapRef.current?.focus(hub.id)}
                    >
                      <span
                        className="ng-swatch"
                        style={{ background: HUB_STYLES[hub.kind].color }}
                        aria-hidden="true"
                      />
                      <span className="ng-list-text">
                        <small>{HUB_STYLES[hub.kind].label}</small>
                        <strong>{hub.label}</strong>
                      </span>
                      <span className="ng-list-meta">
                        {hub.members.length - 1 || "solo"}
                      </span>
                    </button>
                  ))}
                </div>
                {hubsOf(selectedPerson.id).length ? (
                  <p className="ng-list-note">
                    El número es cuánta gente más comparte cada nodo.
                  </p>
                ) : (
                  <p className="ng-list-empty">
                    Sin nodos visibles. Activa otro tipo arriba.
                  </p>
                )}
              </>
            ) : selectedHub ? (
              <>
                <div className="ng-panel-top">
                  <span className="ng-eyebrow">
                    <span
                      className="ng-swatch"
                      style={{ background: HUB_STYLES[selectedHub.kind].color }}
                      aria-hidden="true"
                    />
                    {HUB_STYLES[selectedHub.kind].label}
                  </span>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={() => mapRef.current?.clear()}
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <h3>{selectedHub.label}</h3>
                <div className="ng-list-heading">
                  <strong>Personas</strong>
                  <span>{selectedHub.members.length}</span>
                </div>
                <div className="ng-list">
                  {selectedHub.members
                    .flatMap((id) => personById.get(id) ?? [])
                    .toSorted((a, b) =>
                      a.displayName.localeCompare(b.displayName, "es")
                    )
                    .map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => mapRef.current?.focus(person.id)}
                      >
                        <span
                          className="ng-swatch ng-swatch-person"
                          aria-hidden="true"
                        />
                        <span className="ng-list-text">
                          <strong>{person.displayName}</strong>
                          <small>{person.role}</small>
                        </span>
                        <ArrowUpRight size={15} strokeWidth={2.5} />
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <>
                <span className="ng-eyebrow">Cómo funciona</span>
                <ul className="ng-legend">
                  <li>
                    <span className="ng-swatch ng-swatch-person" aria-hidden="true" />
                    <span>
                      <strong>Los círculos son personas.</strong> Toca una para
                      ver sus nodos y quién los comparte.
                    </span>
                  </li>
                  <li>
                    <span className="ng-swatch-stack" aria-hidden="true">
                      {HUB_KINDS.map((kind) => (
                        <span
                          key={kind}
                          className="ng-swatch"
                          style={{ background: HUB_STYLES[kind].color }}
                        />
                      ))}
                    </span>
                    <span>
                      <strong>Los cuadrados son nodos</strong>: equipos,
                      universidades y empresas. El número es cuánta gente hay
                      en cada uno.
                    </span>
                  </li>
                  <li>
                    <Move size={14} strokeWidth={2.5} aria-hidden="true" />
                    <span>
                      Arrastra para moverte o recolocar nodos. Doble clic,
                      Ctrl / ⌘ + rueda o pinza para acercar.
                    </span>
                  </li>
                </ul>
              </>
            )}
          </div>
        </aside>
        {!participants.length && (
          <p className="ng-empty">
            Las conexiones aparecerán cuando haya perfiles disponibles.
          </p>
        )}
      </div>
    </section>
  );
}
