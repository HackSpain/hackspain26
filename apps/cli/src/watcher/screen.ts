import { WORDMARK_WIDTH, wordmarkRows } from "../lib/banner";
import { compactNumber, formatAgo } from "../lib/output";
import { c, colorEnabled, stripAnsi, width } from "../lib/style";
import { seriesWindow, type WatchState } from "./state";

/**
 * Full-terminal live view for `hackspain watch`, in the spirit of btop: the
 * whole screen is a grid of rounded boxes with a graph, gauges and a feed,
 * redrawn twice a second. `frame()` is pure (state + size → lines) so it is
 * testable; `startScreen()` owns the alternate screen buffer and the keys.
 */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MIN_WIDTH = 40;
const BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

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

function padLeft(text: string, size: number): string {
  return " ".repeat(Math.max(0, size - width(text))) + text;
}

export type BoxOptions = {
  title: string;
  subtitle?: string;
  accent?: Rgb;
  /** Exact number of body rows; content is cut or padded to it. */
  height?: number;
};

/** Rounded box, btop-style: title inset on the top border, optional subtitle on the right. */
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

function elapsed(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/**
 * Column chart: one column per point, `height` rows, partial blocks for the
 * top cell, warm gradient from the baseline (teal) to the peaks (gold).
 */
export function chart(values: number[], height: number): string[] {
  const max = Math.max(1, ...values);
  const rows: string[] = [];
  for (let r = height - 1; r >= 0; r--) {
    let line = "";
    for (const value of values) {
      const level = (value / max) * height;
      let cell = " ";
      if (level >= r + 1) {
        cell = "█";
      } else if (level > r) {
        cell = BLOCKS[Math.max(1, Math.round((level - r) * 8))] ?? "▁";
      }
      line +=
        cell === " "
          ? " "
          : rgb(mix(TEAL, GOLD, r / Math.max(1, height - 1)), cell);
    }
    rows.push(line);
  }
  return rows;
}

/** Horizontal gauge: filled share in colour, the rest dim. */
export function gauge(
  fraction: number,
  size: number,
  color: Rgb = GOLD
): string {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * size);
  return `${rgb(color, "█".repeat(filled))}${c.dim("░".repeat(size - filled))}`;
}

/** Eight-cell sparkline for a harness, from the per-minute series. */
function sparkline(values: number[]): string {
  const max = Math.max(1, ...values);
  return values
    .map((v) => BLOCKS[Math.min(8, Math.round((v / max) * 8))] ?? " ")
    .join("");
}

function activityBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): string[] {
  const inner = w - 4;
  const graphRows = Math.max(3, h - 1);
  const points = seriesWindow(state, inner, now);
  const requests = points.map((p) => p.requests);
  const peak = Math.max(...requests, 0);
  const current = requests.at(-1) ?? 0;
  const lines = chart(requests, graphRows);
  // Peak label on the top row, right-aligned, only when there is something to show.
  if (peak > 0 && lines[0] !== undefined) {
    const label = c.dim(`${peak} req/min`);
    const keep = Math.max(0, inner - width(label) - 1);
    lines[0] = `${fitCells(lines[0], keep)}${" ".repeat(Math.max(0, inner - keep - width(label)))}${label}`;
  }
  const left = c.dim(`${inner} min ago`);
  const right = c.dim("now");
  lines.push(
    `${left}${" ".repeat(Math.max(1, inner - width(left) - width(right)))}${right}`
  );
  return box(
    {
      title: "Activity",
      subtitle: `requests per minute · now ${current} · peak ${peak}`,
      height: h,
    },
    lines,
    w
  );
}

