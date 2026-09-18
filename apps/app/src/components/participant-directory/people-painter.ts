import { gsap } from "gsap";
import { initialsOf } from "@/components/avatar";
import { NODE_RADIUS } from "./network-model";
import type { GraphPoint } from "./network-model";
import { ease, REST, targetFor } from "./people-visuals";
import type { Mode, NodeState, Visual } from "./people-visuals";
import type { DirectoryParticipant } from "./types";

/**
 * Draws the people of the map on a 2D canvas. The SVG keeps the cluster
 * zones and a hidden button list keeps keyboard and screen-reader access;
 * this paints discs, photos, rings, halos, names and the active person's
 * links, which is where an SVG with hundreds of clipped images spent its time.
 */
export interface Camera {
	x: number;
	y: number;
	scale: number;
}

export interface PaintedLink {
	a: string;
	b: string;
	color: string;
	/** When it appeared, for the fade-in. */
	since: number;
}

export interface Palette {
	brown: string;
	gold: string;
	ink: string;
	paper: string;
	red: string;
	sand: string;
	initialsFont: string;
	nameFont: string;
}

export interface Scene {
	camera: Camera;
	hoveredId: string | null;
	/** Snap transitions instead of easing them (reduced motion). */
	instant: boolean;
	links: PaintedLink[];
	mode: Mode;
	points: Map<string, GraphPoint>;
	stateOf: (id: string) => NodeState;
}

export interface PeoplePainter {
	/** Ease every visual towards its target; true while something still moves. */
	animate: (now: number, scene: Scene) => boolean;
	/** Grow everyone in from nothing, staggered. Returns a way to cut it short. */
	bloom: () => () => void;
	dispose: () => void;
	draw: (scene: Scene, now: number) => void;
	resize: (width: number, height: number, dpr: number) => void;
	setPeople: (people: DirectoryParticipant[]) => void;
}

/** Photo sprite side in device pixels: a 28px disc at 2x, with room to grow. */
const SPRITE = 128;
const LINK_FADE = 380;

/** The map's colours and fonts, read from the stage's custom properties. */
export function readPalette(element: Element): Palette {
	const style = getComputedStyle(element);
	const value = (name: string) => style.getPropertyValue(name).trim();
	const sans = value("--font-dm-sans") || '"DM Sans", Arial, sans-serif';
	const display = value("--font-bungee-next") || '"Bungee", Impact, sans-serif';
	return {
		brown: value("--pg-brown") || "#4a2c1f",
		gold: value("--pg-gold") || "#eab619",
		initialsFont: `10px ${display}`,
		ink: value("--pg-ink") || "#2a170f",
		nameFont: `650 11.5px ${sans}`,
		paper: value("--pg-paper") || "#f4ecd8",
		red: value("--pg-red") || "#cc291f",
		sand: value("--pg-sand") || "#e8dcc4",
	};
}

function linkCurve(
	context: CanvasRenderingContext2D,
	a: GraphPoint,
	b: GraphPoint,
) {
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const distance = Math.hypot(dx, dy) || 1;
	// A gentle, consistent bow keeps parallel links apart and reads as organic.
	const bow = Math.min(60, distance * 0.14) * (a.id < b.id ? 1 : -1);
	context.moveTo(a.x, a.y);
	context.quadraticCurveTo(
		(a.x + b.x) / 2 - (dy / distance) * bow,
		(a.y + b.y) / 2 + (dx / distance) * bow,
		b.x,
		b.y,
	);
}

