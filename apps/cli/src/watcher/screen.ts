import { WORDMARK_WIDTH, wordmarkRows } from "../lib/banner";
import { compactNumber, formatAgo, renderTable } from "../lib/output";
import { c, colorEnabled, stripAnsi, width } from "../lib/style";
import type { WatchState } from "./state";

/**
 * Full-terminal live view for `hackspain watch`: a grid of rounded boxes
 * that fills the terminal, built from tables rather than charts because
 * tables are what people actually read at a glance. `frame()` is pure
 * (state + size → lines) so it is testable; `startScreen()` owns the
 * alternate screen buffer, redraws changed rows once a second, and maps
 * key presses onto the state.
 */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MIN_WIDTH = 40;

const HARNESS_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  cline: "Cline",
  cursor: "Cursor",
  copilot: "Copilot",
};

type Rgb = readonly [number, number, number];
const GOLD: Rgb = [234, 182, 25];
const ORANGE: Rgb = [217, 107, 42];
const TEAL: Rgb = [53, 133, 138];

function rgb(color: Rgb, text: string): string {
  if (!colorEnabled) {
    return text;
  }
  return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${text}\x1b[39m`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

/** Cut to `max` visible cells; strips colour when it has to cut. */
export function fit(text: string, max: number): string {
  if (width(text) <= max) {
    return text;
  }
  let out = "";
  for (const ch of stripAnsi(text)) {
    if (width(out + ch) > Math.max(0, max - 1)) {
      break;
    }
    out += ch;
  }
  return `${out}…`;
}

function padRight(text: string, size: number): string {
  return text + " ".repeat(Math.max(0, size - width(text)));
}

export type BoxOptions = {
  title: string;
  subtitle?: string;
  accent?: Rgb;
  /** Exact number of body rows; content is cut or padded to it. */
  height?: number;
};

/** Rounded box: title inset on the top border, optional subtitle on the right. */
export function box(options: BoxOptions, lines: string[], w: number): string[] {
  const inner = w - 4;
  const accent = options.accent ?? TEAL;
  const border = (s: string) => rgb(accent, s);
  const title = `${border("╭─ ")}${c.bold(rgb(GOLD, options.title))}${border(" ")}`;
  const sub = options.subtitle
    ? `${c.dim(options.subtitle)}${border(" ")}`
    : "";
  const filler = Math.max(0, w - width(title) - width(sub) - 1);
  const top = `${title}${border("─".repeat(filler))}${sub}${border("╮")}`;
  const rows =
    options.height === undefined ? lines : lines.slice(0, options.height);
  while (options.height !== undefined && rows.length < options.height) {
    rows.push("");
  }
  const body = rows.map(
    (line) =>
      `${border("│")} ${padRight(fit(line, inner), inner)} ${border("│")}`
  );
  const bottom = border(`╰${"─".repeat(w - 2)}╯`);
  return [top, ...body, bottom];
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

/** What this screen is and how to use it. Always visible; shorter when rows are scarce. */
function explainerBox(
  state: WatchState,
  w: number,
  intervalMs: number,
  compact: boolean
): string[] {
  const inner = w - 4;
  const every = Math.round(intervalMs / 1000);
  const team = state.team ? `${state.team.name}'s` : "your team's";
  const paragraphs = compact
    ? [
        `Leave this open while you build: every ${every}s it reports ${team} AI usage (request counts and token totals, never prompts or code) to the live board. Organiser announcements appear below. ${c.bold("q")} quits · ${c.bold("p")} pauses.`,
      ]
    : [
        `Keep this open while you build. Every ${every}s it reads the local logs of your AI coding tools (Claude Code, Codex, OpenCode, Cline) and reports ${team} usage to the live board: request counts and token totals only. Never prompts, code, or file paths.`,
        "Organiser announcements show up on the right as soon as they are sent, with a ping and a desktop notification.",
        `${c.bold("q")} quits and prints a summary  ·  ${c.bold("p")} pauses scanning  ·  ${c.bold("hackspain --help")} for everything else`,
      ];
  const lines = paragraphs.flatMap((p) => wrap(p, inner));
  return box({ title: "How this works" }, lines, w);
}

function youBox(state: WatchState, w: number): string[] {
  const team = state.team
    ? `${c.bold(state.team.name)} ${c.dim(`· ${state.team.members} member${state.team.members === 1 ? "" : "s"}${state.team.isOwner ? " · you own it" : ""}`)}`
    : c.dim("no team yet · hackspain team create <name>");
  const project = state.project
    ? `${state.project.name || c.dim("(untitled draft)")} ${c.dim(`· ${state.project.status}${state.project.tracks.length ? ` · ${state.project.tracks.join(", ")}` : " · no track yet"}`)}`
    : c.dim("no project yet · hackspain submit --draft");
  return box(
    { title: state.me.name, height: 3 },
    [
      `${c.dim("team   ")} ${team}`,
      `${c.dim("project")} ${project}`,
      `${c.dim("repo   ")} ${state.team?.repoUrl?.replace("https://github.com/", "") ?? c.dim("not set · hackspain team repo <url>")}`,
    ],
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

function harnessesBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): string[] {
  const rows: string[][] = state.harnesses.map((harness) => {
    const name = HARNESS_NAMES[harness.id] ?? harness.id;
    if (!harness.found) {
      return [
        c.dim(name),
        c.dim("○ not on this machine"),
        c.dim("–"),
        c.dim("–"),
        c.dim("–"),
      ];
    }
    return [
      name,
      harnessStatus(harness.lastEventAt, now),
      compactNumber(harness.requests),
      compactNumber(harness.tokens),
      harness.lastEventAt
        ? c.dim(formatAgo(harness.lastEventAt, now))
        : c.dim("–"),
    ];
  });
  const t = state.totals;
  rows.push([
    c.bold("Total"),
    c.dim(`${t.sessions.size} session${t.sessions.size === 1 ? "" : "s"}`),
    c.bold(compactNumber(t.requests)),
    c.bold(compactNumber(t.input + t.output + t.cached)),
    "",
  ]);
  const table = renderTable(rows, [
    "Harness",
    "Status",
    "Requests",
    "Tokens",
    "Last",
  ]).split("\n");
  const breakdown = `${c.dim("tokens:")} ${compactNumber(t.input)} ${c.dim("in")} · ${compactNumber(t.output)} ${c.dim("out")} · ${compactNumber(t.cached)} ${c.dim("cached")}`;
  return box(
    { title: "Harnesses", subtitle: "what is being reported", height: h },
    [...table, "", breakdown],
    w
  );
}

function recentBox(state: WatchState, w: number, h: number): string[] {
  const rows = state.recent
    .slice(0, Math.max(0, h - 2))
    .map((r) => [
      c.dim(clockSeconds(r.at)),
      HARNESS_NAMES[r.harness] ?? r.harness,
      r.model,
      compactNumber(r.input),
      compactNumber(r.output),
      compactNumber(r.cached),
      c.dim(r.sessionId.slice(0, 8)),
    ]);
  const lines =
    rows.length === 0
      ? [
          c.dim(
            "Nothing reported yet. Use your AI tool and the next scan will list the requests here."
          ),
        ]
      : renderTable(rows, [
          "Time",
          "Harness",
          "Model",
          "In",
          "Out",
          "Cached",
          "Session",
        ]).split("\n");
  return box(
    { title: "Recent requests", subtitle: "newest first", height: h },
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
      title: "📣 Organisers",
      subtitle: `${state.notifications.length} message${state.notifications.length === 1 ? "" : "s"}`,
      accent: fresh ? GOLD : TEAL,
      height: h,
    },
    lines,
    w
  );
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
  const right = `${rgb(GOLD, "q")} quit ${c.dim("·")} ${rgb(GOLD, "p")} ${state.paused ? "resume" : "pause"}`;
  const left = fit(
    parts.join(c.dim("  ·  ")),
    Math.max(0, w - width(right) - 1)
  );
  return `${left}${" ".repeat(Math.max(1, w - width(left) - width(right)))}${right}`;
}

function header(
  state: WatchState,
  now: number,
  w: number,
  tall: boolean
): string[] {
  const right = c.dim(`${clock(now)} · up ${elapsed(state.startedAt, now)}`);
  if (tall) {
    const rows = wordmarkRows().map((row, i) =>
      rgb(mix(GOLD, ORANGE, i / 5), row)
    );
    const tag = c.dim("live usage board · HackSpain 2026 · Madrid");
    rows.push(
      `${tag}${" ".repeat(Math.max(1, w - width(tag) - width(right)))}${right}`
    );
    return rows;
  }
  const left = `${rgb(GOLD, "⚡")} ${c.bold("HACKSPAIN")} ${c.dim("· live usage board")}`;
  return [
    `${left}${" ".repeat(Math.max(1, w - width(left) - width(right)))}${right}`,
  ];
}

/** Place two column blocks side by side; the shorter one is padded. */
function columns(left: string[], leftWidth: number, right: string[]): string[] {
  const rows = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    out.push(`${padRight(left[i] ?? "", leftWidth)}${right[i] ?? ""}`);
  }
  return out;
}

