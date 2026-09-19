/** The meme screen: which meme holds the big cell, and for how long. */

export type TvMeme = {
  _id: string;
  authorName: string;
  teamName: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
  /** Most used first. Optional: a screen left open across a deploy may still get the old shape. */
  reactions?: MemeReaction[];
  commentCount?: number;
};

export type MemeReaction = { emoji: string; count: number };

/** The reactions that fit on screen, and how many people reacted with the ones that do not. */
export function topReactions(meme: Pick<TvMeme, "reactions">, limit: number): { shown: MemeReaction[]; rest: number } {
  const all = (meme.reactions ?? []).filter((reaction) => reaction.count > 0).toSorted((a, b) => b.count - a.count);
  return { rest: all.slice(limit).reduce((sum, reaction) => sum + reaction.count, 0), shown: all.slice(0, limit) };
}

export function reactionTotal(meme: Pick<TvMeme, "reactions">): number {
  return (meme.reactions ?? []).reduce((sum, reaction) => sum + reaction.count, 0);
}

/** A meme that has just arrived holds the big cell longer than one on rotation. */
export const FRESH_HOLD_MS = 20_000;
export const ROTATION_HOLD_MS = 10_000;
/** How long a meme keeps its "nuevo" tag on the wall. */
export const NEW_TAG_MS = 10 * 60_000;

/**
 * What the big cell shows. `queue` holds memes that arrived while another new
 * one was still on; `turn` moves on every change so timers and the progress
 * bar restart even when the same meme stays.
 */
export type Reel = { currentId: string | null; fresh: boolean; queue: string[]; turn: number };

export const EMPTY_REEL: Reel = { currentId: null, fresh: false, queue: [], turn: 0 };

/**
 * Memes posted since the previous snapshot, oldest first. An older meme that
 * slides back into the window because another was deleted is not news, and
 * neither is anything in the first snapshot.
 */
export function freshMemes(previous: TvMeme[] | undefined, next: TvMeme[]): TvMeme[] {
  if (!previous) { return []; }
  const known = new Set(previous.map((meme) => meme._id));
  const newest = Math.max(0, ...previous.map((meme) => meme.createdAt));
  return next.filter((meme) => !known.has(meme._id) && meme.createdAt > newest).toSorted((a, b) => a.createdAt - b.createdAt);
}

/** Next meme into the big cell: waiting new ones first, then the rotation. */
export function reelAdvance(reel: Reel, memes: TvMeme[]): Reel {
  const queue = reel.queue.filter((id) => memes.some((meme) => meme._id === id));
  const [next, ...rest] = queue;
  if (next) { return { currentId: next, fresh: true, queue: rest, turn: reel.turn + 1 }; }
  if (memes.length === 0) { return { currentId: null, fresh: false, queue: [], turn: reel.turn + 1 }; }
  const index = memes.findIndex((meme) => meme._id === reel.currentId);
  return { currentId: memes[(index + 1) % memes.length]._id, fresh: false, queue: [], turn: reel.turn + 1 };
}

/**
 * A new snapshot. New memes cut into the rotation at once, but wait their turn
 * behind another new one; a deleted meme leaves the big cell immediately.
 */
export function reelArrive(reel: Reel, previous: TvMeme[] | undefined, next: TvMeme[]): Reel {
  const queue = [...reel.queue, ...freshMemes(previous, next).map((meme) => meme._id)];
  const showing = next.some((meme) => meme._id === reel.currentId);
  if (!showing || (!reel.fresh && queue.length > 0)) { return reelAdvance({ ...reel, queue }, next); }
  return { ...reel, queue };
}

