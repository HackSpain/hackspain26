import { LOGO_HEIGHT, LOGO_WIDTH, logoPng } from "../assets/logo";
import { BRAND, c, colorEnabled } from "./style";
import type { ImageProtocol } from "./term-images";
import {
  detectImageProtocol,
  imageCells,
  itermSequence,
  kittyDelete,
  kittySequence,
} from "./term-images";

/**
 * Block-letter wordmark assembled from per-glyph rows (ANSI Shadow style) so
 * the columns always line up. 69 cells wide; below that width the small
 * brand mark is used instead.
 */
const GLYPHS: Record<string, string[]> = {
  A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  C: [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
  H: ["██╗  ██╗", "██║  ██║", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  K: ["██╗  ██╗", "██║ ██╔╝", "█████╔╝ ", "██╔═██╗ ", "██║  ██╗", "╚═╝  ╚═╝"],
  N: [
    "███╗   ██╗",
    "████╗  ██║",
    "██╔██╗ ██║",
    "██║╚██╗██║",
    "██║ ╚████║",
    "╚═╝  ╚═══╝",
  ],
  P: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔═══╝ ", "██║     ", "╚═╝     "],
  S: ["███████╗", "██╔════╝", "███████╗", "╚════██║", "███████║", "╚══════╝"],
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
  return `\x1B[38;2;${r};${g};${b}m${text}\x1B[39m`;
}

/** Rows the picture takes: the same six the block letters use. */
const LOGO_ROWS = ROWS;
/** Narrower than this and even the picture is a smudge; use the small mark. */
const LOGO_MIN_COLUMNS = 24;
/** Fixed kitty id: every banner replaces the previous one instead of stacking. */
const LOGO_KITTY_ID = 9001;

/**
 * The wordmark as a picture, drawn at the cursor, for terminals that can.
 * Null when the terminal is too narrow for it to read.
 */
export function logoBanner(
  protocol: ImageProtocol,
  columns: number
): string | null {
  if (columns < LOGO_MIN_COLUMNS) {
    return null;
  }
  const cells = imageCells(LOGO_WIDTH, LOGO_HEIGHT, {
    maxColumns: columns - 2,
    maxRows: LOGO_ROWS,
  });
  const png = logoPng();
  if (protocol === "kitty") {
    return (
      kittyDelete(LOGO_KITTY_ID) +
      kittySequence(png, cells.columns, cells.rows, LOGO_KITTY_ID)
    );
  }
  return itermSequence(png, cells.columns, cells.rows);
}

export type BannerOptions = {
  /** Terminal width; defaults to stdout's. */
  columns?: number;
  /** Image protocol to draw with; null forces text. Defaults to detection. */
  protocol?: ImageProtocol | null;
};

/**
 * The HackSpain wordmark plus a tagline: the real logo where the terminal
 * draws images, block letters on wide text terminals, the small mark
 * elsewhere. Every screen that opens with the brand goes through here.
 */
export function banner(
  tagline = "HackSpain 2026 · Madrid",
  options: BannerOptions = {}
): string {
  const columns = options.columns ?? process.stdout.columns ?? 80;
  const protocol =
    options.protocol === undefined
      ? detectImageProtocol(process.env, Boolean(process.stdout.isTTY))
      : options.protocol;
  if (protocol) {
    const logo = logoBanner(protocol, columns);
    if (logo) {
      return `${logo}\n${c.dim(tagline)}`;
    }
  }
  if (columns < WORDMARK_WIDTH + 2) {
    return `${BRAND} ${c.dim(`· ${tagline}`)}`;
  }
  const art = wordmarkRows().map((row, i) => tint(row, i));
  return `${art.join("\n")}\n${c.dim(tagline)}`;
}
