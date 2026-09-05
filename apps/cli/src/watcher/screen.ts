import { banner, WORDMARK_WIDTH } from "../lib/banner";
import { compactNumber, formatAgo } from "../lib/output";
import {
  BRAND,
  c,
  colorEnabled,
  highlight,
  stripAnsi,
  width,
} from "../lib/style";
import type { WatchState } from "./state";

/**
 * Full-terminal live view for `hackspain watch`. Pure `frame()` builds the
 * text for a given size; `startScreen()` owns the alternate screen buffer,
 * redraws twice a second, and turns key presses into state changes.
 */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MAX_WIDTH = 100;
const MIN_WIDTH = 40;

const HARNESS_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  cline: "Cline",
  cursor: "Cursor",
  copilot: "Copilot",
};

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

export function box(title: string, lines: string[], w: number): string[] {
  const inner = w - 4;
  const head = `┌─ ${title} `;
  const top = `${head}${"─".repeat(Math.max(0, w - width(head) - 1))}┐`;
  const body = lines.map((line) => `│ ${padRight(fit(line, inner), inner)} │`);
  const bottom = `└${"─".repeat(w - 2)}┘`;
  return [c.dim(top), ...body, c.dim(bottom)].map((l, i) =>
    i === 0 ? l.replace(title, c.bold(title)) : l
  );
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

function youPanel(state: WatchState, w: number): string[] {
  const team = state.team
    ? `${highlight(state.team.name)} ${c.dim(`· ${state.team.members} member${state.team.members === 1 ? "" : "s"}${state.team.isOwner ? " · you own it" : ""}`)}`
    : c.dim("no team yet · hackspain team create <name>");
  const project = state.project
    ? `${state.project.name || c.dim("(untitled draft)")} ${c.dim(`· ${state.project.status}${state.project.tracks.length ? ` · ${state.project.tracks.join(", ")}` : " · no track yet"}`)}`
    : c.dim("no project yet · hackspain submit --draft");
  return box(
    `${state.me.name}`,
    [
      `${c.dim("Team    ")} ${team}`,
      `${c.dim("Project ")} ${project}`,
      `${c.dim("Repo    ")} ${state.team?.repoUrl?.replace("https://github.com/", "") ?? c.dim("not set · hackspain team repo <url>")}`,
    ],
    w
  );
}

function boardPanel(state: WatchState, now: number, w: number): string[] {
  const t = state.totals;
  const lines = [
    `${highlight(compactNumber(t.requests))} ${c.dim(t.requests === 1 ? "request" : "requests")}  ${highlight(String(t.sessions.size))} ${c.dim(t.sessions.size === 1 ? "session" : "sessions")}  ${highlight(compactNumber(t.input))} ${c.dim("in")}  ${highlight(compactNumber(t.output))} ${c.dim("out")}  ${highlight(compactNumber(t.cached))} ${c.dim("cached")}`,
    "",
  ];
  for (const h of state.harnesses) {
    const name = padRight(HARNESS_NAMES[h.id] ?? h.id, 12);
    if (!h.found) {
      lines.push(
        `${c.dim("○")} ${c.dim(name)} ${c.dim("not on this machine")}`
      );
      continue;
    }
    const activity = h.lastEventAt
      ? `${compactNumber(h.requests)} request${h.requests === 1 ? "" : "s"} · last ${formatAgo(h.lastEventAt, now)}`
      : "found · waiting for the first request";
    const live = h.lastEventAt && now - h.lastEventAt < 5 * 60 * 1000;
    lines.push(
      `${live ? c.gold("●") : c.teal("●")} ${name} ${c.dim(activity)}`
    );
  }
  if (state.harnesses.every((h) => !h.found)) {
    lines.push(
      c.dim(
        "No supported AI harness found. Claude Code, Codex, OpenCode and Cline are supported."
      )
    );
  }
  return box("Live usage board", lines, w);
}

function organisersPanel(state: WatchState, w: number, rows: number): string[] {
  const inner = w - 4;
  const lines: string[] = [];
  if (state.notifications.length === 0) {
    lines.push(
      c.dim(
        "Nothing yet. Announcements from the organisers land here, with a ping."
      )
    );
  }
  for (const n of state.notifications) {
    const first = `${c.gold(clock(n.at))}  ${c.bold(n.subject)}`;
    lines.push(first);
    for (const bodyLine of n.body.split("\n")) {
      lines.push(`       ${bodyLine}`);
    }
    lines.push("");
    if (lines.length >= rows) {
      break;
    }
  }
  while (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  return box(
    "📣 Organisers",
    lines.slice(0, Math.max(1, rows)).map((l) => fit(l, inner)),
    w
  );
}

function statusLine(
  state: WatchState,
  now: number,
  tickCount: number,
  w: number
): string {
  const parts: string[] = [];
  if (state.paused) {
    parts.push(c.orange("paused"));
  } else if (state.scanning) {
    parts.push(
      `${c.gold(SPINNER[tickCount % SPINNER.length] ?? "⠋")} scanning`
    );
  } else if (state.nextScanAt) {
    parts.push(
      c.dim(
        `next scan in ${Math.max(0, Math.ceil((state.nextScanAt - now) / 1000))}s`
      )
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
    parts.push(c.dim("upload off · local spool only"));
  }
  const right = `${c.dim("q")} quit ${c.dim("·")} ${c.dim("p")} ${state.paused ? "resume" : "pause"}`;
  // The key hints always survive; the status text gives way on narrow screens.
  const left = fit(
    parts.join(c.dim("  ·  ")),
    Math.max(0, w - width(right) - 1)
  );
  const gap = Math.max(1, w - width(left) - width(right));
  return `${left}${" ".repeat(gap)}${right}`;
}

export function frame(
  state: WatchState,
  size: { columns: number; rows: number },
  now = Date.now(),
  tickCount = 0
): string[] {
  const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, size.columns));
  const lines: string[] = [];
  const bigBanner = w >= WORDMARK_WIDTH + 2 && size.rows >= 30;
  if (bigBanner) {
    lines.push(...banner("").split("\n").slice(0, 6));
  }
  const tagLeft = bigBanner
    ? c.dim("HackSpain 2026 · Madrid · live")
    : `${BRAND} ${c.dim("· watch")}`;
  const tagRight = c.dim(
    `since ${clock(state.startedAt)} · up ${elapsed(state.startedAt, now)}`
  );
  lines.push(
    `${tagLeft}${" ".repeat(Math.max(1, w - width(tagLeft) - width(tagRight)))}${tagRight}`
  );
  lines.push("");

  const status = statusLine(state, now, tickCount, w);
  const board = boardPanel(state, now, w);
  // Short terminals: drop the profile panel and the log so the board, the
  // organiser feed and the status bar always fit.
  const compact = size.rows < 18;
  const you = compact ? [] : youPanel(state, w);
  const log =
    compact || state.log.length === 0
      ? []
      : [...state.log.map((l) => c.dim(fit(`  ${l}`, w))), ""];
  // Rows left for the organiser panel body: everything minus header, panels,
  // the panel's own borders, the blank line and the status bar.
  const forOrganisers = Math.max(
    1,
    size.rows - lines.length - you.length - board.length - log.length - 2 - 2
  );
  const organisers = organisersPanel(state, w, forOrganisers);

  lines.push(...you, ...board, ...organisers, ...log, "");
  const body = lines.slice(0, Math.max(0, size.rows - 1));
  return [...body, status].map((l) => fit(l, w));
}

export type ScreenHandle = { stop: () => void; redraw: () => void };

export function startScreen(
  state: WatchState,
  handlers: { onQuit: () => void; onTogglePause: () => void }
): ScreenHandle {
  const out = process.stdout;
  const size = () => ({ columns: out.columns ?? 80, rows: out.rows ?? 24 });
  let ticks = 0;
  const draw = () => {
    ticks++;
    const lines = frame(state, size(), Date.now(), ticks);
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
    `Watched for ${elapsed(state.startedAt, now)} · ${compactNumber(t.requests)} requests from ${t.sessions.size} session${t.sessions.size === 1 ? "" : "s"} reported${state.upload.enabled ? "" : " (local only)"} · ${state.notifications.length} organiser message${state.notifications.length === 1 ? "" : "s"}.`,
    colorEnabled ? "" : "",
  ].filter(Boolean);
}
