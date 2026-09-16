import { harnessLogo, harnessLogoIds } from "../assets/harness-logos";
import { LOGO_HEIGHT, LOGO_WIDTH, logoPng } from "../assets/logo";
import { WORDMARK_WIDTH, wordmarkLines } from "../lib/banner";
import type { FeedItem } from "../lib/feed-format";
import { postLines } from "../lib/feed-format";
import { compactNumber, formatAgo, renderTable } from "../lib/output";
import { BRAND, c, colorEnabled, width } from "../lib/style";
import { imageCells } from "../lib/term-images";
import { box, fit, kvLines, pad, SPINNER, wrap } from "../lib/tui";
import type { ImageSlot } from "./images";
import { ScreenImages } from "./images";
import type { WatchState } from "./state";
import { WATCH_IMAGE_BOUNDS } from "./state";

/**
 * Full-terminal live view for `hackspain watch`: a grid of rounded boxes
 * that fills the terminal, built from tables rather than charts because
 * tables are what people actually read at a glance. `frame()` is pure
 * (state + size → lines) so it is testable; `startScreen()` owns the
 * alternate screen buffer, redraws changed rows once a second, and maps
 * key presses onto the state.
 */
const MIN_WIDTH = 40;
const ESC = String.fromCodePoint(27);
/** Column of post text inside the feed box: border, space, three-space indent. */
const FEED_TEXT_COL = 5;
/** Keys that move the feed view, and by how many posts. */
const FEED_SCROLL_KEYS: Record<string, number> = {
  j: 1,
  k: -1,
  [`${ESC}[B`]: 1,
  [`${ESC}[A`]: -1,
  [`${ESC}[6~`]: 5,
  [`${ESC}[5~`]: -5,
};
const FEED_LIVE_KEYS = new Set(["g", `${ESC}[H`]);

const HARNESS_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  cline: "Cline",
  codex: "Codex",
  copilot: "Copilot",
  cursor: "Cursor",
  "gemini-cli": "Gemini CLI",
  "kilo-code": "Kilo Code",
  opencode: "OpenCode",
  "qwen-code": "Qwen Code",
};

type Rgb = readonly [number, number, number];
const GOLD: Rgb = [234, 182, 25];
const ORANGE: Rgb = [217, 107, 42];
const TEAL: Rgb = [53, 133, 138];

/**
 * One glyph per harness, in a colour close to its brand, so the tables scan
 * at a glance. Single-cell symbols only; the names stay as the label.
 */
const HARNESS_BRAND: Record<string, { glyph: string; color: Rgb }> = {
  "claude-code": { color: [217, 119, 87], glyph: "✻" },
  cline: { color: [99, 102, 241], glyph: "▣" },
  codex: { color: [16, 163, 127], glyph: "⬡" },
  copilot: { color: [139, 92, 246], glyph: "◉" },
  cursor: { color: [160, 166, 176], glyph: "▍" },
  "gemini-cli": { color: [66, 133, 244], glyph: "✦" },
  "kilo-code": { color: [250, 204, 21], glyph: "⬢" },
  opencode: { color: [34, 197, 94], glyph: "◆" },
  "qwen-code": { color: [97, 91, 255], glyph: "❋" },
};
const UNKNOWN_BRAND = { color: TEAL, glyph: "●" } as const;

/** "✻ Claude Code": brand glyph plus name; dimmed as a whole when `muted`. */
export function harnessLabel(id: string, muted = false): string {
  const brand = HARNESS_BRAND[id] ?? UNKNOWN_BRAND;
  const name = HARNESS_NAMES[id] ?? id;
  return muted
    ? c.dim(`${brand.glyph} ${name}`)
    : `${rgb(brand.color, brand.glyph)} ${name}`;
}

/** Cells the real logo takes in a table row: one row high, square on a 2:1 grid. */
const HARNESS_LOGO_CELLS = { columns: 2, rows: 1 } as const;
/** Slot key for a harness logo picture. */
export function harnessLogoKey(id: string): string {
  return `harness:${id}`;
}

/**
 * Label with room for the real logo instead of the glyph: two blank cells
 * the screen covers with the picture. Only when the terminal draws images
 * and a logo exists for the harness; otherwise the glyph label.
 */
