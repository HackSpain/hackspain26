"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent, Ref } from "react";
import { Minus, Plus, Scan, X } from "lucide-react";
import type { AffinityKind } from "./affinities";
import { graphCoordinate, networkSprings } from "./network-model";
import type { GraphPoint, Network, NetworkEdge } from "./network-model";

export const CONNECTION_STYLES: Record<
  AffinityKind,
  { label: string; color: string }
> = {
  city: { color: "#b86746", label: "Ciudad" },
  company: { color: "#438e82", label: "Empresa" },
  degree: { color: "#8a72ad", label: "Grado" },
  interests: { color: "#b77792", label: "Intereses" },
  skills: { color: "#608eae", label: "Habilidades" },
  team: { color: "#c78732", label: "Equipo" },
  university: { color: "#a48732", label: "Universidad" },
};
export interface NetworkHandle {
  focus: (id: string) => void;
  clear: () => void;
}
type Camera = { x: number; y: number; scale: number };
type Simulation = {
  points: GraphPoint[];
  publish: () => void;
};
type Drag = {
  id?: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  camera: Camera;
};

function worldDelta(x: number, y: number, portrait: boolean) {
  return portrait ? { x: y, y: -x } : { x, y };
}

function bounds(points: GraphPoint[]) {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(0, ...xs) - 85,
    right = Math.max(0, ...xs) + 85;
  const top = Math.min(0, ...ys) - 75,
    bottom = Math.max(0, ...ys) + 90;
  return {
    height: bottom - top,
    width: right - left,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

export function NetworkCanvas({
  network,
  initial,
  visibleKinds,
  selectedId,
  matches,
  queryActive,
  onSelect,
  ref,
}: {
  network: Network;
  initial: GraphPoint[];
  visibleKinds: Set<AffinityKind>;
  selectedId: string | null;
  matches: Set<string>;
  queryActive: boolean;
  onSelect: (id: string | null) => void;
  ref?: Ref<NetworkHandle>;
}) {
  const springs = useMemo(() => networkSprings(network), [network]);
  const initialBounds = useMemo(() => bounds(initial), [initial]);
  const [points, setPoints] = useState(initial);
  const [size, setSize] = useState({ height: 700, width: 1000 });
  const [camera, setCamera] = useState<Camera>({
    scale: 1,
    x: initialBounds.x,
    y: initialBounds.y,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulation = useRef<Simulation | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    camera: Camera;
    worldX: number;
    worldY: number;
  } | null>(null);
  const portrait = size.width < 700;
  const fitZoom =
    Math.min(
      size.width / (portrait ? initialBounds.height : initialBounds.width),
      size.height / (portrait ? initialBounds.width : initialBounds.height),
    ) * 0.88;
  const zoom = fitZoom * camera.scale;
  const edges = useMemo(
    () => network.edges.filter((edge) => visibleKinds.has(edge.kind)),
    [network, visibleKinds],
  );
  const pointById = useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );
  const peopleById = useMemo(
    () => new Map(network.participants.map((person) => [person.id, person])),
    [network],
  );
  const entitiesById = useMemo(
    () => new Map(network.entities.map((entity) => [entity.id, entity])),
    [network],
  );
  const prominentEntities = useMemo(
    () =>
      new Set(
        network.entities
          .toSorted((a, b) => b.memberIds.length - a.memberIds.length)
          .slice(0, 10)
          .map((entity) => entity.id),
      ),
    [network],
  );
  const activeId = selectedId ?? hoveredId;
  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const spring of springs) {
      counts.set(spring.source, (counts.get(spring.source) ?? 0) + 1);
      counts.set(spring.target, (counts.get(spring.target) ?? 0) + 1);
    }
    return counts;
  }, [springs]);
  const nearest = useMemo(() => {
    const distances = new Map<string, number>();
    for (const a of points) {
      let squared = Infinity;
      for (const b of points) {
        if (a.id !== b.id) {
          squared = Math.min(squared, (a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        }
      }
      distances.set(a.id, Math.sqrt(squared));
    }
    return distances;
  }, [points]);
  const pairEdges = useMemo(() => {
    const pairs = new Map<string, NetworkEdge[]>();
    for (const edge of edges) {
      const key = JSON.stringify([edge.source, edge.target]);
      const group = pairs.get(key) ?? [];
      group.push(edge);
      pairs.set(key, group);
    }
    return pairs;
  }, [edges]);
  // A handful of shared SVG paths replaces tens of thousands of React elements.
  // Camera changes reuse these paths; only node movement rebuilds their geometry.
  const geometry = useMemo(() => {
    const paths = new Map<AffinityKind, string[]>();
    const segments: { edge: NetworkEdge; path: string }[] = [];
    const adjacency = new Map<string, typeof segments>();
    for (const siblings of pairEdges.values()) {
      const a = pointById.get(siblings[0].source),
        b = pointById.get(siblings[0].target);
      if (!a || !b) {
        continue;
      }
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      for (let i = 0; i < siblings.length; i++) {
        const edge = siblings[i];
        const offset = (i - (siblings.length - 1) / 2) * 13;
        const path = `M ${a.x} ${a.y} Q ${graphCoordinate((a.x + b.x) / 2 - ((b.y - a.y) / distance) * offset)} ${graphCoordinate((a.y + b.y) / 2 + ((b.x - a.x) / distance) * offset)} ${b.x} ${b.y}`;
        const group = paths.get(edge.kind) ?? [];
        group.push(path);
        paths.set(edge.kind, group);
        const segment = { edge, path };
        segments.push(segment);
        for (const id of [edge.source, edge.target]) {
          const links = adjacency.get(id) ?? [];
          links.push(segment);
          adjacency.set(id, links);
        }
      }
    }
    return {
      paths: [...paths].map(([kind, parts]) => ({
        kind,
        path: parts.join(" "),
      })),
      segments,
      adjacency,
    };
  }, [pairEdges, pointById]);
  const neighbors = useMemo(
    () =>
      new Set(
        (activeId ? (geometry.adjacency.get(activeId) ?? []) : []).map(
          ({ edge }) => (edge.source === activeId ? edge.target : edge.source),
        ),
      ),
    [geometry, activeId],
  );
  const highlightedPaths = useMemo(() => {
    const paths = new Map<AffinityKind, string[]>();
    const segments = activeId
      ? (geometry.adjacency.get(activeId) ?? [])
      : queryActive
        ? geometry.segments.filter(
            ({ edge }) => matches.has(edge.source) || matches.has(edge.target),
          )
        : [];
    for (const { edge, path } of segments) {
      const parts = paths.get(edge.kind) ?? [];
      parts.push(path);
      paths.set(edge.kind, parts);
    }
    return [...paths].map(([kind, parts]) => ({ kind, path: parts.join(" ") }));
  }, [geometry, activeId, queryActive, matches]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const model = initial.map((point) => ({ ...point }));
    let frame = 0;
    // The layout is settled in the worker. At rest there is no animation loop;
    // dragging publishes at most one update per display frame.
    simulation.current = {
      points: model,
      publish: () => {
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            setPoints(model.map((point) => ({ ...point })));
          });
        }
      },
    };
    return () => {
      cancelAnimationFrame(frame);
      simulation.current = null;
    };
  }, [initial]);

  function fit() {
    const extent = bounds(simulation.current?.points ?? points);
    setCamera({
      scale:
        (Math.min(
          size.width / (portrait ? extent.height : extent.width),
          size.height / (portrait ? extent.width : extent.height),
        ) *
          0.88) /
        fitZoom,
      x: extent.x,
      y: extent.y,
    });
  }
  function clear() {
    onSelect(null);
    setHoveredId(null);
    fit();
  }
  function focus(id: string) {
    const point = (simulation.current?.points ?? points).find(
      (item) => item.id === id,
    );
    if (!point) {
      return;
    }
    onSelect(id);
    if (entitiesById.has(id)) {
      viewportRef.current?.scrollIntoView({ block: "nearest" });
    }
    setCamera({
      scale: Math.max(camera.scale, Math.min(3, 1 / fitZoom)),
      x: point.x,
      y: point.y,
    });
  }
  useImperativeHandle(ref, () => ({ clear, focus }));

  function zoomAt(nextScale: number, x: number, y: number) {
    const scale = Math.max(0.45, Math.min(6, nextScale));
    const delta = worldDelta(x - size.width / 2, y - size.height / 2, portrait);
    setCamera({
      scale,
      x: camera.x + delta.x / zoom - delta.x / (fitZoom * scale),
      y: camera.y + delta.y / zoom - delta.y / (fitZoom * scale),
    });
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const { x, y } = worldDelta(
        event.clientX - rect.left - size.width / 2,
        event.clientY - rect.top - size.height / 2,
        portrait,
      );
      setCamera((old) => {
        const scale = Math.max(
          0.45,
          Math.min(6, old.scale * Math.exp(-event.deltaY * 0.005)),
        );
        return {
          scale,
          x: old.x + x / (fitZoom * old.scale) - x / (fitZoom * scale),
          y: old.y + y / (fitZoom * old.scale) - y / (fitZoom * scale),
        };
      });
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [size, fitZoom, portrait]);

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }
    const svg = event.currentTarget;
    svg.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = svg.getBoundingClientRect();
      const delta = worldDelta(
        (a.x + b.x) / 2 - rect.left - size.width / 2,
        (a.y + b.y) / 2 - rect.top - size.height / 2,
        portrait,
      );
      pinch.current = {
        camera,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        worldX: camera.x + delta.x / zoom,
        worldY: camera.y + delta.y / zoom,
      };
      drag.current = null;
      suppressClick.current = true;
      return;
    }
    const personElement = (event.target as Element).closest<SVGElement>(
      "[data-node]",
    );
    const id = personElement?.dataset.node;
    const point = id
      ? simulation.current?.points.find((item) => item.id === id)
      : undefined;
    drag.current = {
      camera,
      id,
      originalX: point?.x ?? 0,
      originalY: point?.y ?? 0,
      x: event.clientX,
      y: event.clientY,
    };
    suppressClick.current = false;
  }
  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = Math.max(
        0.45,
        Math.min(
          6,
          (pinch.current.camera.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
            pinch.current.distance,
        ),
      );
      const delta = worldDelta(
        (a.x + b.x) / 2 - rect.left - size.width / 2,
        (a.y + b.y) / 2 - rect.top - size.height / 2,
        portrait,
      );
      setCamera({
        scale,
        x: pinch.current.worldX - delta.x / (fitZoom * scale),
        y: pinch.current.worldY - delta.y / (fitZoom * scale),
      });
      return;
    }
    if (!drag.current) {
      return;
    }
    const { x: dx, y: dy } = worldDelta(
      event.clientX - drag.current.x,
      event.clientY - drag.current.y,
      portrait,
    );
    if (Math.hypot(dx, dy) > 4) {
      suppressClick.current = true;
    }
    if (!suppressClick.current) {
      return;
    }
    if (drag.current.id) {
      const point = simulation.current?.points.find(
        (item) => item.id === drag.current?.id,
      );
      if (point) {
        point.x = drag.current.originalX + dx / zoom;
        point.y = drag.current.originalY + dy / zoom;
        simulation.current?.publish();
      }
    } else {
      setCamera({
        ...drag.current.camera,
        x: drag.current.camera.x - dx / zoom,
        y: drag.current.camera.y - dy / zoom,
      });
    }
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (
      event.type === "pointerup" &&
      drag.current?.id &&
      !suppressClick.current &&
      !pinch.current
    ) {
      focus(drag.current.id);
      suppressClick.current = true;
    }
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) {
      drag.current = null;
      pinch.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="ng-viewport" ref={viewportRef}>
      <svg
        ref={svgRef}
        className="ng-canvas"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        tabIndex={0}
        aria-label="Grafo global de participantes. Arrastra los nodos o el fondo. Usa los controles para ampliar."
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={(event) => {
          if (
            !suppressClick.current &&
            !(event.target as Element).closest("[data-node]")
          ) {
            onSelect(null);
            setHoveredId(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clear();
            return;
          }
          const direction = {
            ArrowDown: [0, 60],
            ArrowLeft: [-60, 0],
            ArrowRight: [60, 0],
            ArrowUp: [0, -60],
          }[event.key];
          if (direction) {
            event.preventDefault();
            const delta = worldDelta(direction[0], direction[1], portrait);
            setCamera((old) => ({
              ...old,
              x: old.x + delta.x / zoom,
              y: old.y + delta.y / zoom,
            }));
          }
        }}
      >
        <g
          transform={`translate(${size.width / 2} ${size.height / 2}) scale(${zoom}) rotate(${portrait ? 90 : 0}) translate(${-camera.x} ${-camera.y})`}
        >
          <g
            opacity={activeId ? 0.055 : queryActive ? 0.04 : 0.45}
            aria-hidden="true"
          >
            {geometry.paths.map(({ kind, path }) => (
              <path
                key={kind}
                className="ng-edge"
                data-kind={kind}
                d={path}
                fill="none"
                stroke={CONNECTION_STYLES[kind].color}
                strokeWidth={0.9}
              />
            ))}
          </g>
          <g opacity={activeId ? 0.8 : 0.26} aria-hidden="true">
            {highlightedPaths.map(({ kind, path }) => (
              <path
                key={kind}
                className="ng-edge"
                data-kind={kind}
                d={path}
                fill="none"
                stroke={CONNECTION_STYLES[kind].color}
                strokeWidth={activeId ? 1.8 : 0.9}
              />
            ))}
          </g>
          {points.map((point) => {
            const person = peopleById.get(point.id);
            const entity = entitiesById.get(point.id);
            if (
              (!person && !entity) ||
              (entity && !visibleKinds.has(entity.kind))
            ) {
              return null;
            }
            const name = person?.displayName ?? entity?.label ?? "";
            const membershipCount = degree.get(point.id) ?? 0;
            const radius = entity
              ? Math.max(
                  Math.min(34, 14 + Math.sqrt(membershipCount) * 1.7),
                  (membershipCount >= 3 ? 11 : 4) / zoom,
                )
              : Math.max(6, 2 / zoom);
            const highlighted = activeId === point.id;
            const relevant = activeId
              ? highlighted || neighbors.has(point.id)
              : !queryActive || matches.has(point.id);
            const color = entity
              ? CONNECTION_STYLES[entity.kind].color
              : "#928f86";
            const showLabel =
              highlighted ||
              (queryActive && matches.has(point.id)) ||
              (entity
                ? prominentEntities.has(point.id) || zoom >= 0.85
                : zoom >= 1.6);
            const label =
              !highlighted && name.length > 28 ? `${name.slice(0, 26)}…` : name;
            return (
              <g
                key={point.id}
                data-node={point.id}
                data-person={person?.id}
                data-entity={entity?.kind}
                className={entity ? "ng-node ng-entity" : "ng-node"}
                transform={`translate(${point.x} ${point.y}) rotate(${portrait ? -90 : 0})`}
                role="button"
                tabIndex={0}
                aria-label={
                  entity
                    ? `Ver ${CONNECTION_STYLES[entity.kind].label}: ${name}, ${entity.memberIds.length} ${entity.memberIds.length === 1 ? "persona" : "personas"}`
                    : `Ver perfil de ${name}`
                }
                aria-pressed={selectedId === point.id}
                opacity={relevant ? 1 : 0.18}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!suppressClick.current) {
                    focus(point.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    focus(point.id);
                  }
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse" && !drag.current) {
                    setHoveredId(point.id);
                  }
                }}
                onPointerLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(point.id)}
                onBlur={() => setHoveredId(null)}
              >
                <title>
                  {entity
                    ? `${CONNECTION_STYLES[entity.kind].label}: ${name} · ${entity.memberIds.length} ${entity.memberIds.length === 1 ? "persona" : "personas"}`
                    : `${name} · ${person?.role} · ${person?.city}`}
                </title>
                <circle
                  r={graphCoordinate(
                    Math.max(
                      radius,
                      Math.min(
                        Math.max(22, 20 / zoom),
                        (nearest.get(point.id) ?? Infinity) * 0.45,
                      ),
                    ),
                  )}
                  fill="transparent"
                  className="ng-node-target"
                />
                <circle
                  className="ng-node-ring"
                  r={radius + 5}
                  fill="none"
                  stroke={highlighted ? "#cc291f" : "transparent"}
                  strokeWidth="1.5"
                />
                {entity ? (
                  <rect
                    x={-radius}
                    y={-radius}
                    width={radius * 2}
                    height={radius * 2}
                    rx={entity.kind === "city" ? radius : 7}
                    fill="var(--ng-paper)"
                    stroke={highlighted ? "#cc291f" : color}
                    strokeWidth={Math.max(2.5, 1.2 / zoom)}
                  />
                ) : (
                  <circle
                    r={radius}
                    fill={
                      highlighted
                        ? "#cc291f"
                        : neighbors.has(point.id)
                          ? "#48463f"
                          : color
                    }
                    stroke="var(--ng-paper)"
                    strokeWidth={Math.max(1.5, 0.6 / zoom)}
                  />
                )}
                {entity && (membershipCount >= 3 || zoom >= 0.7) && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={color}
                    fontSize={Math.max(14, 9 / zoom)}
                    fontWeight="700"
                    aria-hidden="true"
                  >
                    {entity.memberIds.length}
                  </text>
                )}
                {showLabel && (
                  <text
                    style={{
                      fontSize:
                        highlighted || entity ? Math.max(12, 10 / zoom) : 12,
                    }}
                    y={radius + Math.max(18, 13 / zoom)}
                    textAnchor="middle"
                    className={
                      highlighted || entity
                        ? "ng-node-name ng-node-name-active"
                        : "ng-node-name"
                    }
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="ng-map-caption">
        <span className="ng-status-dot" />
        {selectedId
          ? `Conexiones de ${peopleById.get(selectedId)?.displayName ?? entitiesById.get(selectedId)?.label}`
          : "PERSONAS Y ENTIDADES COMPARTIDAS"}
      </div>
      <div className="ng-map-help">
        Arrastra nodos o fondo <span>· Ctrl / ⌘ + rueda para zoom</span>
      </div>
      <div className="ng-map-controls">
        {selectedId && (
          <button type="button" onClick={clear} aria-label="Quitar selección">
            <X size={17} />
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            zoomAt(camera.scale / 1.3, size.width / 2, size.height / 2)
          }
          aria-label="Alejar grafo"
          disabled={camera.scale <= 0.45}
        >
          <Minus size={18} />
        </button>
        <button type="button" onClick={fit} aria-label="Encajar todo el grafo">
          <Scan size={18} />
        </button>
        <button
          type="button"
          onClick={() =>
            zoomAt(camera.scale * 1.3, size.width / 2, size.height / 2)
          }
          aria-label="Acercar grafo"
          disabled={camera.scale >= 6}
        >
          <Plus size={18} />
        </button>
      </div>
      {!edges.length && (
        <div className="ng-map-notice">
          No hay vínculos visibles. Activa algún tipo de conexión.
        </div>
      )}
    </div>
  );
}