export type FrameOptions = { now?: number; tick?: number; intervalMs?: number };

export function frame(
  state: WatchState,
  size: { columns: number; rows: number },
  options: FrameOptions = {}
): string[] {
  const now = options.now ?? Date.now();
  const tick = options.tick ?? 0;
  const intervalMs = options.intervalMs ?? 30_000;
  const w = Math.max(MIN_WIDTH, size.columns);
  const h = size.rows;

  const tall = h >= 44 && w >= WORDMARK_WIDTH + 2;
  const head = header(state, now, w, tall);
  const status = statusLine(state, now, tick, w, intervalMs);
  const lines: string[] = [...head];
  const available = h - head.length - 1;

  const harnessRows = state.harnesses.length + 5; // header, rule, per harness, total, blank, breakdown
  if (available < 14) {
    // Tiny terminal: the two things that matter.
    const feedH = Math.max(1, available - harnessRows - 4);
    lines.push(...harnessesBox(state, now, w, harnessRows));
    lines.push(...organisersBox(state, now, w, feedH));
  } else if (w < 96) {
    // Narrow: one column. The explainer shrinks and the profile box goes
    // before the organiser feed ever loses its rows.
    const explainer = explainerBox(state, w, intervalMs, available < 34);
    const harnesses = harnessesBox(state, now, w, harnessRows);
    let you = youBox(state, w);
    let rest = available - explainer.length - harnesses.length - you.length;
    if (rest < 5) {
      you = [];
      rest = available - explainer.length - harnesses.length;
    }
    const feedH = Math.max(1, Math.min(8, rest - 2));
    const recentH = rest - feedH - 2 - 2;
    lines.push(...explainer, ...you, ...harnesses);
    lines.push(...organisersBox(state, now, w, feedH));
    if (recentH >= 4) {
      lines.push(...recentBox(state, w, recentH));
    }
  } else {
    // Wide: explainer across the top, then you + harnesses beside the feed,
    // then recent requests across the bottom when there is room.
    const explainer = explainerBox(state, w, intervalMs, available < 30);
    const leftW = Math.max(48, Math.floor(w * 0.55));
    const rightW = w - leftW;
    const lower = available - explainer.length;
    const you = youBox(state, leftW);
    const columnsH = Math.max(
      you.length + harnessRows + 2,
      lower >= 26 ? Math.floor(lower * 0.55) : lower
    );
    const harnessH = Math.max(harnessRows, columnsH - you.length - 2);
    const left = [...you, ...harnessesBox(state, now, leftW, harnessH)];
    const right = organisersBox(
      state,
      now,
      rightW,
      Math.max(1, left.length - 2)
    );
    lines.push(...explainer, ...columns(left, leftW, right));
    const recentH = lower - left.length - 2;
    if (recentH >= 4) {
      lines.push(...recentBox(state, w, recentH));
    }
  }

  const body = lines.slice(0, Math.max(0, h - 1));
  while (body.length < h - 1) {
    body.push("");
  }
  return [...body, status].map((l) => fit(l, w));
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
  next.forEach((line, row) => {
    if (line !== previous[row]) {
      changes.push({ row, line });
    }
  });
  return changes;
}