function harnessLabelForLogo(id: string, muted: boolean): string {
  const name = HARNESS_NAMES[id] ?? id;
  return muted ? c.dim(`   ${name}`) : `   ${name}`;
}

/** Header picture: the wordmark over the rows the ASCII version would take. */
export const LOGO_ROWS = 6;

function rgb(color: Rgb, text: string): string {
  if (!colorEnabled) {
    return text;
  }
  return `${ESC}[38;2;${color[0]};${color[1]};${color[2]}m${text}${ESC}[39m`;
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clockSeconds(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "17:05" today, "Fri 18 Sep 17:05" otherwise. */
export function sinceLabel(at: number, now: number): string {
  const then = new Date(at);
  const today = new Date(now);
  const sameDay =
    then.getFullYear() === today.getFullYear() &&
    then.getMonth() === today.getMonth() &&
    then.getDate() === today.getDate();
  if (sameDay) {
    return clock(at);
  }
  const day = then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
  return `${day} ${clock(at)}`;
}

function elapsed(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Horizontal gauge: filled share in colour, the rest dim. Used for the scan countdown. */
export function gauge(
  fraction: number,
  size: number,
  color: Rgb = GOLD
): string {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * size);
  return `${rgb(color, "█".repeat(filled))}${c.dim("░".repeat(size - filled))}`;
}

/** What this screen is and how to use it. Always visible; shorter when rows are scarce. */
function explainerBox(
  state: WatchState,
  w: number,
  compact: boolean
): string[] {
  const inner = w - 4;
  const team = state.team ? state.team.name : "your team";
  const paragraphs = compact
    ? [
        `Leave this running in a spare terminal while you build. It puts ${team} on the live board and shows organiser announcements here. Only counts leave your machine, never prompts or code.`,
        `${c.bold("q")} quits  ·  ${c.bold("p")} pauses`,
      ]
    : [
        `Leave this running in a spare terminal while you build. It is how ${team} shows up on the live board that everyone at the venue sees, and how organisers know who is shipping.`,
        "Announcements from the organisers land here and as a desktop notification, so you do not miss lunch, judging slots or a schedule change while you are heads down.",
        `Only counts and totals leave your machine, never prompts or code.  ${c.bold("q")} quits  ·  ${c.bold("p")} pauses  ·  ${c.bold("hackspain --help")} for the rest`,
      ];
  const lines = paragraphs.flatMap((p) => wrap(p, inner));
  return box({ title: "Keep this open" }, lines, w);
}

function youBox(state: WatchState, w: number): string[] {
  const team = state.team
    ? `${c.bold(state.team.name)} ${c.dim(`· ${state.team.members} member${state.team.members === 1 ? "" : "s"}${state.team.isOwner ? " · you own it" : ""}`)}`
    : c.dim("no team yet · hackspain team create <name>");
  const project = state.project
    ? `${state.project.name || c.dim("(untitled draft)")} ${c.dim(`· ${state.project.status}${state.project.tracks.length ? ` · ${state.project.tracks.join(", ")}` : " · no track yet"}`)}`
    : c.dim("no project yet · hackspain submit --draft");
  const repo =
    state.team?.repoUrl?.replace("https://github.com/", "") ??
    c.dim("not set · hackspain team repo <url>");
  return box(
    { height: 3, title: state.me.name },
    kvLines(
      [
        ["Team", team],
        ["Project", project],
        ["Repo", repo],
      ],
      w - 4
    ),
    w
  );
}

function harnessStatus(lastEventAt: number | undefined, now: number): string {
  if (lastEventAt === undefined) {
    return rgb(TEAL, "● waiting");
  }
  if (now - lastEventAt < 5 * 60 * 1000) {
    return rgb(GOLD, "● live");
  }
  return rgb(TEAL, "● idle");
}

/** A picture slot relative to a box body; `frame` makes it absolute. */
type BodySlot = Omit<ImageSlot, "row"> & { bodyRow: number };

/** Rows in the harness table body before the first harness: header and rule. */
const HARNESS_TABLE_HEAD_ROWS = 2;
/** Column of the logo inside the box: border plus one space. */
const HARNESS_LOGO_COL = 2;

function harnessesBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): { lines: string[]; slots: BodySlot[] } {
  const slots: BodySlot[] = [];
  const withLogos = Boolean(state.imageProtocol);
  const label = (id: string, muted: boolean, index: number) => {
    if (withLogos && harnessLogo(id)) {
      slots.push({
        bodyRow: HARNESS_TABLE_HEAD_ROWS + index,
        col: HARNESS_LOGO_COL,
        columns: HARNESS_LOGO_CELLS.columns,
        key: harnessLogoKey(id),
        rows: HARNESS_LOGO_CELLS.rows,
      });
      return harnessLabelForLogo(id, muted);
    }
    return harnessLabel(id, muted);
  };
  const rows: string[][] = state.harnesses.map((harness, index) =>
    harness.found
      ? [
          label(harness.id, false, index),
          harnessStatus(harness.lastEventAt, now),
          compactNumber(harness.requests),
          compactNumber(harness.tokens),
          c.dim(compactNumber(harness.cached)),
          harness.lastEventAt
            ? c.dim(formatAgo(harness.lastEventAt, now))
            : c.dim("–"),
        ]
      : [
          label(harness.id, true, index),
          c.dim("○ not on this machine"),
          c.dim("–"),
          c.dim("–"),
          c.dim("–"),
          c.dim("–"),
        ]
  );
  const t = state.totals;
  // "Tokens" is what the model actually read fresh and wrote back. Cache
  // reads run to hundreds of thousands per turn on long sessions and would
  // dwarf everything else, so they get their own dim column.
  rows.push([
    c.bold("Total"),
    c.dim(`${t.sessions.size} session${t.sessions.size === 1 ? "" : "s"}`),
    c.bold(compactNumber(t.requests)),
    c.bold(compactNumber(t.input + t.output)),
    c.dim(compactNumber(t.cached)),
    "",
  ]);
  const table = renderTable(rows, [
    "Harness",
    "Status",
    "Requests",
    "Tokens",
    "Cached",
    "Last",
  ]).split("\n");
  const breakdown = `${c.dim("tokens:")} ${compactNumber(t.input)} ${c.dim("in")} · ${compactNumber(t.output)} ${c.dim("out")} · ${c.dim(`${compactNumber(t.cached)} cached, not counted above`)}`;
  return {
    lines: box(
      {
        height: h,
        subtitle: state.trackedSince
          ? `since ${sinceLabel(state.trackedSince, now)}`
          : "what is being reported",
        title: "Harnesses",
      },
      [...table, "", breakdown],
      w
    ),
    // Only rows the box actually shows.
    slots: slots.filter((slot) => slot.bodyRow < h),
  };
}

function recentBox(state: WatchState, w: number, h: number): string[] {
  // Narrow boxes drop the harness and session columns so the model and
  // token counts stay readable.
  const compact = w < 80;
  const rows = state.recent.slice(0, Math.max(0, h - 2)).map((r) => {
    const cells = [
      c.dim(clockSeconds(r.at)),
      r.model,
      compactNumber(r.input),
      compactNumber(r.output),
      compactNumber(r.cached),
    ];
    return compact
      ? cells
      : [
          cells[0] ?? "",
          harnessLabel(r.harness),
          ...cells.slice(1),
          c.dim(r.sessionId.slice(0, 8)),
        ];
  });
  const headers = compact
    ? ["Time", "Model", "In", "Out", "Cached"]
    : ["Time", "Harness", "Model", "In", "Out", "Cached", "Session"];
  const lines =
    rows.length === 0
      ? wrap(
          "Nothing reported yet. Use your AI tool and the next scan will list the requests here.",
          w - 4
        ).map((l) => c.dim(l))
      : renderTable(rows, headers).split("\n");
  return box(
    { height: h, subtitle: "newest first", title: "Recent requests" },
    lines,
    w
  );
}

function organisersBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): string[] {
  const inner = w - 4;
  const lines: string[] = [];
  if (state.notifications.length === 0) {
    lines.push(c.dim("Nothing yet."));
    lines.push(
      ...wrap(
        "Announcements from the organisers land here the moment they are sent.",
        inner
      ).map((l) => c.dim(l))
    );
  }
  for (const n of state.notifications) {
    lines.push(`${rgb(GOLD, clock(n.at))}  ${c.bold(n.subject)}`);
    for (const bodyLine of n.body.split("\n")) {
      lines.push(...wrap(bodyLine, inner - 7).map((l) => `       ${l}`));
    }
    lines.push("");
    if (lines.length >= h) {
      break;
    }
  }
  const fresh =
    state.notifications[0] && now - state.notifications[0].at < 60 * 1000;
  return box(
    {
      accent: fresh ? "gold" : "teal",
      height: h,
      subtitle: `${state.notifications.length} message${state.notifications.length === 1 ? "" : "s"}`,
      title: "Organisers",
    },
    lines,
    w
  );
}

