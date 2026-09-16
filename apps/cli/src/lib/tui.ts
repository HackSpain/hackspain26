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

/** Two-space inset so stacked cards sit like the watcher grid, not flush. */
export const CARD_INDENT = "  ";

/** Box width for the home board and the menu: nearly full terminal, like watch. */
export function cardWidth(columns = process.stdout.columns ?? 80): number {
  return Math.max(40, columns - CARD_INDENT.length * 2);
}

export function indentLines(lines: string[], indent = CARD_INDENT): string[] {
  return lines.map((line) => `${indent}${line}`);
}

export type PickItem<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
};

export const PICK_CANCEL: unique symbol = Symbol("hackspain:cancel");

export function isPickCancel(value: unknown): value is typeof PICK_CANCEL {
  return value === PICK_CANCEL;
}

export type PickKey = "up" | "down" | "enter" | "cancel" | "ignore";

export function parsePickKey(data: string): PickKey {
  if (
    data === "\u0003" ||
    data === "\u0004" ||
    data === "q" ||
    data === "\x1b" ||
    data === "\x1b\x1b"
  ) {
    return "cancel";
  }
  if (data === "\r" || data === "\n") {
    return "enter";
  }
  if (data === "k" || data === "\x1b[A" || data === "\x1bOA") {
    return "up";
  }
  if (data === "j" || data === "\x1b[B" || data === "\x1bOB") {
    return "down";
  }
  return "ignore";
}

/** One watcher-style card: gold cursor, hints on the right, keys underneath. */
export function formatPickBox(
  title: string,
  items: PickItem[],
  selected: number,
  w: number
): string[] {
  const inner = w - 4;
  const rows = items.map((item, i) => {
    const on = i === selected;
    const mark = on ? c.gold("▸") : " ";
    const label = on ? c.bold(c.gold(item.label)) : item.label;
    const left = `${mark} ${label}`;
    if (!item.hint) {
      return fit(left, inner);
    }
    const hint = c.dim(item.hint);
    const gap = Math.max(1, inner - width(left) - width(hint));
    return fit(`${left}${" ".repeat(gap)}${hint}`, inner);
  });
  const keys = `${c.gold("↑↓")} ${c.dim("move")} ${c.dim("·")} ${c.gold("enter")} ${c.dim("select")} ${c.dim("·")} ${c.gold("q")} ${c.dim("back")}`;
  return [...box({ title }, rows, w), keys];
}

/**
 * Interactive copy of `formatPickBox`. Esc / q cancel; arrows or j/k move.
 * Erases itself on return so the next screen (command output, submenu) is clean.
 */
export async function pickInBox<T extends string>(options: {
  title: string;
  items: PickItem<T>[];
  width?: number;
}): Promise<T | typeof PICK_CANCEL> {
  const items = options.items;
  if (items.length === 0) {
    return PICK_CANCEL;
  }
  const w = options.width ?? cardWidth();
  let selected = 0;
  const stdin = process.stdin;
  const stdout = process.stdout;
  const raw = Boolean(stdin.isTTY);
  const painted = (): string[] =>
    indentLines(formatPickBox(options.title, items, selected, w));

  const paint = (previous = 0): number => {
    const lines = painted();
    if (previous > 0) {
      stdout.write(`\x1B[${previous}A\x1B[J`);
    }
    stdout.write(`${lines.join("\n")}\n`);
    return lines.length;
  };

  stdout.write("\x1B[?25l");
  if (raw) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  let rows = paint();
  try {
    for (;;) {
      const data = await new Promise<string>((resolve) => {
        stdin.once("data", (chunk: Buffer | string) => {
          resolve(typeof chunk === "string" ? chunk : chunk.toString());
        });
      });
      const key = parsePickKey(data);
      if (key === "ignore") {
        continue;
      }
      if (key === "cancel") {
        stdout.write(`\x1B[${rows}A\x1B[J`);
        return PICK_CANCEL;
      }
      if (key === "enter") {
        stdout.write(`\x1B[${rows}A\x1B[J`);
        return items[selected]?.value ?? PICK_CANCEL;
      }
      selected =
        key === "down"
          ? (selected + 1) % items.length
          : (selected - 1 + items.length) % items.length;
      rows = paint(rows);
    }
  } finally {
    if (raw) {
      stdin.setRawMode(false);
    }
    stdin.pause();
    stdout.write("\x1B[?25h");
  }
}
