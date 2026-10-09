import { isHttpUrl } from "@convex/lib/perkInputs";

export type {
  PerkAnswer,
  PerkInput,
  PerkInputType,
} from "@convex/lib/perkInputs";
export {
  MAX_PERK_INPUTS,
  answerFor,
  isHttpUrl,
  perkInputTypeLabels,
  slugKey,
  validateAnswers,
} from "@convex/lib/perkInputs";

export { toCsv, downloadCsv } from "./csv";

export function fileSlug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replaceAll(/[\u0300-\u036F]/g, "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 60) || "perk"
  );
}

const HTTP_URL = /\bhttps?:\/\/[^\s<>"']+/gi;

export type LinkedPart = { text: string; href?: string };

/** Splits text so http(s) URLs can be rendered as links. Trailing punctuation stays outside. */
export function linkParts(text: string): LinkedPart[] {
  const parts: LinkedPart[] = [];
  let last = 0;
  for (const match of text.matchAll(HTTP_URL)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const href = raw.replace(/[),.;:!?]+$/, "");
    if (index > last) {
      parts.push({ text: text.slice(last, index) });
    }
    parts.push(isHttpUrl(href) ? { text: href, href } : { text: href });
    if (href.length < raw.length) {
      parts.push({ text: raw.slice(href.length) });
    }
    last = index + raw.length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ text }];
}
