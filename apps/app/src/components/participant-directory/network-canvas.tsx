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
	SETTLED,
	stickySlots,
	symbolBox,
	ZONE_HALO,
} from "./network-model";
import type { GraphPoint, Layout, Lens, Link } from "./network-model";
import { createPeoplePainter, readPalette } from "./people-painter";
import type { Camera, PaintedLink, PeoplePainter } from "./people-painter";
import type { Mode, NodeState } from "./people-visuals";
import type { DirectoryParticipant } from "./types";
import { personHeading } from "./types";

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
/** The layout gives up settling here: about six seconds after the last wake. */
const COLD = 1e-5;
/** A person is hit within this many screen pixels even when zoomed far out. */
const MIN_HIT_PX = 12;

function clampScale(scale: number) {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

function reducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Keyboard and screen-reader access to a person: the canvas paints, this
 * button is what focus and Enter land on. Focusing it lights the person up
 * on the map the way hovering does.
 */
const PersonButton = memo(function PersonButton({
	person,
	pressed,
	onFocus,
	onBlur,
	onActivate,
}: {
	person: DirectoryParticipant;
	pressed: boolean;
	onFocus: (id: string) => void;
	onBlur: () => void;
	onActivate: (id: string) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onFocus={() => onFocus(person.id)}
			onBlur={onBlur}
			onClick={() => onActivate(person.id)}
		>
			{personHeading(person)}, {person.city}
		</button>
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
	live = false,
	spotlight = null,
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
	/**
	 * A map left on a screen while the data changes under it: people without a
	 * cluster gather at the centre, clusters keep their place as they grow, and
	 * only new clusters bloom in.
	 */
	live?: boolean;
	/** People to ring in gold without dimming anybody else. */
	spotlight?: Set<string> | null;
	ref?: Ref<NetworkHandle>;
}) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const worldRef = useRef<SVGGElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const painter = useRef<PeoplePainter | null>(null);
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
	const introPlayed = useRef(false);
	const alpha = useRef(0);
	const frame = useRef(0);
	const layoutRef = useRef<Layout | null>(null);
	const linksRef = useRef<PaintedLink[]>([]);
	// What the paint loop needs from React, refreshed after every render.
	const scene = useRef<{
		hoveredId: string | null;
		mode: Mode;
		stateOf: (id: string) => NodeState;
	}>({ hoveredId: null, mode: "rest", stateOf: () => "" });
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

	const slots = useRef<ReadonlyMap<string, number>>(new Map());
	const seenZones = useRef(new Set<string>());
	const clusters = useMemo(() => {
		const all = clusterParticipants(participants, lens);
		return live
			? all.toSorted((a, b) => Number(b.loose) - Number(a.loose))
			: all;
	}, [participants, lens, live]);
	const spiral = useMemo(() => {
		if (!live) {
			return;
		}
		const next = stickySlots(
			slots.current,
			clusters.map((cluster) => cluster.id),
			clusters.find((cluster) => cluster.loose)?.id,
		);
		// oxlint-disable-next-line react/immutability -- the slots only feed the next layout, like the carried points below.
		slots.current = next;
		return clusters.map((cluster) => next.get(cluster.id) ?? 0);
	}, [clusters, live]);
	const aspect = size.height
		? Math.max(
				0.6,
				Math.min(2.4, Math.round((size.width / size.height) * 2) / 2),
			)
		: 1.6;
	const places = useMemo(
		() => placeClusters(clusters, aspect, { flatten: live, slots: spiral }),
		[clusters, aspect, spiral, live],
	);
	const bounds = useMemo(() => layoutBounds(places), [places]);
	const venn = useMemo(() => clustersOverlap(clusters), [clusters]);
	// Text labels sit just outside the halo, facing away from any overlap.
	// Symbols are watermarked at the centre instead (see the zone markup).
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
	let mode: Mode = "rest";
	if (selectedId) {
		mode = "focus";
	} else if (hoveredId) {
		mode = "peek";
	} else if (matches) {
		mode = "search";
	}
	const stateOf = useCallback(
		(id: string): NodeState => {
			if (activeId === id) {
				return "active";
			}
			if (linkedIds.has(id)) {
				return "linked";
			}
			return (matches ?? spotlight)?.has(id) ? "match" : "";
		},
		[activeId, linkedIds, matches, spotlight],
	);

	// --- paint loop ---------------------------------------------------------
	// One requestAnimationFrame loop advances the simulation while it is warm,
	// eases the visual transitions, and paints the canvas. It runs only while
	// something changes and goes idle otherwise.
	const tick = useCallback(function tick(now: number) {
		frame.current = 0;
		const paint = painter.current;
		if (!paint) {
			return;
		}
		let again = false;
		const dragging = drag.current?.moved ? drag.current.id : undefined;
		if (dragging) {
			alpha.current = Math.max(alpha.current, 0.25);
		}
		if (alpha.current > 0 && layoutRef.current) {
			const moved = layoutRef.current.tick(alpha.current, dragging);
			alpha.current *= 0.97;
			// Cooling only fades the soft forces: keep going until everyone has
			// reached their place, with a floor so a crowd that cannot rest stops.
			if ((alpha.current > COLD && moved > SETTLED) || dragging) {
				again = true;
			} else {
				alpha.current = 0;
			}
		}
		const view = {
			...scene.current,
			camera: camera.current,
			instant: reducedMotion(),
			links: linksRef.current,
			points: points.current,
		};
		if (paint.animate(now, view)) {
			again = true;
		}
		paint.draw(view, now);
		if (again) {
			frame.current = requestAnimationFrame(tick);
		}
	}, []);
	const requestRender = useCallback(() => {
		if (!frame.current) {
			frame.current = requestAnimationFrame(tick);
		}
	}, [tick]);
	const wake = useCallback(
		(target: number) => {
			alpha.current = Math.max(alpha.current, target);
			requestRender();
		},
		[requestRender],
	);
	useEffect(
		() => () => {
			cancelAnimationFrame(frame.current);
			frame.current = 0;
		},
		[],
	);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		const viewport = viewportRef.current;
		if (!canvas || !viewport) {
			return;
		}
		const paint = createPeoplePainter(
			canvas,
			readPalette(viewport),
			requestRender,
		);
		painter.current = paint;
		// Names and initials are drawn with the site fonts: repaint once they arrive.
		void document.fonts.ready.then(requestRender);
		return () => {
			paint.dispose();
			painter.current = null;
		};
	}, [requestRender]);
	useLayoutEffect(() => {
		painter.current?.setPeople(participants);
		requestRender();
	}, [participants, requestRender]);
	useLayoutEffect(() => {
		painter.current?.resize(
			size.width,
			size.height,
			Math.min(2, window.devicePixelRatio || 1),
		);
		requestRender();
	}, [size, requestRender]);

	// Everything the loop reads from React state, plus a frame to show it.
	useEffect(() => {
		scene.current = { hoveredId, mode, stateOf };
		requestRender();
	});
	useEffect(() => {
		const previous = new Map(
			linksRef.current.map((link) => [`${link.a}|${link.b}`, link]),
		);
		const now = performance.now();
		linksRef.current = activeId
			? activeLinks.map((link) => {
					const key = `${activeId}|${link.participant.id}`;
					return (
						previous.get(key) ?? {
							a: activeId,
							b: link.participant.id,
							color:
								CONNECTION_STYLES[link.affinities[0]?.kind ?? "skills"].color,
							since: now,
						}
					);
				})
			: [];
		requestRender();
	}, [activeId, activeLinks, requestRender]);

	// --- camera -------------------------------------------------------------
	const applyCamera = useCallback(() => {
		const { x, y, scale } = camera.current;
		worldRef.current?.setAttribute(
			"transform",
			`translate(${size.width / 2} ${size.height / 2}) scale(${scale}) translate(${-x} ${-y})`,
		);
		requestRender();
	}, [size, requestRender]);

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

	useEffect(() => {
		layoutRef.current = layout;
		if (reducedMotion()) {
			for (let i = 0; i < 260; i++) {
				if (layout.tick(0.98 ** i) <= SETTLED) {
					break;
				}
			}
			requestRender();
			return;
		}
		wake(1);
	}, [layout, wake, requestRender]);

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
		// On a live map the data changes all the time: only newcomers bloom.
		const seen = seenZones.current;
		const fresh = [...zones.querySelectorAll<SVGGElement>(".pg-zone")].filter(
			(zone) => !(live && seen.has(zone.dataset.cluster ?? "")),
		);
		seenZones.current = new Set(clusters.map((cluster) => cluster.id));
		if (!fresh.length) {
			return;
		}
		const circles = fresh.flatMap((zone) => [...zone.querySelectorAll("circle")]);
		const labels = fresh.flatMap((zone) => [
			...zone.querySelectorAll(".pg-zone-logo, .pg-zone-label"),
		]);
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
		let cutBloom: (() => void) | undefined;
		if (!introPlayed.current) {
			introPlayed.current = true;
			cutBloom = painter.current?.bloom();
		}
		return () => {
			// Interrupted (a lens change mid-intro, or React's dev double mount):
			// put everything back and let the next run bloom the people again.
			if (timeline.progress() < 1) {
				introPlayed.current = false;
				for (const zone of fresh) {
					seenZones.current.delete(zone.dataset.cluster ?? "");
				}
			}
			timeline.revert();
			cutBloom?.();
		};
	}, [clusters, live]);

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

	const enter = useCallback((id: string) => {
		if (!drag.current?.moved) {
			setHoveredId(id);
		}
	}, []);
	const leave = useCallback(() => setHoveredId(null), []);

	// --- gestures -----------------------------------------------------------
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		// Scrolling zooms around the pointer, like a map. Trackpad pinches arrive
		// as ctrl+wheel with finer deltas, so they get a gentler curve.
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			const rect = viewport.getBoundingClientRect();
			zoomAt(
				Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0022)),
				event.clientX - rect.left,
				event.clientY - rect.top,
			);
		};
		viewport.addEventListener("wheel", wheel, { passive: false });
		return () => viewport.removeEventListener("wheel", wheel);
	}, [zoomAt]);

	function screenToWorld(clientX: number, clientY: number) {
		const rect = viewportRef.current?.getBoundingClientRect();
		const { x, y, scale } = camera.current;
		return {
			x: x + (clientX - (rect?.left ?? 0) - size.width / 2) / scale,
			y: y + (clientY - (rect?.top ?? 0) - size.height / 2) / scale,
		};
	}

	/** The person under a screen point, if any: the closest disc within reach. */
	function hitTest(clientX: number, clientY: number): string | undefined {
		const { x, y } = screenToWorld(clientX, clientY);
		let best: string | undefined;
		let bestDistance = Math.max(
			NODE_RADIUS * 1.35,
			MIN_HIT_PX / camera.current.scale,
		);
		for (const point of points.current.values()) {
			const distance = Math.hypot(point.x - x, point.y - y);
			if (distance < bestDistance) {
				best = point.id;
				bestDistance = distance;
			}
		}
		return best;
	}

	function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.button !== 0) {
			return;
		}
		stopTweens();
		const viewport = event.currentTarget;
		viewport.setPointerCapture(event.pointerId);
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
		const id = hitTest(event.clientX, event.clientY);
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
	function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		if (!pointers.current.has(event.pointerId)) {
			// Hovering, not dragging: light up whoever is under the pointer.
			if (event.pointerType !== "touch") {
				setHoveredId(hitTest(event.clientX, event.clientY) ?? null);
			}
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
			requestRender();
		} else {
			camera.current = {
				scale,
				x: current.originX - dx / scale,
				y: current.originY - dy / scale,
			};
			applyCamera();
		}
	}
	function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
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

	return (
		<div
			className="pg-viewport"
			ref={viewportRef}
			data-mode={mode}
			data-hover={hoveredId ? "" : undefined}
			role="application"
			tabIndex={0}
			aria-label="Mapa de participantes. Arrastra para moverte, usa la rueda o pellizca para ampliar. Tabula para recorrer a la gente."
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onPointerLeave={leave}
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
			<svg className="pg-zones-layer" aria-hidden="true">
				<defs>
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
					>
						{clusters.map((cluster, index) => {
							const place = places[index];
							const label = labelAt[index];
							return (
								<g
									key={cluster.id}
									className="pg-zone"
									data-cluster={cluster.id}
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
													symbolBox(cluster.memberIds.length).width / 2
												}
												y={
													place.y -
													symbolBox(cluster.memberIds.length).height / 2
												}
												width={symbolBox(cluster.memberIds.length).width}
												height={symbolBox(cluster.memberIds.length).height}
												preserveAspectRatio="xMidYMid meet"
											/>
											<text
												className="pg-zone-label"
												x={place.x}
												y={
													place.y +
													symbolBox(cluster.memberIds.length).height / 2 +
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
				</g>
			</svg>
			<canvas ref={canvasRef} className="pg-people" aria-hidden="true" />
			<ul className="sr-only" aria-label="Participantes">
				{participants.map((person) => (
					<li key={person.id}>
						<PersonButton
							person={person}
							pressed={selectedId === person.id}
							onFocus={enter}
							onBlur={leave}
							onActivate={focus}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
