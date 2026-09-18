import { connectionsFor, normalize, valuesFor } from "./affinities";
import type { Connection } from "./affinities";
import type { DirectoryParticipant } from "./types";

/**
 * The graph shows people only. One lens at a time groups them into soft
 * clusters; everything else (skills, interests, the other lenses) surfaces as
 * links when a person is hovered or selected, never as permanent lines.
 *
 * Most lenses give each person one cluster. The track lens can give several:
 * a team enters more than one challenge, so those clusters overlap like a
 * Venn diagram and the shared people settle in the intersection.
 */
export const LENSES = [
	"team",
	"track",
	"city",
	"university",
	"company",
] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABELS: Record<Lens, { label: string; loose: string }> = {
	city: { label: "Ciudad", loose: "Sin ciudad" },
	company: { label: "Empresa", loose: "Sin empresa" },
	team: { label: "Equipo", loose: "Sin equipo" },
	track: { label: "Reto", loose: "Sin reto" },
	university: { label: "Universidad", loose: "Sin universidad" },
};

export interface Cluster {
	id: string;
	lens: Lens;
	label: string;
	/** Sponsor symbol, drawn instead of the label when the lens is a track. */
	logoUrl?: string;
	/** People without a value for the lens gather in one loose cluster. */
	loose: boolean;
	memberIds: string[];
}

/** A cluster's home on the canvas, in world units. */
export interface ClusterPlace {
	id: string;
	x: number;
	y: number;
	r: number;
}