function postBlock(post: FeedItem, now: number, inner: number): string[] {
  const [head, ...rest] = postLines(post, now);
  return [
    ...(head ? [fit(head, inner)] : []),
    ...rest.flatMap((line) =>
      wrap(line.trim(), inner - 3).map((l) => `   ${l}`)
    ),
  ];
}

/**
 * The feed band. Posts from `feedOffset` down; a post with a fetched
 * thumbnail reserves blank rows for it (the screen draws the picture there)
 * and drops its link. When the picture does not fit, the link comes back.
 */
function feedBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): { lines: string[]; slots: BodySlot[] } {
  const inner = w - 4;
  const lines: string[] = [];
  const slots: BodySlot[] = [];
  const visible = state.feed.slice(state.feedOffset);
  if (state.feed.length === 0) {
    lines.push(c.dim("Quiet so far."));
    lines.push(
      ...wrap(
        'Posts from everyone and pushes from every team repo land here. Try: hackspain post "we are alive"',
        inner
      ).map((l) => c.dim(l))
    );
  } else if (visible.length === 0) {
    lines.push(c.dim("Nothing older loaded. ↑ or g goes back to live."));
  }
  const bounds = {
    maxColumns: Math.min(WATCH_IMAGE_BOUNDS.maxColumns, Math.max(1, inner - 3)),
    maxRows: WATCH_IMAGE_BOUNDS.maxRows,
  };
  for (const post of visible) {
    const image = state.imageProtocol
      ? state.feedImages.get(post._id)
      : undefined;
    const cells = image ? imageCells(image.width, image.height, bounds) : null;
    let block = cells
      ? postBlock({ ...post, imageUrl: undefined }, now, inner)
      : postBlock(post, now, inner);
    let slot: BodySlot | null = null;
    if (cells && lines.length + block.length + cells.rows <= h) {
      slot = {
        bodyRow: lines.length + block.length,
        col: FEED_TEXT_COL,
        columns: cells.columns,
        key: post._id,
        rows: cells.rows,
      };
      block = [...block, ...Array.from({ length: cells.rows }, () => "")];
    } else if (cells) {
      block = postBlock(post, now, inner);
    }
    // Whole posts only: a header with its text cut off reads as a bug.
    if (lines.length > 0 && lines.length + block.length > h) {
      break;
    }
    if (slot) {
      slots.push(slot);
    }
    lines.push(...block);
  }
  const fresh = state.feed[0] && now - state.feed[0].createdAt < 60 * 1000;
  const subtitle =
    state.feedOffset > 0
      ? `${state.feedOffset} newer above · ↑ back${state.feedNeedOlder ? " · loading older…" : ""}`
      : "everyone · newest first · ↓ older";
  return {
    lines: box(
      {
        accent: fresh && state.feedOffset === 0 ? "gold" : "teal",
        height: h,
        subtitle,
        title: "Feed",
      },
      lines,
      w
    ),
    slots,
  };
}

