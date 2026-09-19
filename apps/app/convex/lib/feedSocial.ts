import { v } from "convex/values";
import type { Infer } from "convex/values";

/** Reactions, comments and mentions on feed posts. */

/** Offered first in the picker; any other emoji works too. */
export const SUGGESTED_REACTIONS = ["👍", "❤️", "😂", "🔥", "🚀", "👀", "🎉", "💀"];

export const MAX_REACTION_KINDS = 20;
export const MAX_COMMENT_TEXT = 500;
export const MAX_MENTIONS = 10;

const PICTOGRAPH = String.raw`\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*`;
/** One emoji: a flag, a keycap, or a pictograph with its modifiers and ZWJ joins. */
const ONE_EMOJI = new RegExp(
  String.raw`^(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|${PICTOGRAPH}(?:‍${PICTOGRAPH})*[\u{E0020}-\u{E007F}]*)$`,
  "u",
);

/** The emoji as stored, or null when the input is not exactly one emoji. */
export function normalizeEmoji(input: string): string | null {
  const emoji = input.trim();
  return emoji.length > 0 && emoji.length <= 40 && ONE_EMOJI.test(emoji) ? emoji : null;
}

/**
 * A mention keeps the name as it was written: the text says `@Name`, and the
 * id says who that was even if they rename themselves later.
 */
export const mentionValidator = v.object({ name: v.string(), userId: v.id("users") });
export type Mention = Infer<typeof mentionValidator>;

/** True when `@name` stands in the text as a word of its own, not as the start of a longer one. */
function mentionIndex(text: string, name: string, from = 0): number {
  let index = text.indexOf(`@${name}`, from);
  while (index !== -1) {
    const next = text[index + name.length + 1];
    if (next === undefined || !/[\p{L}\p{N}_]/u.test(next)) { return index; }
    index = text.indexOf(`@${name}`, index + 1);
  }
  return -1;
}

/** Drops mentions the text no longer carries (the author deleted the `@name`) and repeats. */
export function mentionsInText<T extends { name: string; userId: string }>(text: string, mentions: T[]): T[] {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    if (!mention.name || seen.has(mention.userId) || mentionIndex(text, mention.name) === -1) { return false; }
    seen.add(mention.userId);
    return true;
  }).slice(0, MAX_MENTIONS);
}

export type TextSegment<T> = { text: string; mention?: T };

/** The text cut at every `@name`, longest names first so "Ana" never eats "Ana María". */
export function mentionSegments<T extends { name: string }>(text: string, mentions: T[]): TextSegment<T>[] {
  const byLength = mentions.toSorted((a, b) => b.name.length - a.name.length);
  const taken: { start: number; end: number; mention: T }[] = [];
  const free = (start: number, end: number) => !taken.some((span) => start < span.end && end > span.start);
  for (const mention of byLength) {
    let index = mentionIndex(text, mention.name);
    while (index !== -1) {
      const end = index + mention.name.length + 1;
      if (free(index, end)) { taken.push({ end, mention, start: index }); }
      index = mentionIndex(text, mention.name, end);
    }
  }
  const segments: TextSegment<T>[] = [];
  let cursor = 0;
  for (const span of taken.toSorted((a, b) => a.start - b.start)) {
    if (span.start > cursor) { segments.push({ text: text.slice(cursor, span.start) }); }
    segments.push({ mention: span.mention, text: text.slice(span.start, span.end) });
    cursor = span.end;
  }
  if (cursor < text.length) { segments.push({ text: text.slice(cursor) }); }
  return segments;
}

/** The `@query` being typed right before the caret, if any. Names have spaces, so it runs to the caret. */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1 || (at > 0 && /[\p{L}\p{N}_]/u.test(before.charAt(at - 1)))) { return null; }
  const query = before.slice(at + 1);
  // Two spaces in, or a line break, and this is prose rather than a name.
  if (query.includes("\n") || query.split(" ").length > 3 || query.startsWith(" ")) { return null; }
  return { query, start: at };
}
