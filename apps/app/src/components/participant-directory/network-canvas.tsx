"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, Ref } from "react";
import { Minus, Plus, Scan, X } from "lucide-react";
import {
  HUB_STYLES,
  initialPoints,
  networkSprings,
  tickForces,
} from "./network-model";
import type { GraphPoint, HubKind, Network } from "./network-model";

export interface NetworkHandle {
  focus: (id: string) => void;
  clear: () => void;
}
type Camera = { x: number; y: number; scale: number };
type Simulation = {
  points: GraphPoint[];
  pinnedId?: string;
  wake: () => void;
};
type Drag = {
  id?: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  camera: Camera;
};

const MIN_SCALE = 0.45;
const MAX_SCALE = 6;
const CAMERA_MS = 280;
// Below this zoom people are anonymous dots until hovered, selected or matched.
const NAMES_ZOOM = 0.85;

function clampScale(scale: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function bounds(points: GraphPoint[]) {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs) - 90,
    right = Math.max(...xs) + 90;
  // Extra room below for the two-line labels and the zoom controls.
  const top = Math.min(...ys) - 70,
    bottom = Math.max(...ys) + 150;
  return {
    height: bottom - top,
    width: right - left,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

/** Splits a long label at the space nearest its middle so hub names stay narrow. */
function wrapLabel(label: string): string[] {
  if (label.length <= 16 || !label.includes(" ")) {
    return [label];
  }
  const middle = label.length / 2;
  let cut = label.indexOf(" ");
  for (const match of label.matchAll(/ /g)) {
    if (Math.abs(match.index - middle) < Math.abs(cut - middle)) {
      cut = match.index;
    }
  }
  return [label.slice(0, cut), label.slice(cut + 1)];
}

function fitScale(
  extent: ReturnType<typeof bounds>,
  size: { width: number; height: number }
) {
  return (
    Math.min(size.width / extent.width, size.height / extent.height) * 0.88
  );
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
  visibleKinds: Set<HubKind>;
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
  const cameraFrame = useRef(0);
  const fitZoom = fitScale(initialBounds, size);
  const zoom = fitZoom * camera.scale;
  // Glyphs and labels keep their on-screen size while positions zoom, so the
  // map stays readable at fit and nodes do not balloon when zoomed in.
  const k = 1 / Math.min(Math.max(zoom, 0.5), 2);
  const personRadius = 7 * k;
  const showNames = zoom >= NAMES_ZOOM;

  const hubs = useMemo(
    () => network.hubs.filter((hub) => visibleKinds.has(hub.kind)),
    [network, visibleKinds]
  );
  const edges = useMemo(
    () => network.edges.filter((edge) => visibleKinds.has(edge.kind)),
    [network, visibleKinds]
  );
  const pointById = new Map(points.map((point) => [point.id, point]));
  const hubById = new Map(hubs.map((hub) => [hub.id, hub]));
  const personById = new Map(
    network.participants.map((person) => [person.id, person])
  );

  // Selection dims the rest of the map: a person lights its hubs and everyone
  // on them, a hub lights its members. Hover only emphasises direct edges.
  const selectedHub = selectedId ? hubById.get(selectedId) : undefined;
  const litHubs = new Set<string>(
    selectedHub
      ? [selectedHub.id]
      : edges
          .filter((edge) => edge.person === selectedId)
          .map((edge) => edge.hub)
  );
  const litPeople = new Set<string>(
    hubs.filter((hub) => litHubs.has(hub.id)).flatMap((hub) => hub.members)
  );
  if (selectedId && personById.has(selectedId)) {
    litPeople.add(selectedId);
  }
  const hoveredEdges = new Set(
    edges
      .filter((edge) => edge.person === hoveredId || edge.hub === hoveredId)
      .map((edge) => edge.id)
  );
  const hoveredPeople = new Set(
    hoveredId ? (hubById.get(hoveredId)?.members ?? [hoveredId]) : []
  );

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

  useEffect(() => () => cancelAnimationFrame(cameraFrame.current), []);

  /** Eases the camera to `target` so the user keeps their bearings. */
  function moveCamera(target: Camera) {
    cancelAnimationFrame(cameraFrame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCamera(target);
      return;
    }
    const from = camera;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / CAMERA_MS);
      const e = 1 - (1 - t) ** 3;
      setCamera({
        scale: Math.exp(
          Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * e
        ),
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
      });
      if (t < 1) {
        cameraFrame.current = requestAnimationFrame(step);
      }
    };
    cameraFrame.current = requestAnimationFrame(step);
  }
  function stopCamera() {
    cancelAnimationFrame(cameraFrame.current);
  }

  function fit() {
    const extent = bounds(simulation.current?.points ?? points);
    moveCamera({
      scale: fitScale(extent, size) / fitZoom,
      x: extent.x,
      y: extent.y,
    });
  }
  function clear() {
    onSelect(null);
    setHoveredId(null);
    fit();
  }
  /** Selects a node and frames everything it lights up. */
  function focus(id: string) {
    const current = simulation.current?.points ?? points;
    const target = current.find((item) => item.id === id);
    if (!target) {
      return;
    }
    onSelect(id);
    const hub = hubById.get(id);
    const hubIds = hub
      ? [hub.id]
      : edges.filter((edge) => edge.person === id).map((edge) => edge.hub);
    const around = new Set([
      id,
      ...hubIds,
      ...hubs
        .filter((item) => hubIds.includes(item.id))
        .flatMap((item) => item.members),
    ]);
    const extent = bounds(current.filter((item) => around.has(item.id)));
    moveCamera({
      scale: Math.max(1, Math.min(2.6 / fitZoom, fitScale(extent, size) / fitZoom)),
      x: extent.x,
      y: extent.y,
    });
  }
  useImperativeHandle(ref, () => ({ clear, focus }));

  function zoomAt(nextScale: number, x: number, y: number) {
    const scale = clampScale(nextScale);
    const dx = x - size.width / 2,
      dy = y - size.height / 2;
    moveCamera({
      scale,
      x: camera.x + dx / zoom - dx / (fitZoom * scale),
      y: camera.y + dy / zoom - dy / (fitZoom * scale),
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
      cancelAnimationFrame(cameraFrame.current);
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left - size.width / 2,
        y = event.clientY - rect.top - size.height / 2;
      setCamera((old) => {
        const scale = clampScale(old.scale * Math.exp(-event.deltaY * 0.005));
        return {
          scale,
          x: old.x + x / (fitZoom * old.scale) - x / (fitZoom * scale),
          y: old.y + y / (fitZoom * old.scale) - y / (fitZoom * scale),
        };
      });
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [size, fitZoom]);

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }
    stopCamera();
    const svg = event.currentTarget;
    svg.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = svg.getBoundingClientRect();
      const dx = (a.x + b.x) / 2 - rect.left - size.width / 2,
        dy = (a.y + b.y) / 2 - rect.top - size.height / 2;
      pinch.current = {
        camera,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        worldX: camera.x + dx / zoom,
        worldY: camera.y + dy / zoom,
      };
      drag.current = null;
      suppressClick.current = true;
      if (simulation.current) {
        simulation.current.pinnedId = undefined;
      }
      return;
    }
    const id = (event.target as Element).closest<SVGElement>("[data-node]")
      ?.dataset.node;
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
      const scale = clampScale(
        (pinch.current.camera.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
          pinch.current.distance
      );
      const dx = (a.x + b.x) / 2 - rect.left - size.width / 2,
        dy = (a.y + b.y) / 2 - rect.top - size.height / 2;
      setCamera({
        scale,
        x: pinch.current.worldX - dx / (fitZoom * scale),
        y: pinch.current.worldY - dy / (fitZoom * scale),
      });
      return;
    }
    if (!drag.current) {
      return;
    }
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
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

  function nodeHandlers(id: string) {
    return {
      onBlur: () => setHoveredId(null),
      onClick: (event: MouseEvent) => {
        event.stopPropagation();
        if (!suppressClick.current) {
          focus(id);
        }
      },
      onFocus: () => setHoveredId(id),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          focus(id);
        }
      },
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === "mouse" && !drag.current) {
          setHoveredId(id);
        }
      },
      onPointerLeave: () => setHoveredId(null),
    };
  }

  function edgeOpacity(edge: (typeof edges)[number]) {
    if (hoveredEdges.has(edge.id)) {
      return 1;
    }
    if (selectedId) {
      if (edge.person === selectedId || edge.hub === selectedId) {
        return 1;
      }
      return litHubs.has(edge.hub) ? 0.6 : 0.06;
    }
    if (queryActive) {
      return matches.has(edge.person) || matches.has(edge.hub) ? 0.7 : 0.06;
    }
    return 0.45;
  }

  return (
    <div className="ng-viewport" ref={viewportRef}>
      <svg
        ref={svgRef}
        className="ng-canvas"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        tabIndex={0}
        aria-label="Grafo de participantes. Arrastra los nodos o el fondo. Usa los controles para ampliar."
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
        onDoubleClick={(event) => {
          if ((event.target as Element).closest("[data-node]")) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          zoomAt(
            camera.scale * 1.6,
            event.clientX - rect.left,
            event.clientY - rect.top
          );
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
            stopCamera();
            setCamera((old) => ({
              ...old,
              x: old.x + direction[0] / zoom,
              y: old.y + direction[1] / zoom,
            }));
          }
        }}
      >
        <g
          transform={`translate(${size.width / 2} ${size.height / 2}) scale(${zoom}) translate(${-camera.x} ${-camera.y})`}
        >
          {edges.map((edge) => {
            const a = pointById.get(edge.person),
              b = pointById.get(edge.hub);
            if (!a || !b) {
              return null;
            }
            const strong =
              hoveredEdges.has(edge.id) ||
              edge.person === selectedId ||
              edge.hub === selectedId;
            return (
              <line
                key={edge.id}
                className="ng-edge"
                aria-hidden="true"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={HUB_STYLES[edge.kind].color}
                strokeWidth={strong ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                opacity={edgeOpacity(edge)}
              />
            );
          })}
          {hubs.map((hub) => {
            const point = pointById.get(hub.id);
            if (!point) {
              return null;
            }
            const side = (26 + Math.sqrt(hub.members.length) * 6) * k;
            const dim = selectedId
              ? !litHubs.has(hub.id)
              : queryActive && !matches.has(hub.id);
            return (
              <g
                key={hub.id}
                data-node={hub.id}
                className="ng-node ng-hub"
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${HUB_STYLES[hub.kind].label} ${hub.label}, ${hub.members.length} personas`}
                aria-pressed={selectedId === hub.id}
                opacity={dim ? 0.25 : 1}
                {...nodeHandlers(hub.id)}
              >
                <rect
                  x={-side / 2 + 4 * k}
                  y={-side / 2 + 4 * k}
                  width={side}
                  height={side}
                  fill="var(--color-hs-ink)"
                />
                <rect
                  x={-side / 2}
                  y={-side / 2}
                  width={side}
                  height={side}
                  fill={HUB_STYLES[hub.kind].color}
                  stroke={
                    selectedId === hub.id
                      ? "var(--color-hs-red)"
                      : "var(--color-hs-ink)"
                  }
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  className="ng-hub-count"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={14 * k}
                  fill={
                    hub.kind === "team"
                      ? "var(--color-hs-ink)"
                      : "var(--color-hs-paper)"
                  }
                >
                  {hub.members.length}
                </text>
                <text
                  className="ng-hub-name"
                  y={side / 2 + 16 * k}
                  textAnchor="middle"
                  fontSize={10 * k}
                  strokeWidth={4 * k}
                >
                  {wrapLabel(hub.label.toLocaleUpperCase("es")).map(
                    (line, index) => (
                      <tspan key={line} x="0" dy={index ? 12 * k : 0}>
                        {line}
                      </tspan>
                    )
                  )}
                </text>
              </g>
            );
          })}
          {network.participants.map((person) => {
            const point = pointById.get(person.id);
            if (!point) {
              return null;
            }
            const selected = selectedId === person.id;
            const lit = litPeople.has(person.id) || hoveredPeople.has(person.id);
            const matched = queryActive && matches.has(person.id);
            const dim = selectedId
              ? !litPeople.has(person.id) && !hoveredPeople.has(person.id)
              : queryActive && !matched;
            const named = showNames || lit || matched || hoveredId === person.id;
            return (
              <g
                key={person.id}
                data-node={person.id}
                className="ng-node"
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Ver perfil de ${person.displayName}`}
                aria-pressed={selected}
                opacity={dim ? 0.25 : 1}
                {...nodeHandlers(person.id)}
              >
                <title>{`${person.displayName} · ${person.role}`}</title>
                <circle r={Math.max(22 * k, personRadius * 2)} fill="transparent" />
                <circle
                  r={personRadius}
                  fill={
                    selected
                      ? "var(--color-hs-red)"
                      : lit
                        ? "var(--color-hs-ink)"
                        : "var(--color-hs-paper)"
                  }
                  stroke={
                    selected ? "var(--color-hs-red)" : "var(--color-hs-ink)"
                  }
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
                {named && (
                  <text
                    className={
                      selected
                        ? "ng-person-name ng-person-name-active"
                        : "ng-person-name"
                    }
                    y={personRadius + 15 * k}
                    textAnchor="middle"
                    fontSize={12 * k}
                    strokeWidth={4 * k}
                  >
                    {person.displayName}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="ng-map-controls">
        {selectedId && (
          <button type="button" onClick={clear} aria-label="Quitar selección">
            <X size={18} strokeWidth={2.5} />
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            zoomAt(camera.scale / 1.4, size.width / 2, size.height / 2)
          }
          aria-label="Alejar grafo"
          disabled={camera.scale <= MIN_SCALE}
        >
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button type="button" onClick={fit} aria-label="Encajar todo el grafo">
          <Scan size={18} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() =>
            zoomAt(camera.scale * 1.4, size.width / 2, size.height / 2)
          }
          aria-label="Acercar grafo"
          disabled={camera.scale >= MAX_SCALE}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
      {!hubs.length && (
        <p className="ng-map-notice">
          Activa algún tipo de nodo para ver conexiones.
        </p>
      )}
    </div>
  );
}