function statusLine(
  state: WatchState,
  now: number,
  tick: number,
  w: number,
  intervalMs: number
): string {
  const parts: string[] = [];
  if (state.paused) {
    parts.push(rgb(ORANGE, "⏸ paused"));
  } else if (state.scanning) {
    parts.push(`${rgb(GOLD, SPINNER[tick % SPINNER.length] ?? "⠋")} scanning`);
  } else if (state.nextScanAt) {
    const remaining = Math.max(0, state.nextScanAt - now);
    const progress = 1 - Math.min(1, remaining / Math.max(1, intervalMs));
    parts.push(
      `${gauge(progress, 10, TEAL)} ${c.dim(`next scan ${Math.ceil(remaining / 1000)}s`)}`
    );
  }
  if (state.upload.enabled) {
    if (state.upload.failing) {
      parts.push(
        `${c.red("✖")} upload retrying ${c.dim(`(${state.upload.queued} queued)`)}`
      );
    } else if (state.upload.lastOkAt) {
      parts.push(
        `${c.green("✔")} uploaded ${c.dim(formatAgo(state.upload.lastOkAt, now))}`
      );
    } else {
      parts.push(c.dim("upload pending"));
    }
  } else {
    parts.push(c.dim("upload off"));
  }
  const right = `${c.gold("q")} quit ${c.dim("·")} ${c.gold("p")} ${state.paused ? "resume" : "pause"} ${c.dim("·")} ${c.gold("↑↓")} feed`;
  const left = fit(
    parts.join(c.dim("  ·  ")),
    Math.max(0, w - width(right) - 1)
  );
  return `${left}${" ".repeat(Math.max(1, w - width(left) - width(right)))}${right}`;
}

