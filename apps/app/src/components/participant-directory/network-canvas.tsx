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
import {
  graphCoordinate,
  initialPoints,
  networkSprings,
  tickForces,
} from "./network-model";
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
  pinnedId?: string;
  wake: () => void;
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
  visibleKinds,
  selectedId,
  matches,
  queryActive,
  onSelect,
  ref,
}: {
  network: Network;
  visibleKinds: Set<AffinityKind>;
  selectedId: string | null;
  matches: Set<string>;
  queryActive: boolean;
  onSelect: (id: string | null) => void;
  ref?: Ref<NetworkHandle>;
}) {
  const initial = useMemo(() => initialPoints(network), [network]);
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
      size.height / (portrait ? initialBounds.width : initialBounds.height)
    ) * 0.88;
  const zoom = fitZoom * camera.scale;
  const edges = useMemo(
    () => network.edges.filter((edge) => visibleKinds.has(edge.kind)),
    [network, visibleKinds]
  );
  const pointById = new Map(points.map((point) => [point.id, point]));
  const peopleById = new Map(
    network.participants.map((person) => [person.id, person])
  );
  const activeId = hoveredId ?? selectedId;
  const neighbors = new Set(
    edges.flatMap((edge) =>
      edge.source === activeId
        ? [edge.target]
        : edge.target === activeId
          ? [edge.source]
          : []
    )
  );
  const degree = new Map<string, number>();
  for (const spring of springs) {
    degree.set(spring.source, (degree.get(spring.source) ?? 0) + 1);
    degree.set(spring.target, (degree.get(spring.target) ?? 0) + 1);
  }
  const pairEdges = new Map<string, NetworkEdge[]>();
  for (const edge of edges) {
    const key = JSON.stringify([edge.source, edge.target]);
    pairEdges.set(key, [...(pairEdges.get(key) ?? []), edge]);
  }
  const teams = new Map<string, { name: string; members: GraphPoint[] }>();
  for (const person of network.participants) {
    const point = pointById.get(person.id);
    if (!person.team || !point) {
      continue;
    }
    const team = teams.get(person.team.id) ?? {
      members: [],
      name: person.team.name,
    };
    team.members.push(point);
    teams.set(person.team.id, team);
  }

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const model = initial.map((point) => ({ ...point }));
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      heat = 0.18;
    const publish = () => setPoints(model.map((point) => ({ ...point })));
    const step = () => {
      frame = 0;
      tickForces(model, springs, heat, control.pinnedId);
      publish();
      heat *= 0.965;
      if (heat > 0.008 && !preference.matches) {
        frame = requestAnimationFrame(step);
      }
    };
    const control: Simulation = {
      points: model,
      publish,
      wake: () => {
        if (preference.matches) {
          publish();
          return;
        }
        heat = Math.max(heat, 0.32);
        if (!frame) {
          frame = requestAnimationFrame(step);
        }
      },
    };
    const motionChanged = () => {
      if (preference.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    simulation.current = control;
    if (!preference.matches) {
      frame = requestAnimationFrame(step);
    }
    preference.addEventListener("change", motionChanged);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", motionChanged);
      simulation.current = null;
    };
  }, [initial, springs]);

  function fit() {
    const extent = bounds(simulation.current?.points ?? points);
    setCamera({
      scale:
        (Math.min(
          size.width / (portrait ? extent.height : extent.width),
          size.height / (portrait ? extent.width : extent.height)
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
      (item) => item.id === id
    );
    if (!point) {
      return;
    }
    onSelect(id);
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
        portrait
      );
      setCamera((old) => {
        const scale = Math.max(
          0.45,
          Math.min(6, old.scale * Math.exp(-event.deltaY * 0.005))
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
        portrait
      );
      pinch.current = {
        camera,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        worldX: camera.x + delta.x / zoom,
        worldY: camera.y + delta.y / zoom,
      };
      drag.current = null;
      suppressClick.current = true;
      if (simulation.current) {
        simulation.current.pinnedId = undefined;
      }
      return;
    }
    const personElement = (event.target as Element).closest<SVGElement>(
      "[data-person]"
    );
    const id = personElement?.dataset.person;
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
    if (simulation.current) {
      simulation.current.pinnedId = id;
    }
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
            pinch.current.distance
        )
      );
      const delta = worldDelta(
        (a.x + b.x) / 2 - rect.left - size.width / 2,
        (a.y + b.y) / 2 - rect.top - size.height / 2,
        portrait
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
      portrait
    );
    if (Math.hypot(dx, dy) > 4) {
      suppressClick.current = true;
    }
    if (!suppressClick.current) {
      return;
    }
    if (drag.current.id) {
      const point = simulation.current?.points.find(
        (item) => item.id === drag.current?.id
      );
      if (point) {
        point.x = drag.current.originalX + dx / zoom;
        point.y = drag.current.originalY + dy / zoom;
        simulation.current?.wake();
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
    if (simulation.current) {
      simulation.current.pinnedId = undefined;
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
            !(event.target as Element).closest("[data-person]")
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
          {visibleKinds.has("team") &&
            [...teams].map(([id, team]) => {
              if (team.members.length < 2) {
                return null;
              }
              const left = Math.min(...team.members.map((p) => p.x)),
                right = Math.max(...team.members.map((p) => p.x));
              const top = Math.min(...team.members.map((p) => p.y)),
                bottom = Math.max(...team.members.map((p) => p.y));
              const labelX = portrait ? right + 55 : (left + right) / 2;
              const labelY = portrait ? (top + bottom) / 2 : bottom + 69;
              return (
                <g
                  key={id}
                  className="ng-team"
                  aria-label={`Equipo ${team.name}, ${team.members.length} personas`}
                >
                  <rect
                    x={left - 42}
                    y={top - 38}
                    width={right - left + 84}
                    height={bottom - top + 88}
                    rx="48"
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    transform={
                      portrait ? `rotate(-90 ${labelX} ${labelY})` : undefined
                    }
                    style={{ fontSize: portrait ? Math.max(9, 7 / zoom) : 9 }}
                  >
                    EQUIPO {team.name.toLocaleUpperCase("es")}
                  </text>
                </g>
              );
            })}
          {edges.map((edge) => {
            const a = pointById.get(edge.source),
              b = pointById.get(edge.target);
            if (!a || !b) {
              return null;
            }
            const siblings =
              pairEdges.get(JSON.stringify([edge.source, edge.target])) ?? [];
            const offset =
              (siblings.indexOf(edge) - (siblings.length - 1) / 2) * 13;
            const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
            const linked = edge.source === activeId || edge.target === activeId;
            const relevant =
              !queryActive ||
              matches.has(edge.source) ||
              matches.has(edge.target);
            return (
              <path
                key={edge.id}
                className="ng-edge"
                aria-hidden="true"
                data-kind={edge.kind}
                d={`M ${a.x} ${a.y} Q ${graphCoordinate((a.x + b.x) / 2 - ((b.y - a.y) / distance) * offset)} ${graphCoordinate((a.y + b.y) / 2 + ((b.x - a.x) / distance) * offset)} ${b.x} ${b.y}`}
                fill="none"
                stroke={CONNECTION_STYLES[edge.kind].color}
                strokeWidth={linked ? 1.8 : 0.9}
                opacity={
                  activeId ? (linked ? 0.8 : 0.055) : relevant ? 0.26 : 0.04
                }
              >
                <title>{`${peopleById.get(edge.source)?.displayName} ↔ ${peopleById.get(edge.target)?.displayName} · ${CONNECTION_STYLES[edge.kind].label}: ${edge.values.join(", ")}`}</title>
              </path>
            );
          })}
          {points.map((point) => {
            const person = peopleById.get(point.id);
            if (!person) {
              return null;
            }
            const radius = graphCoordinate(
              6 + Math.sqrt(degree.get(point.id) ?? 0) * 1.6
            );
            const highlighted = activeId === person.id;
            const relevant = activeId
              ? highlighted || neighbors.has(person.id)
              : !queryActive || matches.has(person.id);
            return (
              <g
                key={person.id}
                data-person={person.id}
                className="ng-node"
                transform={`translate(${point.x} ${point.y}) rotate(${portrait ? -90 : 0})`}
                role="button"
                tabIndex={0}
                aria-label={`Ver perfil de ${person.displayName}`}
                aria-pressed={selectedId === person.id}
                opacity={relevant ? 1 : 0.22}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!suppressClick.current) {
                    focus(person.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    focus(person.id);
                  }
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse" && !drag.current) {
                    setHoveredId(person.id);
                  }
                }}
                onPointerLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(person.id)}
                onBlur={() => setHoveredId(null)}
              >
                <title>{`${person.displayName} · ${person.role} · ${person.city}${person.team ? ` · Equipo ${person.team.name}` : ""}`}</title>
                <circle
                  r={graphCoordinate(
                    Math.min(
                      Math.max(22, 20 / zoom),
                      Math.min(
                        ...points
                          .filter((p) => p.id !== point.id)
                          .map((p) => Math.hypot(p.x - point.x, p.y - point.y))
                      ) * 0.45
                    )
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
                <circle
                  r={radius}
                  fill={
                    highlighted
                      ? "#cc291f"
                      : neighbors.has(person.id)
                        ? "#48463f"
                        : "#928f86"
                  }
                  stroke="var(--ng-paper)"
                  strokeWidth="2"
                />
                <text
                  style={{ fontSize: portrait ? Math.max(12, 10 / zoom) : 12 }}
                  y={radius + (portrait ? Math.max(18, 13 / zoom) : 18)}
                  textAnchor="middle"
                  className={
                    highlighted
                      ? "ng-node-name ng-node-name-active"
                      : "ng-node-name"
                  }
                >
                  {portrait && !highlighted
                    ? person.displayName.split(" ")[0]
                    : person.displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="ng-map-caption">
        <span className="ng-status-dot" />
        {selectedId
          ? `Conexiones de ${peopleById.get(selectedId)?.displayName}`
          : "VISTA GLOBAL"}
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
