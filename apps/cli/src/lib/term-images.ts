/**
 * Inline pictures for `hackspain feed` and the watcher's feed band.
 * Terminals disagree on how to draw an image, so the CLI speaks the two
 * protocols that accept PNG bytes as they are (Kitty graphics and iTerm2
 * inline images) and falls back to printing the link everywhere else.
 * Nothing here decodes pixels: the server returns a PNG already resized
 * (`/api/files/<id>?w=`) and the PNG header tells us the aspect ratio.
 */

export type ImageProtocol = "kitty" | "iterm";

/** Columns an inline image may take in `hackspain feed`. */
export const IMAGE_COLUMNS = 36;
/** Rows an inline image may take; wider-than-tall pictures hit the columns first. */
export const IMAGE_MAX_ROWS = 12;
/** Pixels asked from the server per column; ~cell width on a HiDPI screen. */
export const PIXELS_PER_COLUMN = 16;
/** A terminal cell is roughly twice as tall as it is wide. */
const CELL_ASPECT = 2;
const KITTY_CHUNK = 4096;
// The 8-byte PNG signature, in decimal so Biome and oxlint agree on case.
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const KONSOLE_WITH_KITTY_GRAPHICS = 220_400;
const ESC = String.fromCodePoint(27);
const BEL = String.fromCodePoint(7);

type Env = Record<string, string | undefined>;

export type ImageCells = { columns: number; rows: number };
export type ImageBounds = { maxColumns?: number; maxRows?: number };

/**
 * Which protocol, if any, this terminal understands. Conservative on
 * purpose: an unsupported escape sequence prints garbage, a link never does.
 * tmux swallows both protocols unless passthrough is configured, so it gets
 * the link too.
 */
export function detectImageProtocol(
  env: Env,
  isTty: boolean
): ImageProtocol | null {
  if (!isTty || env.HACKSPAIN_NO_IMAGES || env.TMUX) {
    return null;
  }
  const program = (env.TERM_PROGRAM ?? "").toLowerCase();
  if (
    env.KITTY_WINDOW_ID ||
    env.TERM === "xterm-kitty" ||
    env.GHOSTTY_RESOURCES_DIR ||
    env.WEZTERM_EXECUTABLE ||
    program === "ghostty" ||
    program === "wezterm"
  ) {
    return "kitty";
  }
  const konsole = Number.parseInt(env.KONSOLE_VERSION ?? "", 10);
  if (Number.isFinite(konsole) && konsole >= KONSOLE_WITH_KITTY_GRAPHICS) {
    return "kitty";
  }
  if (
    program === "iterm.app" ||
    program === "warpterminal" ||
    program === "vscode" ||
    env.LC_TERMINAL === "iTerm2"
  ) {
    return "iterm";
  }
  return null;
}

/** Width and height from a PNG's IHDR chunk, or null if this is not a PNG. */
export function pngSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (bytes.length < 24) {
    return null;
  }
  for (const [i, expected] of PNG_SIGNATURE.entries()) {
    if (bytes[i] !== expected) {
      return null;
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) {
    return null;
  }
  return { height, width };
}

/**
 * Cells an image should occupy so it keeps its aspect on a 2:1 cell grid,
 * never wider than `maxColumns` nor taller than `maxRows`. Tall pictures
 * give up columns to stay under the row cap.
 */
export function imageCells(
  width: number,
  height: number,
  bounds: ImageBounds = {}
): ImageCells {
  const maxColumns = Math.max(1, bounds.maxColumns ?? IMAGE_COLUMNS);
  const maxRows = Math.max(1, bounds.maxRows ?? IMAGE_MAX_ROWS);
  let columns = Math.max(
    1,
    Math.min(maxColumns, Math.ceil(width / PIXELS_PER_COLUMN))
  );
  let rows = Math.max(
    1,
    Math.round((columns * (height / width)) / CELL_ASPECT)
  );
  if (rows > maxRows) {
    rows = maxRows;
    columns = Math.max(
      1,
      Math.min(maxColumns, Math.round((rows * CELL_ASPECT * width) / height))
    );
  }
  return { columns, rows };
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * One Kitty graphics command, splitting the payload into 4 KiB base64
 * chunks with `m=1` on all but the last. `q=2` on every command stops the
 * terminal from answering on stdin, which would land in the next prompt.
 */
function kittyCommand(control: string, payload?: Uint8Array): string {
  if (!payload) {
    return `${ESC}_G${control},q=2${ESC}\\`;
  }
  const data = base64(payload);
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += KITTY_CHUNK) {
    chunks.push(data.slice(i, i + KITTY_CHUNK));
  }
  return chunks
    .map((chunk, index) => {
      const more = index === chunks.length - 1 ? 0 : 1;
      const head = index === 0 ? `${control},q=2,m=${more}` : `m=${more}`;
      return `${ESC}_G${head};${chunk}${ESC}\\`;
    })
    .join("");
}

/**
 * Kitty: transmit a PNG and display it at the cursor over `columns`×`rows`.
 * With `id`, the image is stored under that id so sending it again replaces
 * the earlier copy instead of piling up (the banner on a redrawn menu).
 */
export function kittySequence(
  png: Uint8Array,
  columns: number,
  rows: number,
  id?: number
): string {
  const named = id === undefined ? "" : `,i=${id}`;
  return kittyCommand(`a=T,f=100,c=${columns},r=${rows}${named}`, png);
}

/** Kitty: store a PNG under `id` without showing it (the watcher places it later). */
export function kittyTransmit(png: Uint8Array, id: number): string {
  return kittyCommand(`a=t,i=${id},f=100`, png);
}

/** Kitty: show stored image `id` at the cursor over `columns`×`rows`. */
export function kittyPlace(id: number, columns: number, rows: number): string {
  return kittyCommand(`a=p,i=${id},c=${columns},r=${rows}`);
}

/** Kitty: remove every placement of stored image `id`, keeping its data. */
export function kittyDelete(id: number): string {
  return kittyCommand(`a=d,d=i,i=${id}`);
}

/** Kitty: remove every visible placement and free all stored image data. */
export function kittyDeleteAll(): string {
  return kittyCommand("a=d,d=A");
}

/**
 * iTerm2 inline image (OSC 1337 File) scaled to fit `columns`×`rows` cells
 * with its aspect preserved. Also understood by WezTerm, Warp and VS Code.
 */
export function itermSequence(
  png: Uint8Array,
  columns: number,
  rows: number
): string {
  const data = base64(png);
  return `${ESC}]1337;File=inline=1;size=${png.byteLength};width=${columns};height=${rows};preserveAspectRatio=1:${data}${BEL}`;
}

/**
 * The escape sequence that draws `png` with `protocol`, or null when the
 * bytes are not a PNG (the caller then prints the link instead).
 */
export function renderImage(
  protocol: ImageProtocol,
  png: Uint8Array,
  bounds: ImageBounds = {}
): string | null {
  const size = pngSize(png);
  if (!size) {
    return null;
  }
  const { columns, rows } = imageCells(size.width, size.height, bounds);
  return protocol === "kitty"
    ? kittySequence(png, columns, rows)
    : itermSequence(png, columns, rows);
}
