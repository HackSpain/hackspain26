"use client";

import {
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { PointerEvent as ReactPointerEvent, Ref } from "react";
import { gsap } from "gsap";
import { initialsOf } from "@/components/avatar";
import type { AffinityKind } from "./affinities";
import {
	clusterParticipants,
	clustersOverlap,
	createLayout,
	initialPoints,
	labelDirections,
	layoutBounds,
	NODE_RADIUS,
	placeClusters,
	wordmarkBox,
	ZONE_HALO,
} from "./network-model";
import type { GraphPoint, Lens, Link } from "./network-model";
import type { DirectoryParticipant } from "./types";

export const CONNECTION_STYLES: Record<
	AffinityKind,
	{ label: string; color: string }
> = {
	city: { color: "#d96b2a", label: "Ciudad" },
	company: { color: "#35858a", label: "Empresa" },
	degree: { color: "#7a5ea7", label: "Grado" },
	interests: { color: "#c2456c", label: "Intereses" },
	skills: { color: "#4f86a8", label: "Habilidades" },
	team: { color: "#b8860b", label: "Equipo" },
	university: { color: "#1e3958", label: "Universidad" },
};

export interface NetworkHandle {
	focus: (id: string) => void;
	clear: () => void;
	fit: () => void;
	zoom: (factor: number) => void;
}

type Camera = { x: number; y: number; scale: number };
type NodeState = "" | "active" | "linked" | "match";
type Drag = {
	id?: string;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	moved: boolean;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

function clampScale(scale: number) {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function reducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

function linkPath(a: GraphPoint, b: GraphPoint) {
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const distance = Math.hypot(dx, dy) || 1;
	// A gentle, consistent bow keeps parallel links apart and reads as organic.
	const bow = Math.min(60, distance * 0.14) * (a.id < b.id ? 1 : -1);
	const cx = (a.x + b.x) / 2 - (dy / distance) * bow;
	const cy = (a.y + b.y) / 2 + (dx / distance) * bow;
	return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

const PersonNode = memo(function PersonNode({
	person,
	state,
	register,
	onPointerEnter,
	onPointerLeave,
	onActivate,
}: {
	person: DirectoryParticipant;
	state: NodeState;
	register: (id: string, element: SVGGElement | null) => void;
	onPointerEnter: (id: string, pointerType: string) => void;
	onPointerLeave: () => void;
	onActivate: (id: string) => void;
}) {
	const initials = initialsOf(person.displayName);
	return (
		<g
			ref={(element) => register(person.id, element)}
			className="pg-node"
			data-node={person.id}
			data-state={state || undefined}
			data-me={person.isMe ? "" : undefined}
			role="button"
			tabIndex={0}
			aria-label={`${person.displayName}, ${person.role}, ${person.city}`}
			aria-pressed={state === "active"}
			onPointerEnter={(event) => onPointerEnter(person.id, event.pointerType)}
			onPointerLeave={onPointerLeave}
			onFocus={() => onPointerEnter(person.id, "keyboard")}
			onBlur={onPointerLeave}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					event.stopPropagation();
					onActivate(person.id);
				}
			}}
		>
			<g className="pg-node-body">
				<circle className="pg-node-halo" r={NODE_RADIUS + 7} />
				<circle className="pg-node-disc" r={NODE_RADIUS} />
				{person.photoUrl ? (
					<image
						className="pg-node-photo"
						href={person.photoUrl}
						x={-NODE_RADIUS}
						y={-NODE_RADIUS}
						width={NODE_RADIUS * 2}
						height={NODE_RADIUS * 2}
						clipPath="url(#pg-clip)"
						preserveAspectRatio="xMidYMid slice"
					/>
				) : (
					<text
						className="pg-node-initials"
						textAnchor="middle"
						dominantBaseline="central"
						aria-hidden="true"
					>
						{initials}
					</text>
				)}
				<circle className="pg-node-ring" r={NODE_RADIUS} />
			</g>
			<text
				className="pg-node-name"
				y={NODE_RADIUS + 16}
				textAnchor="middle"
				aria-hidden="true"
			>
				{person.displayName}
			</text>
		</g>
	);
});

export function NetworkCanvas({
	participants,
	lens,
	selectedId,
	matches,
	linksOf,
	panelLeft,
	onSelect,
	ref,
}: {
	participants: DirectoryParticipant[];
	lens: Lens;
	selectedId: string | null;
	/** People matching the search, or null when there is no query. */
	matches: Set<string> | null;
	linksOf: (id: string) => Link[];
	/** Where the floating profile's left edge lands, so focus centres in the free area. */
	panelLeft: (viewportWidth: number) => number | null;
	onSelect: (id: string | null) => void;
	ref?: Ref<NetworkHandle>;
}) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const worldRef = useRef<SVGGElement>(null);
	const nodeElements = useRef(new Map<string, SVGGElement>());
	const linkElements = useRef(
		new Map<string, { element: SVGPathElement; a: string; b: string }>(),
	);
	const points = useRef(new Map<string, GraphPoint>());
	const camera = useRef<Camera>({ scale: 1, x: 0, y: 0 });
	const cameraTween = useRef<gsap.core.Tween | null>(null);
	// Wheel zoom eases towards a target scale while the point under the pointer stays put.
	const zoomTween = useRef<gsap.core.Tween | null>(null);
	const zoomState = useRef({
		anchorX: 0,
		anchorY: 0,
		dx: 0,
		dy: 0,
		proxy: { scale: 1 },
		target: 1,
	});
	const zonesRef = useRef<SVGGElement>(null);
	const nodesRef = useRef<SVGGElement>(null);
	const introPlayed = useRef(false);
	const alpha = useRef(0);
	const frame = useRef(0);
	const drag = useRef<Drag | null>(null);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinch = useRef<{
		distance: number;
		scale: number;
		worldX: number;
		worldY: number;
	} | null>(null);
	const [size, setSize] = useState({ height: 0, width: 0 });
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [fitted, setFitted] = useState(false);

	const clusters = useMemo(
		() => clusterParticipants(participants, lens),
		[participants, lens],
	);
	const aspect = size.height
		? Math.max(
				0.6,
				Math.min(2.4, Math.round((size.width / size.height) * 2) / 2),
			)
		: 1.6;
	const places = useMemo(
		() => placeClusters(clusters, aspect),
		[clusters, aspect],
	);
	const bounds = useMemo(() => layoutBounds(places), [places]);
	const venn = useMemo(() => clustersOverlap(clusters), [clusters]);
	// Text labels sit just outside the halo, facing away from any overlap.
	// Wordmarks are watermarked at the centre instead (see the zone markup).
	const labelAt = useMemo(() => {
		const directions = labelDirections(clusters, places);
		return places.map((place, index) => {
			const direction = directions[index];
			const half =
				(Math.abs(direction.x) * clusters[index].label.length * 7.5 +
					Math.abs(direction.y) * 12) /
				2;
			const reach = place.r * ZONE_HALO + 10 + half;
			return {
				x: place.x + direction.x * reach,
				y: place.y + direction.y * reach,
			};
		});
	}, [clusters, places]);
	const peopleById = useMemo(
		() => new Map(participants.map((person) => [person.id, person])),
		[participants],
	);
	const activeId = selectedId ?? hoveredId;
	const activeLinks = useMemo(
		() => (activeId && peopleById.has(activeId) ? linksOf(activeId) : []),
		[activeId, peopleById, linksOf],
	);
	const linkedIds = useMemo(
		() => new Set(activeLinks.map((link) => link.participant.id)),
		[activeLinks],
	);
	const mode = selectedId
		? "focus"
		: hoveredId
			? "peek"
			: matches
				? "search"
				: "rest";

	// --- camera -------------------------------------------------------------
	const applyCamera = useCallback(() => {
		const { x, y, scale } = camera.current;
		const world = worldRef.current;
		const svg = svgRef.current;
		if (!world || !svg) {
			return;
		}
		world.setAttribute(
			"transform",
			`translate(${size.width / 2} ${size.height / 2}) scale(${scale}) translate(${-x} ${-y})`,
		);
	}, [size]);

	const stopTweens = useCallback(() => {
		cameraTween.current?.kill();
		zoomTween.current?.kill();
		cameraTween.current = null;
		zoomTween.current = null;
	}, []);

	const moveCamera = useCallback(
		(target: Camera, animated: boolean) => {
			stopTweens();
			if (!animated || reducedMotion()) {
				camera.current = target;
				applyCamera();
				return;
			}
			cameraTween.current = gsap.to(camera.current, {
				...target,
				duration: 0.75,
				ease: "power3.out",
				onUpdate: applyCamera,
				overwrite: true,
			});
		},
		[applyCamera, stopTweens],
	);

	const fitCamera = useCallback(
		(animated: boolean) => {
			if (!size.width || !size.height) {
				return;
			}
			const scale = clampScale(
				Math.min(
					(size.width - 48) / bounds.width,
					(size.height - 96) / bounds.height,
				),
			);
			moveCamera({ scale, x: bounds.x, y: bounds.y }, animated);
		},
		[size, bounds, moveCamera],
	);

	/**
	 * Zoom by a factor around a screen point. Successive calls (a wheel burst)
	 * accumulate into one eased tween, so the zoom feels inertial rather than
	 * stepped; the world point under the pointer never drifts.
	 */
	const zoomAt = useCallback(
		(factor: number, screenX: number, screenY: number) => {
			cameraTween.current?.kill();
			cameraTween.current = null;
			const zoom = zoomState.current;
			const current = camera.current;
			if (!zoomTween.current?.isActive()) {
				zoom.target = current.scale;
				zoom.proxy.scale = current.scale;
			}
			zoom.target = clampScale(zoom.target * factor);
			zoom.dx = screenX - size.width / 2;
			zoom.dy = screenY - size.height / 2;
			zoom.anchorX = current.x + zoom.dx / current.scale;
			zoom.anchorY = current.y + zoom.dy / current.scale;
			const place = (scale: number) => {
				camera.current = {
					scale,
					x: zoom.anchorX - zoom.dx / scale,
					y: zoom.anchorY - zoom.dy / scale,
				};
				applyCamera();
			};
			if (reducedMotion()) {
				zoom.proxy.scale = zoom.target;
				place(zoom.target);
				return;
			}
			zoomTween.current = gsap.to(zoom.proxy, {
				duration: 0.5,
				ease: "power2.out",
				onUpdate: () => place(zoom.proxy.scale),
				overwrite: true,
				scale: zoom.target,
			});
		},
		[size, applyCamera],
	);

	// --- simulation ---------------------------------------------------------
	const paint = useCallback(() => {
		for (const [id, element] of nodeElements.current) {
			const point = points.current.get(id);
			if (point) {
				element.setAttribute(
					"transform",
					`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`,
				);
			}
		}
		for (const { element, a, b } of linkElements.current.values()) {
			const from = points.current.get(a),
				to = points.current.get(b);
			if (from && to) {
				element.setAttribute("d", linkPath(from, to));
			}
		}
	}, []);

	const layout = useMemo(() => {
		const carried = points.current;
		const fresh = initialPoints(clusters, places);
		const next = new Map<string, GraphPoint>();
		for (const point of fresh) {
			// Members keep their spot across lens changes and flow to the new cluster.
			next.set(point.id, carried.get(point.id) ?? point);
		}
		points.current = next;
		return createLayout([...next.values()], clusters, places);
	}, [clusters, places]);

	const wake = useCallback(
		(target: number) => {
			alpha.current = Math.max(alpha.current, target);
			if (frame.current) {
				return;
			}
			const step = () => {
				frame.current = 0;
				const dragging = drag.current?.moved ? drag.current.id : undefined;
				if (dragging) {
					alpha.current = Math.max(alpha.current, 0.25);
				}
				layout.tick(alpha.current, dragging);
				paint();
				alpha.current *= 0.97;
				if (alpha.current > 0.004 || dragging) {
					frame.current = requestAnimationFrame(step);
				}
			};
			frame.current = requestAnimationFrame(step);
		},
		[layout, paint],
	);

	useEffect(() => {
		if (reducedMotion()) {
			for (let i = 0; i < 260; i++) {
				layout.tick(0.98 ** i);
			}
			paint();
			return;
		}
		wake(1);
		return () => {
			cancelAnimationFrame(frame.current);
			frame.current = 0;
		};
	}, [layout, paint, wake]);

	// Links mount after the loop may have gone idle: give them geometry at once.
	useLayoutEffect(paint, [activeLinks, paint]);

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

	useLayoutEffect(applyCamera, [applyCamera]);
	useLayoutEffect(() => {
		if (!size.width || !size.height) {
			return;
		}
		fitCamera(fitted);
		if (!fitted) {
			// oxlint-disable-next-line react/set-state-in-effect -- the first fit depends on the measured size.
			setFitted(true);
		}
		// Only refit when the layout itself changes, not on selection.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [bounds, size.width, size.height]);

	// --- choreography -------------------------------------------------------
	// Clusters bloom in whenever the lens changes; people only on the first visit,
	// after which the simulation carries them between clusters.
	useLayoutEffect(() => {
		const zones = zonesRef.current;
		if (!zones || reducedMotion()) {
			introPlayed.current = true;
			return;
		}
		const circles = zones.querySelectorAll(".pg-zone circle");
		const labels = zones.querySelectorAll(".pg-zone-logo, .pg-zone-label");
		const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
		timeline.from(circles, {
			duration: 0.8,
			opacity: 0,
			scale: 0.6,
			stagger: { amount: 0.4, from: "center" },
			transformOrigin: "50% 50%",
		});
		timeline.from(
			labels,
			{
				clearProps: "all",
				duration: 0.5,
				opacity: 0,
				stagger: { amount: 0.3 },
				y: 6,
			},
			"-=0.5",
		);
		if (!introPlayed.current) {
			introPlayed.current = true;
			const bodies = nodesRef.current?.querySelectorAll(".pg-node-body") ?? [];
			timeline.from(
				bodies,
				{
					clearProps: "all",
					duration: 0.6,
					ease: "back.out(1.7)",
					opacity: 0,
					scale: 0,
					stagger: { amount: 1, from: "random" },
					transformOrigin: "50% 50%",
				},
				"-=0.4",
			);
		}
		return () => {
			// Interrupted (a lens change mid-intro, or React's dev double mount):
			// put everything back and let the next run bloom the people again.
			if (timeline.progress() < 1) {
				introPlayed.current = false;
			}
			timeline.revert();
		};
	}, [clusters]);

	useEffect(() => stopTweens, [stopTweens]);

	// --- selection ----------------------------------------------------------
	const focus = useCallback(
		(id: string) => {
			const point = points.current.get(id);
			if (!point) {
				return;
			}
			onSelect(id);
			// Centre the person in whatever the panel leaves free.
			const free = panelLeft(size.width);
			const offset = free === null ? 0 : size.width / 2 - free / 2;
			const scale = clampScale(Math.max(camera.current.scale, 0.9));
			moveCamera({ scale, x: point.x + offset / scale, y: point.y }, true);
		},
		[onSelect, size.width, panelLeft, moveCamera],
	);
	const clear = useCallback(() => {
		onSelect(null);
		setHoveredId(null);
		fitCamera(true);
	}, [onSelect, fitCamera]);
	useImperativeHandle(
		ref,
		() => ({
			clear,
			fit: () => fitCamera(true),
			focus,
			zoom: (factor: number) => zoomAt(factor, size.width / 2, size.height / 2),
		}),
		[clear, fitCamera, focus, size, zoomAt],
	);

	const register = useCallback((id: string, element: SVGGElement | null) => {
		if (element) {
			nodeElements.current.set(id, element);
			const point = points.current.get(id);
			if (point) {
				element.setAttribute(
					"transform",
					`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`,
				);
			}
		} else {
			nodeElements.current.delete(id);
		}
	}, []);
	const enter = useCallback((id: string, pointerType: string) => {
		if (pointerType !== "touch" && !drag.current?.moved) {
			setHoveredId(id);
		}
	}, []);
	const leave = useCallback(() => setHoveredId(null), []);

	// --- gestures -----------------------------------------------------------
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) {
			return;
		}
		// Scrolling zooms around the pointer, like a map. Trackpad pinches arrive
		// as ctrl+wheel with finer deltas, so they get a gentler curve.
		// Scrolling zooms around the pointer, like a map. Trackpad pinches arrive
		// as ctrl+wheel with finer deltas, so they get a gentler curve.
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			const rect = svg.getBoundingClientRect();
			zoomAt(
				Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0022)),
				event.clientX - rect.left,
				event.clientY - rect.top,
			);
		};
		svg.addEventListener("wheel", wheel, { passive: false });
		return () => svg.removeEventListener("wheel", wheel);
	});

	function screenToWorld(clientX: number, clientY: number) {
		const rect = svgRef.current?.getBoundingClientRect();
		const { x, y, scale } = camera.current;
		return {
			x: x + (clientX - (rect?.left ?? 0) - size.width / 2) / scale,
			y: y + (clientY - (rect?.top ?? 0) - size.height / 2) / scale,
		};
	}

	function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
		if (event.button !== 0) {
			return;
		}
		stopTweens();
		const svg = event.currentTarget;
		svg.setPointerCapture(event.pointerId);
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			const middle = screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
			pinch.current = {
				distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
				scale: camera.current.scale,
				worldX: middle.x,
				worldY: middle.y,
			};
			drag.current = null;
			return;
		}
		const id = (event.target as Element).closest<SVGElement>("[data-node]")
			?.dataset.node;
		const point = id ? points.current.get(id) : undefined;
		drag.current = {
			id,
			moved: false,
			originX: point?.x ?? camera.current.x,
			originY: point?.y ?? camera.current.y,
			startX: event.clientX,
			startY: event.clientY,
		};
	}
	function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		if (!pointers.current.has(event.pointerId)) {
			return;
		}
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		if (pinch.current && pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			const scale = clampScale(
				(pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
					pinch.current.distance,
			);
			const rect = event.currentTarget.getBoundingClientRect();
			const dx = (a.x + b.x) / 2 - rect.left - size.width / 2;
			const dy = (a.y + b.y) / 2 - rect.top - size.height / 2;
			camera.current = {
				scale,
				x: pinch.current.worldX - dx / scale,
				y: pinch.current.worldY - dy / scale,
			};
			applyCamera();
			return;
		}
		const current = drag.current;
		if (!current) {
			return;
		}
		const dx = event.clientX - current.startX,
			dy = event.clientY - current.startY;
		if (!current.moved && Math.hypot(dx, dy) < 4) {
			return;
		}
		if (!current.moved) {
			current.moved = true;
			setHoveredId(null);
			if (current.id) {
				wake(0.25);
			}
		}
		const { scale } = camera.current;
		if (current.id) {
			const point = points.current.get(current.id);
			if (point) {
				point.x = current.originX + dx / scale;
				point.y = current.originY + dy / scale;
			}
		} else {
			camera.current = {
				scale,
				x: current.originX - dx / scale,
				y: current.originY - dy / scale,
			};
			applyCamera();
		}
	}
	function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		const current = drag.current;
		if (
			event.type === "pointerup" &&
			current &&
			!current.moved &&
			!pinch.current
		) {
			if (current.id) {
				focus(current.id);
			} else {
				onSelect(null);
			}
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

	const activeLinkList = useMemo(
		() =>
			activeId
				? activeLinks.map((link) => ({
						a: activeId,
						b: link.participant.id,
						kind: link.affinities[0]?.kind ?? "skills",
					}))
				: [],
		[activeId, activeLinks],
	);

	return (
		<div className="pg-viewport" ref={viewportRef}>
			<svg
				ref={svgRef}
				className="pg-canvas"
				data-mode={mode}
				role="application"
				tabIndex={0}
				aria-label="Mapa de participantes. Arrastra para moverte, usa la rueda o pellizca para ampliar."
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onLostPointerCapture={onPointerUp}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						clear();
						return;
					}
					if (event.key === "+" || event.key === "=") {
						zoomAt(1.3, size.width / 2, size.height / 2);
						return;
					}
					if (event.key === "-") {
						zoomAt(1 / 1.3, size.width / 2, size.height / 2);
						return;
					}
					const direction = {
						ArrowDown: [0, 80],
						ArrowLeft: [-80, 0],
						ArrowRight: [80, 0],
						ArrowUp: [0, -80],
					}[event.key];
					if (direction) {
						event.preventDefault();
						const { scale, x, y } = camera.current;
						moveCamera(
							{
								scale,
								x: x + direction[0] / scale,
								y: y + direction[1] / scale,
							},
							true,
						);
					}
				}}
			>
				<defs>
					<clipPath id="pg-clip">
						<circle r={NODE_RADIUS} />
					</clipPath>
					<radialGradient id="pg-zone">
						<stop offset="0%" stopColor="var(--pg-zone)" stopOpacity="0.9" />
						<stop offset="62%" stopColor="var(--pg-zone)" stopOpacity="0.55" />
						<stop offset="100%" stopColor="var(--pg-zone)" stopOpacity="0" />
					</radialGradient>
				</defs>
				<g ref={worldRef}>
					<g
						ref={zonesRef}
						className="pg-zones"
						data-venn={venn ? "" : undefined}
						aria-hidden="true"
					>
						{clusters.map((cluster, index) => {
							const place = places[index];
							const label = labelAt[index];
							return (
								<g
									key={cluster.id}
									className="pg-zone"
									data-loose={cluster.loose ? "" : undefined}
								>
									<circle
										cx={place.x}
										cy={place.y}
										r={place.r * ZONE_HALO}
										fill="url(#pg-zone)"
									/>
									{cluster.logoUrl ? (
										<>
											<image
												className="pg-zone-logo"
												href={cluster.logoUrl}
												x={
													place.x -
													wordmarkBox(cluster.memberIds.length).width / 2
												}
												y={
													place.y -
													wordmarkBox(cluster.memberIds.length).height / 2
												}
												width={wordmarkBox(cluster.memberIds.length).width}
												height={wordmarkBox(cluster.memberIds.length).height}
												preserveAspectRatio="xMidYMid meet"
											/>
											<text
												className="pg-zone-label"
												x={place.x}
												y={
													place.y +
													wordmarkBox(cluster.memberIds.length).height / 2 +
													13
												}
												textAnchor="middle"
											>
												<tspan className="pg-zone-count">
													{cluster.memberIds.length}
												</tspan>
											</text>
										</>
									) : (
										<text
											className="pg-zone-label"
											x={label.x}
											y={label.y}
											dominantBaseline="central"
											textAnchor="middle"
										>
											{cluster.label}
											<tspan className="pg-zone-count" dx="7">
												{cluster.memberIds.length}
											</tspan>
										</text>
									)}
								</g>
							);
						})}
					</g>
					<g className="pg-links" aria-hidden="true">
						{activeLinkList.map(({ a, b, kind }) => (
							<path
								key={`${a}|${b}`}
								className="pg-link"
								ref={(element) => {
									const key = `${a}|${b}`;
									if (element) {
										linkElements.current.set(key, { a, b, element });
									} else {
										linkElements.current.delete(key);
									}
								}}
								stroke={CONNECTION_STYLES[kind].color}
								fill="none"
							/>
						))}
					</g>
					<g className="pg-nodes" ref={nodesRef}>
						{participants.map((person) => (
							<PersonNode
								key={person.id}
								person={person}
								state={
									activeId === person.id
										? "active"
										: linkedIds.has(person.id)
											? "linked"
											: matches?.has(person.id)
												? "match"
												: ""
								}
								register={register}
								onPointerEnter={enter}
								onPointerLeave={leave}
								onActivate={focus}
							/>
						))}
					</g>
				</g>
			</svg>
		</div>
	);
}