/** The caption without its meme hashtag: on this screen the tag is noise. */
export function memeCaption(text: string): string {
  return text.replaceAll(/(^|[^\p{L}\p{N}_#])#memes?(?![\p{L}\p{N}_])/giu, "$1").replaceAll(/[ \t]{2,}/g, " ").trim();
}

export function memeAge(createdAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - createdAt) / 60_000);
  if (minutes < 1) { return "ahora"; }
  if (minutes < 60) { return `hace ${minutes} min`; }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.floor(hours / 24)} d`;
}

const DEMO_MEMES: [author: string, team: string, text: string, shape: "wide" | "square" | "tall" | null][] = [
  ["Dani", "Rocinante Labs", "Yo a las 4am explicándole al pato de goma por qué falla el deploy #meme", "wide"],
  ["Lucía", "Los Molinos", "\"Funciona en mi máquina\": pues enviamos tu máquina al jurado #meme", "square"],
  ["Marta", "Alcalá Bytes", "Git blame dice que fui yo. Git blame miente. #meme", null],
  ["Íñigo", "Sancho Stack", "Cuando el mentor pregunta por los tests #memes", "tall"],
  ["Noa", "Dulcinea AI", "El agente ha decidido reescribir el repo entero. Otra vez. #meme", "wide"],
  ["Pau", "La Mancha Devs", "Nuestra arquitectura según el pitch / según el código #meme", "square"],
  ["Irene", "Clavileño", "Quedan 3 horas y acabamos de cambiar de idea #meme", null],
  ["Hugo", "Yelmo de Mambrino", "El café de las 6am haciendo todo el trabajo #meme", "wide"],
  ["Aitana", "Barataria", "Commit: \"arreglos\". 47 archivos cambiados. #meme", "tall"],
  ["Leo", "Los Galeotes", "Cuando la demo funciona justo delante del jurado #memes", "square"],
];
const DEMO_SHAPES = { square: [800, 800], tall: [720, 1080], wide: [1200, 800] } as const;
const DEMO_COLOURS = ["#eab619", "#d96b2a", "#35858a", "#cc291f", "#1e3958", "#f4ecd8"];

/** A stand-in picture made of brand cells, so the demo never loads anything real. */
function demoImage(index: number, shape: keyof typeof DEMO_SHAPES): string {
  const [width, height] = DEMO_SHAPES[shape];
  const colour = (offset: number) => DEMO_COLOURS[(index + offset) % DEMO_COLOURS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${colour(0)}"/>`
    + `<rect width="${width / 2}" height="${height / 2}" fill="${colour(2)}"/>`
    + `<polygon points="${width / 2},${height / 2} ${width},${height / 2} ${width},${height}" fill="${colour(3)}"/>`
    + `<circle cx="${width * 0.72}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.16}" fill="${colour(4)}"/>`
    + `<path d="M0 ${height / 2}H${width}M${width / 2} 0V${height}" stroke="#2a170f" stroke-width="10"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DEMO_EMOJI = ["😂", "🔥", "💀", "👀", "🚀", "❤️", "🫠"];

/** Reactions that pile up the longer a demo meme has been on the wall. */
function demoReactions(index: number, age: number): MemeReaction[] {
  return [0, 1, 2, 3].flatMap((slot) => {
    const count = Math.max(0, (age + 1) * (4 - slot) - slot * 2 + ((index + slot) % 3));
    return count > 0 ? [{ count, emoji: DEMO_EMOJI[(index + slot) % DEMO_EMOJI.length] }] : [];
  });
}

const DEMO_START = 4;
const DEMO_CYCLE = DEMO_MEMES.length - DEMO_START + 1;

/**
 * Invented memes, newest first. Starts with a few on the wall and posts one
 * more per step, then starts over, so the arrival of a new meme can be watched.
 */
export function demoMemes(step: number, startedAt: number, stepMs: number): TvMeme[] {
  const posted = DEMO_START + (step % DEMO_CYCLE);
  const cycleStart = startedAt + (step - (step % DEMO_CYCLE)) * stepMs;
  return DEMO_MEMES.slice(0, posted).map(([authorName, teamName, text, shape], index) => ({
    _id: `demo-meme-${index}`,
    authorName,
    teamName,
    text,
    ...(shape ? { imageUrl: demoImage(index, shape) } : {}),
    // The starting wall is old news; the rest are stamped with the step that posts them.
    createdAt: index < DEMO_START ? startedAt - (DEMO_START - index) * 17 * 60_000 : cycleStart + (index - DEMO_START + 1) * stepMs,
    // A meme that has only just been posted has none yet, so the first ones can be seen arriving.
    reactions: index === posted - 1 && index >= DEMO_START ? [] : demoReactions(index, posted - 1 - index),
    commentCount: (index * 3) % 5,
  })).toReversed();
}