/** The photo, cropped to a circle once, so each frame is a single drawImage. */
function spriteOf(image: HTMLImageElement): HTMLCanvasElement | null {
	const sprite = document.createElement("canvas");
	sprite.width = SPRITE;
	sprite.height = SPRITE;
	const context = sprite.getContext("2d");
	if (!context) {
		return null;
	}
	const side = Math.min(image.naturalWidth, image.naturalHeight);
	if (!side) {
		return null;
	}
	context.beginPath();
	context.arc(SPRITE / 2, SPRITE / 2, SPRITE / 2, 0, Math.PI * 2);
	context.clip();
	context.drawImage(
		image,
		(image.naturalWidth - side) / 2,
		(image.naturalHeight - side) / 2,
		side,
		side,
		0,
		0,
		SPRITE,
		SPRITE,
	);
	return sprite;
}

export function createPeoplePainter(
	canvas: HTMLCanvasElement,
	palette: Palette,
	onChange: () => void,
): PeoplePainter {
	const context2d = canvas.getContext("2d");
	if (!context2d) {
		throw new Error("El navegador no permite dibujar en canvas");
	}
	const context: CanvasRenderingContext2D = context2d;
	let people: DirectoryParticipant[] = [];
	const visuals = new Map<string, Visual>();
	/** Intro scale per person, tweened by `bloom`. */
	const grown = new Map<string, { value: number }>();
	const sprites = new Map<string, HTMLCanvasElement>();
	const loading = new Map<string, HTMLImageElement>();
	let width = 0,
		height = 0,
		dpr = 1;
	let last = 0;
	let disposed = false;

	function load(person: DirectoryParticipant) {
		if (!person.photoUrl || sprites.has(person.id) || loading.has(person.id)) {
			return;
		}
		const image = new Image();
		if (/^https?:/.test(person.photoUrl)) {
			image.crossOrigin = "anonymous";
		}
		image.decoding = "async";
		image.addEventListener("load", () => {
			loading.delete(person.id);
			if (disposed) {
				return;
			}
			const sprite = spriteOf(image);
			if (sprite) {
				sprites.set(person.id, sprite);
				onChange();
			}
		});
		image.addEventListener("error", () => loading.delete(person.id));
		loading.set(person.id, image);
		image.src = person.photoUrl;
	}

	function drawPerson(
		person: DirectoryParticipant,
		point: GraphPoint,
		visual: Visual,
		state: NodeState,
	) {
		const scale = visual.scale * (grown.get(person.id)?.value ?? 1);
		if (scale <= 0) {
			return;
		}
		context.save();
		context.translate(point.x, point.y);
		context.scale(scale, scale);
		const ring = Math.max(visual.halo, visual.gold);
		if (ring > 0.01) {
			context.globalAlpha = visual.alpha * ring;
			context.beginPath();
			context.arc(0, 0, NODE_RADIUS + 7, 0, Math.PI * 2);
			context.lineWidth = visual.gold > visual.halo ? 3 : 2.5;
			context.strokeStyle = visual.gold > visual.halo ? palette.gold : palette.red;
			context.stroke();
		}
		context.globalAlpha = visual.alpha;
		context.beginPath();
		context.arc(0, 0, NODE_RADIUS, 0, Math.PI * 2);
		context.fillStyle = palette.sand;
		context.fill();
		const sprite = sprites.get(person.id);
		if (sprite) {
			context.drawImage(
				sprite,
				-NODE_RADIUS,
				-NODE_RADIUS,
				NODE_RADIUS * 2,
				NODE_RADIUS * 2,
			);
		} else {
			context.font = palette.initialsFont;
			context.fillStyle = palette.brown;
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillText(initialsOf(person.displayName), 0, 0);
		}
		context.beginPath();
		context.arc(0, 0, NODE_RADIUS, 0, Math.PI * 2);
		if (person.isMe) {
			context.lineWidth = 3.5;
			context.strokeStyle = palette.gold;
		} else if (state === "linked") {
			context.lineWidth = 2;
			context.strokeStyle = palette.ink;
		} else {
			context.lineWidth = 2.5;
			context.strokeStyle = palette.paper;
		}
		context.stroke();
		context.restore();
		if (visual.name > 0.01) {
			// The name sits under the disc and does not grow with it, as before.
			context.save();
			context.globalAlpha = visual.alpha * visual.name;
			context.font = palette.nameFont;
			context.textAlign = "center";
			context.textBaseline = "alphabetic";
			context.lineJoin = "round";
			context.lineWidth = 4;
			context.strokeStyle = palette.paper;
			context.strokeText(person.displayName, point.x, point.y + NODE_RADIUS + 16);
			context.fillStyle = palette.ink;
			context.fillText(person.displayName, point.x, point.y + NODE_RADIUS + 16);
			context.restore();
		}
	}

	return {
		animate(now, scene) {
			const dt = last ? Math.min(64, now - last) : 16;
			last = now;
			let moving = false;
			for (const person of people) {
				const visual = visuals.get(person.id);
				if (!visual) {
					continue;
				}
				const target = targetFor(
					scene.stateOf(person.id),
					scene.mode,
					scene.hoveredId === person.id,
				);
				if (ease(visual, target, dt, scene.instant)) {
					moving = true;
				}
			}
			if (
				!scene.instant &&
				scene.links.some((link) => now - link.since < LINK_FADE)
			) {
				moving = true;
			}
			return moving;
		},
		bloom() {
			const tweens = people.map((person) => {
				const growth = { value: 0 };
				grown.set(person.id, growth);
				return gsap.to(growth, {
					delay: Math.random(),
					duration: 0.6,
					ease: "back.out(1.7)",
					onUpdate: onChange,
					value: 1,
				});
			});
			onChange();
			return () => {
				for (const tween of tweens) {
					tween.kill();
				}
				grown.clear();
				onChange();
			};
		},
		dispose() {
			disposed = true;
			for (const image of loading.values()) {
				image.src = "";
			}
			loading.clear();
			sprites.clear();
		},
		draw(scene, now) {
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
			context.clearRect(0, 0, width, height);
			context.translate(width / 2, height / 2);
			context.scale(scene.camera.scale, scene.camera.scale);
			context.translate(-scene.camera.x, -scene.camera.y);
			context.lineCap = "round";
			context.lineWidth = 1.7;
			const linkAlpha = scene.mode === "peek" ? 0.5 : 0.7;
			for (const link of scene.links) {
				const a = scene.points.get(link.a),
					b = scene.points.get(link.b);
				if (!a || !b) {
					continue;
				}
				const age = scene.instant ? 1 : Math.min(1, (now - link.since) / LINK_FADE);
				context.globalAlpha = linkAlpha * age;
				context.strokeStyle = link.color;
				context.beginPath();
				linkCurve(context, a, b);
				context.stroke();
			}
			// Lit people go last so they sit on top of their dimmed neighbours.
			const lit: DirectoryParticipant[] = [];
			for (const person of people) {
				const state = scene.stateOf(person.id);
				if (state || scene.hoveredId === person.id) {
					lit.push(person);
					continue;
				}
				const point = scene.points.get(person.id);
				const visual = visuals.get(person.id);
				if (point && visual) {
					drawPerson(person, point, visual, state);
				}
			}
			for (const person of lit) {
				const point = scene.points.get(person.id);
				const visual = visuals.get(person.id);
				if (point && visual) {
					drawPerson(person, point, visual, scene.stateOf(person.id));
				}
			}
		},
		resize(nextWidth, nextHeight, nextDpr) {
			width = nextWidth;
			height = nextHeight;
			dpr = nextDpr;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context.imageSmoothingQuality = "medium";
		},
		setPeople(next) {
			people = next;
			const ids = new Set(next.map((person) => person.id));
			for (const id of visuals.keys()) {
				if (!ids.has(id)) {
					visuals.delete(id);
					sprites.delete(id);
					grown.delete(id);
				}
			}
			for (const person of next) {
				if (!visuals.has(person.id)) {
					visuals.set(person.id, { ...REST });
				}
				load(person);
			}
		},
	};
}
