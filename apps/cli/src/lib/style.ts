/**
 * Terminal colours in the HackSpain palette (paper/gold/orange/red/teal/navy).
 * No dependency: a handful of ANSI wrappers that turn into plain text when
 * colour is off (NO_COLOR, --json, or no TTY), so tests and pipes stay clean.
 */
export const colorEnabled: boolean =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (Boolean(process.env.FORCE_COLOR) || Boolean(process.stdout.isTTY));

function wrap(open: string, close = "\x1b[39m") {
  return (text: string): string =>
    colorEnabled ? `${open}${text}${close}` : text;
}

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;

export const c = {
  gold: wrap(rgb(234, 182, 25)),
  orange: wrap(rgb(217, 107, 42)),
  red: wrap(rgb(204, 41, 31)),
  teal: wrap(rgb(53, 133, 138)),
  navy: wrap(rgb(143, 184, 209)),
  green: wrap("\x1b[32m"),
  dim: wrap("\x1b[2m", "\x1b[22m"),
  bold: wrap("\x1b[1m", "\x1b[22m"),
  italic: wrap("\x1b[3m", "\x1b[23m"),
};

/** `hackspain team join ABCD1234` → styled command for copy/paste. */
export function cmd(text: string): string {
  return c.gold(text);
}

export function highlight(text: string): string {
  return c.bold(c.gold(text));
}

export const BRAND = `${c.gold("⚡")} ${c.bold("hackspain")}`;

export function stripAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are control chars by definition
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Visible width, ignoring colour codes. Good enough for our ASCII-heavy tables. */
export function width(text: string): number {
  return [...stripAnsi(text)].length;
}