export interface GraphPoint {
	id: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/** Where one person is drawn to: a cluster's centre, or the middle of an overlap. */
export interface Home {
	x: number;
	y: number;
	r: number;
	/** An ellipse around the centre that stays clear, for the sponsor symbol. */
	keepOut?: { rx: number; ry: number };
}

export type Link = Connection;

/** Node radius in world units. Everything else in the layout scales from it. */
export const NODE_RADIUS = 14;
const NODE_GAP = 7;
const PITCH = NODE_RADIUS * 2 + NODE_GAP;
/** How many connections a selected person shows. Beyond this the lines stop informing. */
export const MAX_LINKS = 12;

interface LensEntry {
	key: string;
	label: string;
	logoUrl?: string;
}

/**
 * The map marks each challenge with the sponsor's symbol, which reads at the
 * centre of a crowd where a wordmark does not. Tracks without one fall back
 * to their wordmark.
 */
const TRACK_SYMBOLS: Record<string, string> = {
	embat: "/tracks/symbols/embat.svg",
	happyrobot: "/tracks/symbols/happyrobot.svg",
	maisa: "/tracks/symbols/maisa.svg",
	"prosper-ai": "/tracks/symbols/prosper-ai.svg",
	theker: "/tracks/symbols/theker.svg",
};

/** Every grouping value of a person: teams and tracks key on ids, the rest on text. */
function lensValues(person: DirectoryParticipant, lens: Lens): LensEntry[] {
	if (lens === "track") {
		return (person.tracks ?? []).map((track) => ({
			key: track.id,
			label: track.label,
			logoUrl: (track.slug && TRACK_SYMBOLS[track.slug]) || track.logoUrl,
		}));
	}
	const value = valuesFor(person, lens)[0]?.trim().replaceAll(/\s+/g, " ");
	if (!value) {
		return [];
	}
	return [
		{
			key:
				lens === "team"
					? (person.team?.id ?? normalize(value))
					: normalize(value),
			label: value,
		},
	];
}

/** Dedupe by id and sort so the same input always yields the same graph. */
export function uniqueParticipants(
	participants: DirectoryParticipant[],
): DirectoryParticipant[] {
	return [
		...new Map(participants.map((person) => [person.id, person])).values(),
	].toSorted((a, b) => a.id.localeCompare(b.id));
}

/**
 * Group people by the lens values. Largest clusters first, the loose one last.
 * A person with several values appears in each of those clusters.
 */
export function clusterParticipants(
	participants: DirectoryParticipant[],
	lens: Lens,
): Cluster[] {
	const clusters = new Map<string, Cluster>();
	const add = (id: string, entry: LensEntry | undefined, personId: string) => {
		const cluster = clusters.get(id) ?? {
			id,
			label: entry?.label ?? LENS_LABELS[lens].loose,
			lens,
			logoUrl: entry?.logoUrl,
			loose: !entry,
			memberIds: [],
		};
		cluster.memberIds.push(personId);
		clusters.set(id, cluster);
	};
	for (const person of uniqueParticipants(participants)) {
		const entries = lensValues(person, lens);
		if (!entries.length) {
			add(`cluster:${lens}:`, undefined, person.id);
		}
		for (const entry of new Map(entries.map((e) => [e.key, e])).values()) {
			add(`cluster:${lens}:${entry.key}`, entry, person.id);
		}
	}
	return [...clusters.values()].toSorted(
		(a, b) =>
			Number(a.loose) - Number(b.loose) ||
			b.memberIds.length - a.memberIds.length ||
			a.label.localeCompare(b.label, "es"),
	);
}

/** True when someone belongs to more than one cluster: the places will overlap. */
export function clustersOverlap(clusters: Cluster[]): boolean {
	const seen = new Set<string>();
	for (const cluster of clusters) {
		for (const id of cluster.memberIds) {
			if (seen.has(id)) {
				return true;
			}
			seen.add(id);
		}
	}
	return false;
}

/** The strongest connections of one person across every affinity kind. */
export function linksFor(
	person: DirectoryParticipant,
	participants: DirectoryParticipant[],
	limit = MAX_LINKS,
): Link[] {
	return connectionsFor(person, participants).slice(0, limit);
}

function seed(value: string) {
	let hash = 2_166_136_261;
	for (const char of value) {
		// oxlint-disable-next-line no-bitwise, unicorn/prefer-code-point -- FNV-1a hashes UTF-16 code units intentionally.
		hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
	}
	// oxlint-disable-next-line no-bitwise -- unsigned coercion is part of FNV-1a normalization.
	return (hash >>> 0) / 4_294_967_296;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** The symbol's square box at a cluster's centre, sized by how many people ring it. */
export function symbolBox(members: number): {
	width: number;
	height: number;
} {
	const side = Math.max(64, Math.min(120, 44 + Math.sqrt(members) * 9));
	return { height: side, width: side };
}

/** Room a cluster needs for its members to sit loosely packed. */
export function clusterRadius(members: number, logo = false): number {
	// Hex packing covers ~0.9 of the area; keep it airy, not tight.
	const packed = Math.sqrt((members * PITCH * PITCH) / (Math.PI * 0.5));
	if (!logo) {
		return packed + NODE_RADIUS;
	}
	// Members ring the symbol: add its footprint to the area.
	const box = symbolBox(members);
	return Math.hypot(packed, (box.width + box.height) / 4) + NODE_RADIUS;
}

/** How many people two clusters have in common. */
function sharedCounts(clusters: Cluster[]) {
	const sets = clusters.map((cluster) => new Set(cluster.memberIds));
	return (i: number, j: number) => {
		let shared = 0;
		for (const id of clusters[j].memberIds) {
			if (sets[i].has(id)) {
				shared++;
			}
		}
		return shared;
	};
}

/**
 * How far two overlapping circles should sit apart: close enough that the
 * lens between them holds the shared people, never so close that one
 * swallows the other.
 */
function overlapDistance(a: number, b: number, shared: number): number {
	const lens = Math.min(
		Math.max(NODE_RADIUS * 2 + Math.sqrt(shared) * PITCH, 0.35 * (a + b)),
		1.6 * Math.min(a, b),
	);
	return a + b - lens;
}

/**
 * Place clusters on a golden-angle spiral, biggest at the centre, then relax:
 * clusters with people in common are drawn together until they overlap,
 * everything else keeps clear air. Deterministic for the same input.
 */
export function placeClusters(
	clusters: Cluster[],
	aspect = 1.6,
	{
		slots,
		flatten = false,
	}: {
		/** Spiral position per cluster; defaults to its index. See `stickySlots`. */
		slots?: number[];
		/**
		 * For a wide screen holding a hundred clusters: pull harder towards the
		 * horizon the wider the stage, keep less air between neighbours, and
		 * finish pushing only. Measured at 100 teams of three plus 110 people
		 * without one: a larger map with fewer overlapping zones than the default.
		 */
		flatten?: boolean;
	} = {},
): ClusterPlace[] {
	const places = clusters.map((cluster, index) => {
		const r = clusterRadius(cluster.memberIds.length, Boolean(cluster.logoUrl));
		const slot = slots?.[index] ?? index;
		const angle = slot * GOLDEN_ANGLE;
		const distance = Math.sqrt(slot) * (r + 110) * 1.15;
		return {
			id: cluster.id,
			r,
			x: Math.cos(angle) * distance * Math.sqrt(aspect),
			y: (Math.sin(angle) * distance) / Math.sqrt(aspect),
		};
	});
	const pullY = flatten ? Math.max(0.85, 0.985 - 0.13 * (aspect - 1)) : 0.98;
	const shared = sharedCounts(clusters);
	const targets = places.map((a, i) =>
		places.map((b, j) => {
			if (i === j) {
				return 0;
			}
			const common = shared(i, j);
			// Room for the label above each cluster and clear air between neighbours.
			return common ? overlapDistance(a.r, b.r, common) : a.r + b.r + (flatten ? 64 : 96);
		}),
	);
	// A strong pull leaves neighbours pressed together: finish with a few
	// passes that only push, so nobody ends up on top of anybody.
	const settle = flatten ? 20 : 0;
	for (let iteration = 0; iteration < 320 + settle; iteration++) {
		for (let i = 0; i < places.length; i++) {
			for (let j = i + 1; j < places.length; j++) {
				const a = places[i],
					b = places[j];
				const dx = b.x - a.x || 0.01,
					dy = b.y - a.y || 0.01;
				const distance = Math.hypot(dx, dy);
				const target = targets[i][j];
				const overlapping = shared(i, j) > 0;
				// Disjoint pairs only push apart; overlapping pairs seek their distance.
				if (!overlapping && distance >= target) {
					continue;
				}
				const push =
					((target - distance) / distance) * (overlapping ? 0.3 : 0.5);
				// Lighter clusters move further out of the way.
				const share = b.r / (a.r + b.r);
				a.x -= dx * push * share;
				a.y -= dy * push * share;
				b.x += dx * push * (1 - share);
				b.y += dy * push * (1 - share);
			}
		}
		if (iteration >= 320) {
			continue;
		}
		for (const place of places) {
			place.x *= 0.985;
			place.y *= pullY;
		}
	}
	return places.map((place) => ({
		...place,
		x: Math.round(place.x),
		y: Math.round(place.y),
	}));
}

/**
 * Spiral slots that survive data changes, for a map that stays on screen while
 * clusters come and go: a cluster keeps its slot for as long as it exists, a
 * new one takes the lowest free slot, and slot 0 (the centre) belongs to
 * `centre` alone. Without this a cluster that grows by one person overtakes
 * its neighbours in the size order and everybody swaps places.
 */
export function stickySlots(
	previous: ReadonlyMap<string, number>,
	ids: string[],
	centre?: string,
): Map<string, number> {
	const next = new Map<string, number>();
	const taken = new Set<number>([0]);
	for (const id of ids) {
		const slot = id === centre ? 0 : previous.get(id);
		if (slot !== undefined && (slot > 0 || id === centre)) {
			next.set(id, slot);
			taken.add(slot);
		}
	}
	let free = 1;
	for (const id of ids) {
		if (next.has(id)) {
			continue;
		}
		while (taken.has(free)) {
			free += 1;
		}
		next.set(id, free);
		taken.add(free);
	}
	return next;
}

/**
 * Each person's home. One cluster: its centre. Several: the middle of the
 * lens where those circles overlap, averaged over every pair.
 */
export function memberHomes(
	clusters: Cluster[],
	places: ClusterPlace[],
): Map<string, Home> {
	const placeById = new Map(places.map((place) => [place.id, place]));
	const membership = new Map<string, ClusterPlace[]>();
	const keepOutById = new Map<string, Home["keepOut"]>();
	for (const cluster of clusters) {
		const place = placeById.get(cluster.id);
		if (!place) {
			continue;
		}
		if (cluster.logoUrl) {
			const box = symbolBox(cluster.memberIds.length);
			keepOutById.set(cluster.id, {
				rx: box.width / 2 + NODE_RADIUS + 4,
				ry: box.height / 2 + NODE_RADIUS + 4,
			});
		}
		for (const id of cluster.memberIds) {
			const list = membership.get(id) ?? [];
			list.push(place);
			membership.set(id, list);
		}
	}
	const homes = new Map<string, Home>();
	for (const [id, own] of membership) {
		if (own.length === 1) {
			homes.set(id, {
				keepOut: keepOutById.get(own[0].id),
				r: own[0].r,
				x: own[0].x,
				y: own[0].y,
			});
			continue;
		}
		let x = 0,
			y = 0,
			r = Number.POSITIVE_INFINITY,
			pairs = 0;
		for (let i = 0; i < own.length; i++) {
			for (let j = i + 1; j < own.length; j++) {
				const a = own[i],
					b = own[j];
				const dx = b.x - a.x,
					dy = b.y - a.y;
				const distance = Math.hypot(dx, dy) || 1;
				// The lens spans from b's near edge to a's far edge along the centre line.
				const from = Math.max(0, distance - b.r);
				const to = Math.min(distance, a.r);
				const middle = (from + to) / 2;
				x += a.x + (dx / distance) * middle;
				y += a.y + (dy / distance) * middle;
				r = Math.min(r, Math.max(NODE_RADIUS * 1.5, (to - from) / 2));
				pairs++;
			}
		}
		homes.set(id, { r, x: x / pairs, y: y / pairs });
	}
	return homes;
}

/** Where the members start: on their home, a little scattered. */
export function initialPoints(
	clusters: Cluster[],
	places: ClusterPlace[],
): GraphPoint[] {
	const homes = memberHomes(clusters, places);
	return [...homes].map(([id, home]) => {
		const angle = seed(id) * Math.PI * 2;
		// Start on the ring around a symbol, otherwise scattered over the centre.
		const inner = home.keepOut
			? Math.hypot(
					home.keepOut.rx * Math.cos(angle),
					home.keepOut.ry * Math.sin(angle),
				)
			: 0;
		const distance =
			inner + Math.sqrt(seed(`${id}:r`)) * (home.r - inner) * 0.6;
		return {
			id,
			vx: 0,
			vy: 0,
			x: home.x + Math.cos(angle) * distance,
			y: home.y + Math.sin(angle) * distance,
		};
	});
}

/**
 * Which way each cluster's label points: away from the clusters it overlaps
 * with, so it never sits on the shared people; straight up otherwise.
 */
export function labelDirections(
	clusters: Cluster[],
	places: ClusterPlace[],
): { x: number; y: number }[] {
	const shared = sharedCounts(clusters);
	return places.map((place, i) => {
		let x = 0,
			y = 0;
		for (let j = 0; j < places.length; j++) {
			if (j !== i && shared(i, j) > 0) {
				x += place.x - places[j].x;
				y += place.y - places[j].y;
			}
		}
		const length = Math.hypot(x, y);
		return length < 1 ? { x: 0, y: -1 } : { x: x / length, y: y / length };
	});
}

/** The soft halo around a cluster reaches a little past its packing radius. */
export const ZONE_HALO = 1.12;

export function layoutBounds(places: ClusterPlace[]) {
	if (!places.length) {
		return { height: 600, width: 900, x: 0, y: 0 };
	}
	// Labels sit just outside the halo, on whichever side is free.
	const halo = (place: ClusterPlace) => place.r * ZONE_HALO + 56;
	const left = Math.min(...places.map((place) => place.x - halo(place)));
	const right = Math.max(...places.map((place) => place.x + halo(place)));
	const top = Math.min(...places.map((place) => place.y - halo(place)));
	const bottom = Math.max(...places.map((place) => place.y + halo(place)));
	return {
		height: bottom - top,
		width: right - left,
		x: (left + right) / 2,
		y: (top + bottom) / 2,
	};
}

export interface Layout {
	/**
	 * Advance one frame. `alpha` in (0, 1] scales the settling forces. Returns
	 * the furthest any member moved, so the caller can stop painting once the
	 * layout has come to rest instead of running the cooling curve out.
	 */
	tick: (alpha: number, pinnedId?: string) => number;
}

/** Below this per-frame movement (world units) nothing changes on screen. */
export const SETTLED = 0.05;

/** How strongly a group's centre of mass is carried onto its home, per frame. */
const CENTRING = 0.08;
/** Past this share of the home radius a member is pulled in however cool the layout is. */
const RIM = 0.8;

/**
 * Members drift towards their home, keep a small distance from each other,
 * and come to rest as alpha cools. The topology is resolved once so each
 * frame is a tight pair loop.
 *
 * The drift cools with alpha so a settled cluster keeps its airy shape, which
 * means it can die out before people carried over from another lens arrive.
 * Two forces do not cool, so every group ends up centred in its circle: the
 * group's centre of mass is carried onto the home (a translation, it never
 * compresses the group), and anyone left outside the rim is pulled in.
 */
export function createLayout(
	points: GraphPoint[],
	clusters: Cluster[],
	places: ClusterPlace[],
): Layout {
	const homeOf = memberHomes(clusters, places);
	const homes = points.map((point) => homeOf.get(point.id));
	const placeById = new Map(places.map((place) => [place.id, place]));
	const logos = clusters.flatMap((cluster) => {
		const place = placeById.get(cluster.id);
		if (!cluster.logoUrl || !place) {
			return [];
		}
		const box = symbolBox(cluster.memberIds.length);
		return [
			{
				rx: box.width / 2 + NODE_RADIUS + 4,
				ry: box.height / 2 + NODE_RADIUS + 4,
				x: place.x,
				y: place.y,
			},
		];
	});
	// People who share a home (a cluster, or the same overlap) are centred together.
	const groups = new Map<string, number[]>();
	for (const [index, home] of homes.entries()) {
		if (home) {
			const key = `${home.x}|${home.y}`;
			groups.set(key, [...(groups.get(key) ?? []), index]);
		}
	}
	const contact = PITCH;
	const reach = contact * 2.2;
	return {
		tick(alpha, pinnedId) {
			let moved = 0;
			for (let i = 0; i < points.length; i++) {
				const a = points[i];
				for (let j = i + 1; j < points.length; j++) {
					const b = points[j];
					const dx = b.x - a.x || 0.01,
						dy = b.y - a.y || 0.01;
					const squared = dx * dx + dy * dy;
					if (squared > reach * reach) {
						continue;
					}
					// Coordinates are bounded; this hot loop does not need hypot’s overflow scaling.
					// oxlint-disable-next-line unicorn/prefer-modern-math-apis
					const distance = Math.max(1, Math.sqrt(squared));
					const overlap = Math.max(0, contact - distance);
					const force =
						(overlap * 0.32 + ((reach - distance) / reach) * 0.55 * alpha) /
						distance;
					a.vx -= dx * force;
					a.vy -= dy * force;
					b.vx += dx * force;
					b.vy += dy * force;
				}
			}
			for (const members of groups.values()) {
				let x = 0,
					y = 0,
					free = 0;
				for (const index of members) {
					if (points[index].id !== pinnedId) {
						x += points[index].x;
						y += points[index].y;
						free++;
					}
				}
				const home = homes[members[0]];
				if (!home || !free) {
					continue;
				}
				const shiftX = (home.x - x / free) * CENTRING,
					shiftY = (home.y - y / free) * CENTRING;
				for (const index of members) {
					points[index].vx += shiftX;
					points[index].vy += shiftY;
				}
			}
			for (let i = 0; i < points.length; i++) {
				const point = points[i];
				if (point.id === pinnedId) {
					point.vx = 0;
					point.vy = 0;
					continue;
				}
				const home = homes[i];
				if (home) {
					const dx = home.x - point.x,
						dy = home.y - point.y;
					const distance = Math.hypot(dx, dy);
					// Pull harder the further out a member drifts past its home's rim.
					const pull = Math.min(
						0.3,
						0.045 *
							(alpha * (1 + Math.max(0, distance - home.r * 0.7) / home.r) +
								Math.max(0, distance - home.r * RIM) / home.r),
					);
					point.vx += dx * pull;
					point.vy += dy * pull;
				}
				for (const logo of logos) {
					// Every symbol is an obstacle for everyone: inside its ellipse,
					// push out through the nearest edge, whichever cluster you belong
					// to. The push is a spring on how deep the member sits, fading to
					// nothing at the edge: a constant kick there knocks people out,
					// the crowd presses them back in, and they never come to rest.
					const dx = point.x - logo.x || 0.01,
						dy = point.y - logo.y || 0.01;
					const inside = Math.hypot(dx / logo.rx, dy / logo.ry);
					if (inside < 1) {
						const nx = dx / (logo.rx * logo.rx),
							ny = dy / (logo.ry * logo.ry);
						const normal = Math.hypot(nx, ny);
						const depth = Math.min(
							logo.ry,
							Math.hypot(dx, dy) * (1 / Math.max(inside, 0.1) - 1),
						);
						point.vx += (nx / normal) * depth * 0.32;
						point.vy += (ny / normal) * depth * 0.32;
					}
				}
				point.vx *= 0.6;
				point.vy *= 0.6;
				const stepX = Math.max(-12, Math.min(12, point.vx));
				const stepY = Math.max(-12, Math.min(12, point.vy));
				point.x += stepX;
				point.y += stepY;
				moved = Math.max(moved, Math.abs(stepX), Math.abs(stepY));
			}
			return moved;
		},
	};
}
