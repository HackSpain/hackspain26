"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AFFINITY_KINDS, normalize, valuesFor } from "./affinities";
import type { AffinityKind } from "./affinities";
import { ENTITY_KINDS, networkNeighbors } from "./network-model";
import type { GraphPoint, Network } from "./network-model";
import { CONNECTION_STYLES, NetworkCanvas } from "./network-canvas";
import type { NetworkHandle } from "./network-canvas";
import type { DirectoryParticipant } from "./types";
import "./connection-graph.css";

const LEGEND_ORDER = ENTITY_KINDS;

export function ConnectionGraph({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  const [prepared, setPrepared] = useState<{
    input: DirectoryParticipant[];
    network: Network;
    points: GraphPoint[];
  } | null>(null);
  const [failedInput, setFailedInput] = useState<DirectoryParticipant[] | null>(
    null,
  );
  const failed = failedInput === participants;
  useEffect(() => {
    let worker: Worker | undefined;
    try {
      // Keep the relative module specifier explicit for the worker bundler.
      // oxlint-disable-next-line unicorn/relative-url-style
      worker = new Worker(new URL("./network.worker.ts", import.meta.url));
      worker.addEventListener(
        "message",
        (event: MessageEvent<{ network: Network; points: GraphPoint[] }>) => {
          setPrepared({ input: participants, ...event.data });
          worker?.terminate();
        },
      );
      worker.addEventListener("error", () => {
        setFailedInput(participants);
        worker?.terminate();
      });
      worker.postMessage(participants, []);
    } catch {
      // Worker construction can fail synchronously under browser security policies.
      // oxlint-disable-next-line react/set-state-in-effect
      setFailedInput(participants);
    }
    return () => worker?.terminate();
  }, [participants]);
  const ready = prepared?.input === participants;
  const network = useMemo<Network>(
    () =>
      ready && prepared
        ? prepared.network
        : { participants, edges: [], entities: [] },
    [ready, prepared, participants],
  );
  const [visibleKinds, setVisibleKinds] = useState(
    () => new Set<AffinityKind>(ENTITY_KINDS),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const mapRef = useRef<NetworkHandle>(null);
  const profileRef = useRef<HTMLElement>(null);
  const selected = network.participants.find(
    (person) => person.id === selectedId,
  );
  const selectedEntity = network.entities.find(
    (entity) => entity.id === selectedId && visibleKinds.has(entity.kind),
  );
  const selectionName = selected?.displayName ?? selectedEntity?.label;
  const search = normalize(query);
  const searchIndex = useMemo(
    () =>
      new Map(
        network.participants.map((person) => [
          person.id,
          normalize(
            [
              person.displayName,
              person.role,
              ...ENTITY_KINDS.flatMap((kind) => valuesFor(person, kind)),
            ].join(" "),
          ),
        ]),
      ),
    [network],
  );
  const matches = useMemo(
    () =>
      new Set(
        network.participants
          .filter((person) => searchIndex.get(person.id)?.includes(search))
          .map((person) => person.id),
      ),
    [network, searchIndex, search],
  );
  const matchingEntities = useMemo(
    () =>
      network.entities.filter(
        (entity) =>
          visibleKinds.has(entity.kind) &&
          normalize(entity.label).includes(search),
      ),
    [network, visibleKinds, search],
  );
  const highlightedMatches = useMemo(
    () => new Set([...matches, ...matchingEntities.map((entity) => entity.id)]),
    [matches, matchingEntities],
  );
  const index = useMemo(() => {
    const counts = new Map<AffinityKind, number>();
    for (const edge of network.edges) {
      counts.set(edge.kind, (counts.get(edge.kind) ?? 0) + 1);
    }
    return { counts };
  }, [network]);
  const neighbors = useMemo(
    () =>
      selectedId ? networkNeighbors(network, selectedId, visibleKinds) : [],
    [network, selectedId, visibleKinds],
  );

  function toggleKind(kind: AffinityKind) {
    setSelectedId(null);
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
    if (
      id &&
      network.participants.some((person) => person.id === id) &&
      window.matchMedia("(max-width: 700px)").matches
    ) {
      requestAnimationFrame(() =>
        profileRef.current?.scrollIntoView({ block: "start" }),
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
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Buscar en el grafo"
              disabled={!ready}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca una persona, ciudad, empresa…"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {search && (
            <div
              className="ng-search-results"
              aria-label="Resultados de búsqueda"
            >
              <p aria-live="polite">
                {matches.size || matchingEntities.length
                  ? `${matches.size} ${matches.size === 1 ? "persona" : "personas"} · ${matchingEntities.length} ${matchingEntities.length === 1 ? "entidad" : "entidades"}`
                  : "No hay perfiles que coincidan"}
              </p>
              {matchingEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => mapRef.current?.focus(entity.id)}
                >
                  <span>
                    <strong>{entity.label}</strong>
                    <small>
                      {CONNECTION_STYLES[entity.kind].label} ·{" "}
                      {entity.memberIds.length}{" "}
                      {entity.memberIds.length === 1 ? "persona" : "personas"}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {network.participants
                .filter((person) => matches.has(person.id))
                .map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => mapRef.current?.focus(person.id)}
                  >
                    <span>
                      <strong>{person.displayName}</strong>
                      <small>
                        {person.role} · {person.city}
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="ng-toolbar-actions">
          <div className="ng-summary">
            <Users size={15} />
            <span>{participants.length} personas</span>
            <span className="ng-summary-divider" />
            <span>{network.entities.length} entidades</span>
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ng-filter-trigger"
                disabled={!ready}
                aria-label={`Filtros de conexiones, ${visibleKinds.size} de ${ENTITY_KINDS.length} activos`}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filtros
                <span className="ng-filter-badge">{visibleKinds.size}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="ng-filter-menu"
              align="end"
              sideOffset={10}
              collisionPadding={12}
            >
              <DropdownMenuLabel className="ng-filter-label">
                Conexiones visibles{" "}
                <span>
                  {visibleKinds.size}/{ENTITY_KINDS.length}
                </span>
              </DropdownMenuLabel>
              {LEGEND_ORDER.map((kind) => {
                const style = CONNECTION_STYLES[kind];
                const count = index.counts.get(kind) ?? 0;
                return (
                  <DropdownMenuPrimitive.CheckboxItem
                    key={kind}
                    className="ng-filter-option"
                    checked={visibleKinds.has(kind)}
                    onCheckedChange={() => toggleKind(kind)}
                    onSelect={(event) => event.preventDefault()}
                    aria-label={style.label}
                  >
                    <span
                      className="ng-filter-color"
                      style={{ backgroundColor: style.color }}
                      aria-hidden="true"
                    />
                    <span className="ng-filter-name">{style.label}</span>
                    <span className="ng-filter-count" aria-hidden="true">
                      {count}
                    </span>
                    <span className="ng-filter-check" aria-hidden="true">
                      <DropdownMenuPrimitive.ItemIndicator>
                        <Check size={12} strokeWidth={2.5} />
                      </DropdownMenuPrimitive.ItemIndicator>
                    </span>
                  </DropdownMenuPrimitive.CheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="ng-stage">
        {!ready && (
          <p role="status">
            {failed
              ? "No se pudo cargar el grafo. Recarga la página para volver a intentarlo."
              : "Organizando participantes y conexiones…"}
          </p>
        )}
        {ready && prepared && (
          <NetworkCanvas
            initial={prepared.points}
            key={network.participants.map((person) => person.id).join("|")}
            ref={mapRef}
            network={network}
            visibleKinds={visibleKinds}
            selectedId={selectionName ? selectedId : null}
            matches={highlightedMatches}
            queryActive={Boolean(search)}
            onSelect={select}
          />
        )}
        {selectionName && (
          <aside
            ref={profileRef}
            className="ng-profile"
            aria-label={
              selected
                ? `Perfil de ${selected.displayName}`
                : `${selectedEntity?.label}: participantes`
            }
          >
            <div className="ng-profile-top">
              <span className="ng-eyebrow">
                {selectedEntity
                  ? CONNECTION_STYLES[selectedEntity.kind].label
                  : "EN LA COMUNIDAD"}
              </span>
              <button
                type="button"
                aria-label="Cerrar perfil y volver a la vista global"
                onClick={() => mapRef.current?.clear()}
              >
                <X size={17} />
              </button>
            </div>
            <div className="ng-profile-identity">
              <span className="ng-profile-dot" />
              <h3>{selectionName}</h3>
            </div>
            {selected && (
              <>
                <p className="ng-role">{selected.role}</p>
                <dl className="ng-profile-facts">
                  {AFFINITY_KINDS.filter(
                    (kind) =>
                      !["skills", "interests"].includes(kind) &&
                      valuesFor(selected, kind).length,
                  ).map((kind) => (
                    <div key={kind}>
                      <dt>
                        <span
                          style={{ background: CONNECTION_STYLES[kind].color }}
                        />
                        {CONNECTION_STYLES[kind].label}
                      </dt>
                      <dd>{valuesFor(selected, kind).join(", ")}</dd>
                    </div>
                  ))}
                </dl>
                {selected.bio && <p className="ng-bio">{selected.bio}</p>}
                <div className="ng-entity-links">
                  {network.entities
                    .filter(
                      (entity) =>
                        entity.memberIds.includes(selected.id) &&
                        visibleKinds.has(entity.kind),
                    )
                    .map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => mapRef.current?.focus(entity.id)}
                      >
                        {CONNECTION_STYLES[entity.kind].label}: {entity.label}{" "}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                </div>
              </>
            )}
            <div className="ng-shared-heading">
              <strong>
                {selectedEntity
                  ? "Participantes"
                  : "Personas con entidades en común"}
              </strong>
              <span>{neighbors.length}</span>
            </div>
            <p className="ng-shared-description">
              {selectedEntity
                ? "Personas vinculadas a este nodo."
                : "A través de las entidades visibles."}
            </p>
            <div className="ng-neighbors">
              {neighbors.map(({ person, links }) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => mapRef.current?.focus(person.id)}
                >
                  <span className="ng-neighbor-name">
                    {person.displayName}
                    <ArrowUpRight size={14} />
                  </span>
                  <span className="ng-reasons">
                    {links.map((link) => (
                      <span key={link.id}>
                        <i
                          style={{
                            background: CONNECTION_STYLES[link.kind].color,
                          }}
                        />
                        {link.values.join(" · ")}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
            {!neighbors.length && (
              <p className="ng-no-neighbors">
                No hay conexiones visibles para este perfil. Prueba a activar
                otros tipos.
              </p>
            )}
          </aside>
        )}
        {!participants.length && (
          <div className="ng-empty">
            Las conexiones aparecerán cuando haya perfiles disponibles.
          </div>
        )}
      </div>
    </section>
  );
}