/** Keep the first `cells` visible cells of an ANSI-coloured line without breaking escapes. */
function fitCells(line: string, cells: number): string {
  let out = "";
  let count = 0;
  let i = 0;
  while (i < line.length && count < cells) {
    if (line[i] === "\x1b") {
      const end = line.indexOf("m", i);
      out += line.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    out += line[i];
    count++;
    i++;
  }
  return `${out}${colorEnabled ? "\x1b[39m" : ""}`;
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

function harnessesBox(
  state: WatchState,
  now: number,
  w: number,
  h: number
): string[] {
  const inner = w - 4;
  const points = seriesWindow(state, 8, now);
  const lines: string[] = [];
  for (const harness of state.harnesses) {
    const name = padRight(HARNESS_NAMES[harness.id] ?? harness.id, 11);
    if (!harness.found) {
      lines.push(
        `${c.dim("○")} ${c.dim(name)} ${" ".repeat(8)} ${c.dim("not on this machine")}`
      );
      continue;
    }
    const live =
      harness.lastEventAt !== undefined &&
      now - harness.lastEventAt < 5 * 60 * 1000;
    const spark = rgb(
      live ? GOLD : TEAL,
      sparkline(points.map((p) => p.byHarness[harness.id] ?? 0))
    );
    const detail = harness.lastEventAt
      ? `${compactNumber(harness.requests)} req · ${formatAgo(harness.lastEventAt, now)}`
      : "waiting for requests";
    lines.push(
      `${rgb(live ? GOLD : TEAL, "●")} ${name} ${spark} ${c.dim(fit(detail, Math.max(8, inner - 24)))}`
    );
  }
  if (state.harnesses.every((x) => !x.found)) {
    lines.push(c.dim("No supported AI harness found."));
    lines.push(c.dim("Claude Code, Codex, OpenCode and Cline are supported."));
  }
  const t = state.totals;
  const total = Math.max(1, t.input + t.output + t.cached);
  const gaugeWidth = Math.max(6, Math.min(24, inner - 26));
  const row = (label: string, value: number, color: Rgb) =>
    `${c.dim(padRight(label, 7))} ${gauge(value / total, gaugeWidth, color)} ${padLeft(compactNumber(value), 7)} ${c.dim(`${Math.round((value / total) * 100)}%`)}`;
  const gauges = [
    "",
    `${c.bold(compactNumber(t.requests))} ${c.dim(t.requests === 1 ? "request" : "requests")}  ${c.bold(String(t.sessions.size))} ${c.dim(t.sessions.size === 1 ? "session" : "sessions")}  ${c.bold(compactNumber(t.input + t.output + t.cached))} ${c.dim("tokens")}`,
    row("input", t.input, ORANGE),
    row("output", t.output, GOLD),
    row("cached", t.cached, TEAL),
  ];
  // Spare rows become a tokens-per-minute chart rather than empty space.
  const used = lines.length + gauges.length;
  const spare = h - used;
  if (spare >= 5) {
    const window = seriesWindow(state, inner, now);
    const label = c.dim(`tokens per minute · last ${inner} min`);
    gauges.push(
      "",
      label,
      ...chart(
        window.map((p) => p.tokens),
        spare - 2
      )
    );
  }
  return box(
    { title: "Harnesses", subtitle: "last 8 min", height: h },
    [...lines, ...gauges],
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
    lines.push(c.dim("Announcements from the organisers land"));
    lines.push(c.dim("here, with a ping and a desktop toast."));
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

function wrap(text: string, w: number): string[] {
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

  const tall = h >= 42 && w >= WORDMARK_WIDTH + 2;
  const head = header(state, now, w, tall);
  const status = statusLine(state, now, tick, w, intervalMs);
  const available = h - head.length - 1;

  const lines: string[] = [...head];
  if (available < 12) {
    // Tiny terminal: just the graph and the feed.
    const graphH = Math.max(3, Math.floor(available / 2) - 2);
    lines.push(...activityBox(state, now, w, graphH));
    lines.push(
      ...organisersBox(state, now, w, Math.max(1, available - graphH - 4))
    );
  } else if (w < 84) {
    // Narrow: single column, stacked.
    const graphH = Math.max(5, Math.floor(available * 0.3) - 2);
    const harnessH = state.harnesses.length + 5;
    const feedH = Math.max(2, available - graphH - harnessH - 6);
    lines.push(...activityBox(state, now, w, graphH));
    lines.push(...harnessesBox(state, now, w, harnessH));
    lines.push(...organisersBox(state, now, w, feedH));
  } else {
    // Wide: graph on top, then two columns.
    const graphH = Math.max(6, Math.min(14, Math.floor(available * 0.36) - 2));
    const lowerRows = available - (graphH + 2);
    const leftW = Math.max(40, Math.floor(w * 0.5));
    const rightW = w - leftW;
    lines.push(...activityBox(state, now, w, graphH));
    const you = youBox(state, leftW);
    const harnessH = Math.max(
      state.harnesses.length + 5,
      lowerRows - you.length - 2
    );
    const left = [...you, ...harnessesBox(state, now, leftW, harnessH)];
    const right = organisersBox(state, now, rightW, Math.max(1, lowerRows - 2));
    lines.push(...columns(left, leftW, right));
  }

  const body = lines.slice(0, Math.max(0, h - 1));
  while (body.length < h - 1) {
    body.push("");
  }
  return [...body, status].map((l) => fit(l, w));
}

export type ScreenHandle = { stop: () => void; redraw: () => void };

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
  const draw = () => {
    ticks++;
    const lines = frame(state, size(), {
      tick: ticks,
      intervalMs: handlers.intervalMs,
    });
    out.write(`\x1b[H${lines.map((l) => `${l}\x1b[K`).join("\n")}\x1b[J`);
  };

  out.write("\x1b[?1049h\x1b[?25l\x1b[2J");
  const timer = setInterval(draw, 500);
  const onResize = () => draw();
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