/**
 * Top of the board. Tall terminals get the wordmark: the real PNG when the
 * terminal draws images (blank rows reserved, the picture placed after the
 * text), the ASCII version otherwise. Short terminals get one line.
 */
function header(
  state: WatchState,
  now: number,
  w: number,
  tall: boolean
): { lines: string[]; slot?: ImageSlot } {
  const right = c.dim(`${clock(now)} · up ${elapsed(state.startedAt, now)}`);
  if (tall) {
    const tag = c.dim("live usage board · HackSpain 2026 · Madrid");
    const tagLine = `${tag}${" ".repeat(Math.max(1, w - width(tag) - width(right)))}${right}`;
    if (state.imageProtocol) {
      const cells = imageCells(LOGO_WIDTH, LOGO_HEIGHT, {
        maxColumns: w,
        maxRows: LOGO_ROWS,
      });
      return {
        lines: [...Array.from({ length: LOGO_ROWS }, () => ""), tagLine],
        slot: {
          col: 0,
          columns: cells.columns,
          key: "logo",
          row: 0,
          rows: cells.rows,
        },
      };
    }
    return { lines: [...wordmarkLines(), tagLine] };
  }
  const left = `${BRAND} ${c.dim("· live usage board")}`;
  return {
    lines: [
      `${left}${" ".repeat(Math.max(1, w - width(left) - width(right)))}${right}`,
    ],
  };
}

/** Place two column blocks side by side; the shorter one is padded. */
function columns(left: string[], leftWidth: number, right: string[]): string[] {
  const rows = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    out.push(`${pad(left[i] ?? "", leftWidth)}${right[i] ?? ""}`);
  }
  return out;
}

export type FrameOptions = { now?: number; tick?: number; intervalMs?: number };

export type Frame = { lines: string[]; slots: ImageSlot[] };

/** Text rows only; what the tests and the diff work on. */
export function frame(
  state: WatchState,
  size: { columns: number; rows: number },
  options: FrameOptions = {}
): string[] {
  return frameWithSlots(state, size, options).lines;
}

