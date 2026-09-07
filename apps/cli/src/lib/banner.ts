import { BRAND, c, colorEnabled } from "./style";

/**
 * Block-letter wordmark assembled from per-glyph rows (ANSI Shadow style) so
 * the columns always line up. 69 cells wide; below that width the small
 * brand mark is used instead.
 */
const GLYPHS: Record<string, string[]> = {
  H: ["██╗  ██╗", "██║  ██║", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  C: [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
  K: ["██╗  ██╗", "██║ ██╔╝", "█████╔╝ ", "██╔═██╗ ", "██║  ██╗", "╚═╝  ╚═╝"],
  S: ["███████╗", "██╔════╝", "███████╗", "╚════██║", "███████║", "╚══════╝"],
  P: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔═══╝ ", "██║     ", "╚═╝     "],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  N: [
    "███╗   ██╗",
    "████╗  ██║",
    "██╔██╗ ██║",
    "██║╚██╗██║",
    "██║ ╚████║",
    "╚═╝  ╚═══╝",
  ],
};

const ROWS = 6;

export function wordmarkRows(word = "HACKSPAIN"): string[] {
  const rows: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    rows.push(
      [...word]
        .map((letter) => {
          const glyph = GLYPHS[letter];
          if (!glyph) {
            throw new Error(`No glyph for ${letter}`);
          }
          return glyph[r] ?? "";
        })
        .join("")
    );
  }
  return rows;
}

export const WORDMARK_WIDTH = [...(wordmarkRows()[0] ?? "")].length;

/** Gold at the top, red at the bottom, like the sun on the landing page. */
const GRADIENT = [
  [234, 182, 25],
  [232, 160, 30],
  [224, 132, 36],
  [217, 107, 42],
  [211, 74, 37],
  [204, 41, 31],
] as const;

function tint(text: string, row: number): string {
  if (!colorEnabled) {
    return text;
  }
  const [r, g, b] = GRADIENT[Math.min(row, GRADIENT.length - 1)] ?? [0, 0, 0];
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

export function banner(tagline = "HackSpain 2026 · Madrid"): string {
  const columns = process.stdout.columns ?? 80;
  if (columns < WORDMARK_WIDTH + 2) {
    return `${BRAND} ${c.dim(`· ${tagline}`)}`;
  }
  const art = wordmarkRows().map((row, i) => tint(row, i));
  return `${art.join("\n")}\n${c.dim(tagline)}`;
}
