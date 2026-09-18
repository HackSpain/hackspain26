import { isHttpUrl } from "@convex/lib/perkInputs";

export type { PerkAnswer, PerkInput, PerkInputType } from "@convex/lib/perkInputs";
export {
  MAX_PERK_INPUTS,
  answerFor,
  isEmail,
  isHttpUrl,
  perkInputTypeLabels,
  slugKey,
  validateAnswers,
} from "@convex/lib/perkInputs";

function csvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** RFC 4180 rows with a BOM so Excel opens accents correctly. */
export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fileSlug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
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
