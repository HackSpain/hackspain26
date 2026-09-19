/**
 * How a person looks on the canvas at any moment. The CSS transitions of the
 * old SVG map (dim the rest on hover, grow the active one, show the name)
 * become these numbers, eased frame by frame by the painter.
 */
export type NodeState = "" | "active" | "linked" | "match";
export type Mode = "rest" | "peek" | "focus" | "search";

export interface Visual {
	/** Whole-person opacity: 1, or dimmed while someone else is in focus. */
	alpha: number;
	/** Gold halo, for search matches. */
	gold: number;
	/** Red halo, for the active person. */
	halo: number;
	/** Name label under the disc. */
	name: number;
	/** Disc scale: 1, 1.12 for linked people and matches, 1.35 for the active one. */
	scale: number;
}

export const REST: Visual = { alpha: 1, gold: 0, halo: 0, name: 0, scale: 1 };

const KEYS = Object.keys(REST) as (keyof Visual)[];
/** Time constant in ms: ~95% of the way in 210ms, like the transitions it replaces. */
const TAU = 70;

export function targetFor(
	state: NodeState,
	mode: Mode,
	hovered: boolean,
): Visual {
	const active = state === "active";
	const lit = active || state === "linked" || state === "match";
	let alpha = 1;
	if (mode === "search") {
		alpha = state === "match" || active ? 1 : 0.16;
	} else if (mode !== "rest" && !lit) {
		alpha = 0.2;
	}
	let scale = 1;
	if (active || hovered) {
		scale = 1.35;
	} else if (lit) {
		scale = 1.12;
	}
	return {
		alpha,
		gold: state === "match" ? 1 : 0,
		halo: active ? 1 : 0,
		name: active || hovered ? 1 : 0,
		scale,
	};
}

/**
 * Move `visual` towards `target` for a frame `dt` ms long. Returns true
 * while anything is still on its way; `instant` snaps (reduced motion).
 */
export function ease(
	visual: Visual,
	target: Visual,
	dt: number,
	instant: boolean,
): boolean {
	const k = instant ? 1 : 1 - Math.exp(-dt / TAU);
	let moving = false;
	for (const key of KEYS) {
		const gap = target[key] - visual[key];
		if (Math.abs(gap) < 0.002) {
			visual[key] = target[key];
			continue;
		}
		visual[key] += gap * k;
		moving = true;
	}
	return moving;
}