/** Text rows plus where the feed pictures go, in absolute screen cells. */
export function frameWithSlots(
  state: WatchState,
  size: { columns: number; rows: number },
  options: FrameOptions = {}
): Frame {
  const now = options.now ?? Date.now();
  const tick = options.tick ?? 0;
  const intervalMs = options.intervalMs ?? 30_000;
  const w = Math.max(MIN_WIDTH, size.columns);
  const h = size.rows;

  const tall = h >= 44 && w >= WORDMARK_WIDTH + 2;
  const head = header(state, now, w, tall);
  const status = statusLine(state, now, tick, w, intervalMs);
  const lines: string[] = [...head.lines];
  const available = h - head.lines.length - 1;
  const slots: ImageSlot[] = head.slot ? [head.slot] : [];
  /** Body slots of a box whose top border sits on screen row `top`. */
  const place = (top: number, bodySlots: BodySlot[]) => {
    slots.push(
      ...bodySlots.map((slot) => ({
        col: slot.col,
        columns: slot.columns,
        key: slot.key,
        row: top + 1 + slot.bodyRow,
        rows: slot.rows,
      }))
    );
  };
  const pushFeed = (feedH: number) => {
    const feed = feedBox(state, now, w, feedH);
    place(lines.length, feed.slots);
    lines.push(...feed.lines);
  };

  const harnessRows = state.harnesses.length + 5; // header, rule, per harness, total, blank, breakdown
  if (available < 14) {
    // Tiny terminal: the two things that matter.
    const feedH = Math.max(1, available - harnessRows - 4);
    const harnesses = harnessesBox(state, now, w, harnessRows);
    place(lines.length, harnesses.slots);
    lines.push(...harnesses.lines);
    lines.push(...organisersBox(state, now, w, feedH));
  } else if (w < 96) {
    // Narrow: one column. The explainer shrinks and the profile box goes
    // before the organiser feed ever loses its rows.
    const explainer = explainerBox(state, w, available < 34);
    const harnesses = harnessesBox(state, now, w, harnessRows);
    let you = youBox(state, w);
    let rest =
      available - explainer.length - harnesses.lines.length - you.length;
    if (rest < 5) {
      you = [];
      rest = available - explainer.length - harnesses.lines.length;
    }
    // Announcements get a few rows; the feed takes what is left.
    const announceH = Math.max(1, Math.min(5, Math.floor((rest - 4) / 3)));
    const feedH = Math.max(1, rest - announceH - 4);
    lines.push(...explainer, ...you);
    place(lines.length, harnesses.slots);
    lines.push(...harnesses.lines);
    lines.push(...organisersBox(state, now, w, announceH));
    pushFeed(feedH);
  } else {
    // Wide: explainer across the top; you + harnesses on the left beside
    // announcements + recent requests; the feed across the bottom so links
    // and posts get the full width.
    const explainer = explainerBox(state, w, available < 30);
    const leftW = Math.max(58, Math.floor(w * 0.55));
    const rightW = w - leftW;
    const lower = available - explainer.length;
    const you = youBox(state, leftW);
    // Columns take just over half the rows; the feed gets the rest, unless
    // that rest would be too short to show a single post.
    const minColumnsH = you.length + harnessRows + 2;
    let columnsH = Math.max(minColumnsH, Math.floor(lower * 0.55));
    if (lower - columnsH - 2 < 4) {
      columnsH = lower;
    }
    const harnessH = Math.max(harnessRows, columnsH - you.length - 2);
    const harnesses = harnessesBox(state, now, leftW, harnessH);
    // The left column starts at screen column 0, right after the explainer.
    place(lines.length + explainer.length + you.length, harnesses.slots);
    const left = [...you, ...harnesses.lines];
    const rightRows = left.length;
    const announceH = Math.max(2, Math.min(6, Math.floor(rightRows / 3)));
    const recentH = Math.max(1, rightRows - announceH - 4);
    const right = [
      ...organisersBox(state, now, rightW, announceH),
      ...recentBox(state, rightW, recentH),
    ];
    lines.push(...explainer, ...columns(left, leftW, right));
    const feedH = lower - left.length - 2;
    if (feedH >= 2) {
      pushFeed(feedH);
    }
  }

  const body = lines.slice(0, Math.max(0, h - 1));
  while (body.length < h - 1) {
    body.push("");
  }
  return {
    lines: [...body, status].map((l) => fit(l, w)),
    // Only pictures that fit fully above the status line.
    slots: slots.filter((slot) => slot.row + slot.rows <= h - 1),
  };
}

export type ScreenHandle = { stop: () => void; redraw: () => void };

/** Rows that differ between two frames; undefined means "repaint everything". */
export function diffFrame(
  previous: string[] | undefined,
  next: string[]
): { row: number; line: string }[] | undefined {
  if (!previous || previous.length !== next.length) {
    return;
  }
  const changes: { row: number; line: string }[] = [];
  for (const [row, line] of next.entries()) {
    if (line !== previous[row]) {
      changes.push({ line, row });
    }
  }
  return changes;
}

