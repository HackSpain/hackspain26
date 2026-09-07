"use client";

import { useMemo, useRef, useState } from "react";
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
import { buildNetwork } from "./network-model";
import { CONNECTION_STYLES, NetworkCanvas } from "./network-canvas";
import type { NetworkHandle } from "./network-canvas";
import type { DirectoryParticipant } from "./types";
import "./connection-graph.css";

const LEGEND_ORDER: AffinityKind[] = [
  "city",
  "company",
  "degree",
  "university",
  "team",
  "skills",
  "interests",
];

export function ConnectionGraph({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  const network = useMemo(() => buildNetwork(participants), [participants]);
  const [visibleKinds, setVisibleKinds] = useState(
    () => new Set<AffinityKind>(AFFINITY_KINDS)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const mapRef = useRef<NetworkHandle>(null);
  const profileRef = useRef<HTMLElement>(null);
  const selected = network.participants.find(
    (person) => person.id === selectedId
  );
  const search = normalize(query);
  const matches = new Set(
    network.participants
      .filter((person) =>
        normalize(
          [
            person.displayName,
            person.role,
            ...AFFINITY_KINDS.flatMap((kind) => valuesFor(person, kind)),
          ].join(" ")
        ).includes(search)
      )
      .map((person) => person.id)
  );
  const visibleEdges = network.edges.filter((edge) =>
    visibleKinds.has(edge.kind)
  );
  const teamCount = new Set(
    participants.flatMap((person) => (person.team ? [person.team.id] : []))
  ).size;
  const neighbors = selected
    ? network.participants
        .flatMap((person) => {
          const links = visibleEdges.filter(
            (edge) =>
              (edge.source === selected.id && edge.target === person.id) ||
              (edge.target === selected.id && edge.source === person.id)
          );
          return links.length ? [{ links, person }] : [];
        })
        .toSorted(
          (a, b) =>
            b.links.length - a.links.length ||
            a.person.displayName.localeCompare(b.person.displayName, "es")
        )
    : [];

  function toggleKind(kind: AffinityKind) {
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
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Buscar en el grafo"
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
                {matches.size
                  ? `${matches.size} perfiles encontrados`
                  : "No hay perfiles que coincidan"}
              </p>
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
            <span>{teamCount} equipos</span>
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ng-filter-trigger"
                aria-label={`Filtros de conexiones, ${visibleKinds.size} de ${AFFINITY_KINDS.length} activos`}
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
                  {visibleKinds.size}/{AFFINITY_KINDS.length}
                </span>
              </DropdownMenuLabel>
              {LEGEND_ORDER.map((kind) => {
                const style = CONNECTION_STYLES[kind];
                const count = network.edges.filter(
                  (edge) => edge.kind === kind
                ).length;
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
        <NetworkCanvas
          key={network.participants.map((person) => person.id).join("|")}
          ref={mapRef}
          network={network}
          visibleKinds={visibleKinds}
          selectedId={selected?.id ?? null}
          matches={matches}
          queryActive={Boolean(search)}
          onSelect={select}
        />
        {selected && (
          <aside
            ref={profileRef}
            className="ng-profile"
            aria-label={`Perfil de ${selected.displayName}`}
          >
            <div className="ng-profile-top">
              <span className="ng-eyebrow">EN LA COMUNIDAD</span>
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
              <h3>{selected.displayName}</h3>
            </div>
            <p className="ng-role">{selected.role}</p>
            <dl className="ng-profile-facts">
              {LEGEND_ORDER.filter(
                (kind) =>
                  !["skills", "interests"].includes(kind) &&
                  valuesFor(selected, kind).length
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
            <div className="ng-shared-heading">
              <strong>Personas conectadas</strong>
              <span>{neighbors.length}</span>
            </div>
            <p className="ng-shared-description">
              Según los tipos de conexión visibles.
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