export function startScreen(
  state: WatchState,
  handlers: {
    onQuit: () => void;
    onTogglePause: () => void;
    intervalMs: number;
  }
): ScreenHandle {
  const out = process.stdout;
  const size = () => ({ columns: out.columns ?? 80, rows: out.rows ?? 24 });
  let ticks = 0;
  let previous: string[] | undefined;
  // Once a second, and only the rows that changed: an idle board costs the
  // terminal a couple of short lines per second instead of a full repaint.
  const draw = (force = false) => {
    ticks++;
    const lines = frame(state, size(), {
      tick: ticks,
      intervalMs: handlers.intervalMs,
    });
    const changes = force ? undefined : diffFrame(previous, lines);
    if (changes === undefined) {
      out.write(`\x1b[H${lines.map((l) => `${l}\x1b[K`).join("\n")}\x1b[J`);
    } else if (changes.length > 0) {
      out.write(
        changes
          .map(({ row, line }) => `\x1b[${row + 1};1H${line}\x1b[K`)
          .join("")
      );
    }
    previous = lines;
  };

  out.write("\x1b[?1049h\x1b[?25l\x1b[2J");
  const timer = setInterval(() => draw(), 1000);
  const onResize = () => draw(true);
  out.on("resize", onResize);

  const stdin = process.stdin;
  const rawSupported = Boolean(stdin.isTTY);
  const onKey = (data: Buffer) => {
    const key = data.toString();
    if (key === "q" || key === "\x03" || key === "\x04") {
      handlers.onQuit();
    } else if (key === "p") {
      handlers.onTogglePause();
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
      out.write("\x1b[?25h\x1b[?1049l");
    },
  };
}

export function summaryLines(state: WatchState, now = Date.now()): string[] {
  const t = state.totals;
  return [
    `Watched for ${elapsed(state.startedAt, now)} · ${compactNumber(t.requests)} request${t.requests === 1 ? "" : "s"} from ${t.sessions.size} session${t.sessions.size === 1 ? "" : "s"} reported${state.upload.enabled ? "" : " (local only)"} · ${state.notifications.length} organiser message${state.notifications.length === 1 ? "" : "s"}.`,
  ];
}