export function startScreen(
  state: WatchState,
  handlers: {
    onQuit: () => void;
    onTogglePause: () => void;
    /** Move the feed view by `delta` posts (↓/j older, ↑/k newer, PgUp/PgDn by five). */
    onFeedScroll?: (delta: number) => void;
    /** Back to the newest posts (g or Home). */
    onFeedLive?: () => void;
    intervalMs: number;
  }
): ScreenHandle {
  const out = process.stdout;
  const size = () => ({ columns: out.columns ?? 80, rows: out.rows ?? 24 });
  let ticks = 0;
  let previous: string[] | undefined;
  const images = state.imageProtocol
    ? new ScreenImages(state.imageProtocol, (text) => out.write(text))
    : null;
  // Once a second, and only the rows that changed: an idle board costs the
  // terminal a couple of short lines per second instead of a full repaint.
  // Pictures are reconciled after the text, against the slots the frame
  // reserved for them.
  const draw = (force = false) => {
    ticks++;
    const { lines, slots } = frameWithSlots(state, size(), {
      intervalMs: handlers.intervalMs,
      tick: ticks,
    });
    const changes = force ? undefined : diffFrame(previous, lines);
    if (changes === undefined) {
      out.write(
        `${ESC}[H${lines.map((l) => `${l}${ESC}[K`).join("\n")}${ESC}[J`
      );
    } else if (changes.length > 0) {
      out.write(
        changes
          .map(({ row, line }) => `${ESC}[${row + 1};1H${line}${ESC}[K`)
          .join("")
      );
    }
    if (images) {
      const pngs = new Map<string, Uint8Array>([["logo", logoPng()]]);
      for (const id of harnessLogoIds()) {
        const png = harnessLogo(id);
        if (png) {
          pngs.set(harnessLogoKey(id), png);
        }
      }
      for (const [key, image] of state.feedImages) {
        pngs.set(key, image.png);
      }
      images.sync(
        slots,
        pngs,
        changes === undefined ? "all" : new Set(changes.map((x) => x.row))
      );
    }
    previous = lines;
  };

  out.write(`${ESC}[?1049h${ESC}[?25l${ESC}[2J`);
  const timer = setInterval(() => draw(), 1000);
  const onResize = () => draw(true);
  out.on("resize", onResize);

  const { stdin } = process;
  const rawSupported = Boolean(stdin.isTTY);
  const onKey = (data: Buffer) => {
    const key = data.toString();
    if (key === "q" || key === "\u0003" || key === "\u0004") {
      handlers.onQuit();
    } else if (key === "p") {
      handlers.onTogglePause();
      draw();
    } else if (key in FEED_SCROLL_KEYS) {
      handlers.onFeedScroll?.(FEED_SCROLL_KEYS[key] ?? 0);
      draw();
    } else if (FEED_LIVE_KEYS.has(key)) {
      handlers.onFeedLive?.();
      draw();
    }
  };
  if (rawSupported) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onKey);
  }
  draw();

  return {
    redraw: draw,
    stop: () => {
      clearInterval(timer);
      out.off("resize", onResize);
      if (rawSupported) {
        stdin.off("data", onKey);
        stdin.setRawMode(false);
        stdin.pause();
      }
      images?.clear();
      out.write(`${ESC}[?25h${ESC}[?1049l`);
    },
  };
}

export function summaryLines(state: WatchState, now = Date.now()): string[] {
  const t = state.totals;
  const scope = state.trackedSince
    ? `Since ${sinceLabel(state.trackedSince, now)} (this run ${elapsed(state.startedAt, now)})`
    : `Watched for ${elapsed(state.startedAt, now)}`;
  return [
    `${scope} · ${compactNumber(t.requests)} request${t.requests === 1 ? "" : "s"} from ${t.sessions.size} session${t.sessions.size === 1 ? "" : "s"} reported${state.upload.enabled ? "" : " (local only)"} · ${state.notifications.length} organiser message${state.notifications.length === 1 ? "" : "s"}.`,
  ];
}
