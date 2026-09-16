import { c, stripAnsi, width } from "./style";

/**
 * Shared terminal chrome for the menu, the home board, and `hackspain watch`.
 * Boxes, truncation and wrapping live here so the two TUIs do not drift.
 */

export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function pad(text: string, size: number): string {
  return text + " ".repeat(Math.max(0, size - width(text)));
}

/** Cut to `max` visible cells; strips colour when it has to cut. */
export function fit(text: string, max: number): string {
  if (width(text) <= max) {
    return text;
  }
  let out = "";
  for (const ch of stripAnsi(text)) {
    if (width(`${out}${ch}`) > Math.max(0, max - 1)) {
      break;
    }
    out += ch;
  }
  return `${out}…`;
}

export function wrap(text: string, w: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && width(`${current} ${word}`) > w) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

export type BoxAccent = "gold" | "orange" | "teal";

export type BoxOptions = {
  title: string;
  subtitle?: string;
  accent?: BoxAccent;
  /** Exact number of body rows; content is cut or padded to it. */
  height?: number;
};

const accentPaint: Record<BoxAccent, (text: string) => string> = {
  gold: c.gold,
  orange: c.orange,
  teal: c.teal,
};

/** Rounded box: gold title inset on the top border, optional subtitle on the right. */
export function box(options: BoxOptions, lines: string[], w: number): string[] {
  const inner = w - 4;
  const border = accentPaint[options.accent ?? "teal"];
  const title = `${border("╭─ ")}${c.bold(c.gold(options.title))}${border(" ")}`;
  const sub = options.subtitle
    ? `${c.dim(options.subtitle)}${border(" ")}`
    : "";
  const filler = Math.max(0, w - width(title) - width(sub) - 1);
  const top = `${title}${border("─".repeat(filler))}${sub}${border("╮")}`;
  const rows =
    options.height === undefined ? [...lines] : lines.slice(0, options.height);
  while (options.height !== undefined && rows.length < options.height) {
    rows.push("");
  }
  const body = rows.map(
    (line) => `${border("│")} ${pad(fit(line, inner), inner)} ${border("│")}`
  );
  const bottom = border(`╰${"─".repeat(w - 2)}╯`);
  return [top, ...body, bottom];
}

/** Dim keys, aligned, values fitted to the remaining inner width. */
export function kvLines(rows: [string, string][], inner: number): string[] {
  if (rows.length === 0) {
    return [];
  }
  const keyW = Math.max(...rows.map(([key]) => width(key)));
  return rows.map(([key, value]) => {
    const keyPad = `${c.dim(pad(key, keyW))}  `;
    return `${keyPad}${fit(value, Math.max(8, inner - width(keyPad)))}`;
  });
}
