import { intro, log, note, outro, spinner } from "@clack/prompts";
import type { CliContext } from "./context";
import { BRAND, c, cmd, width } from "./style";

/**
 * All user-facing output goes through here so `--json` can guarantee exactly
 * one JSON document on stdout and everything else on stderr.
 */
export type Ui = {
  json: boolean;
  /** Opens a section with the brand mark: `⚡ hackspain · login`. */
  intro(title: string): void;
  outro(message: string): void;
  info(message: string): void;
  success(message: string): void;
  /** Success with a party hat; for the moments worth celebrating. */
  celebrate(message: string): void;
  warn(message: string): void;
  step(message: string): void;
  line(message: string): void;
  /** Key/value block with dim keys. */
  kv(rows: [string, string][]): void;
  table(rows: string[][], header?: string[]): void;
  /** Boxed note, e.g. a join code to share. */
  note(body: string, title?: string): void;
  /** "What next" box listing commands with a short explanation each. */
  next(steps: [command: string, why: string][]): void;
  /** Runs `fn` behind a spinner (or silently in --json mode). */
  spin<T>(label: string, fn: () => Promise<T>, done?: string): Promise<T>;
  result(data: unknown): void;
};

function pad(text: string, size: number): string {
  return text + " ".repeat(Math.max(0, size - width(text)));
}

export function renderTable(rows: string[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows;
  if (all.length === 0) {
    return "";
  }
  const widths: number[] = [];
  for (const row of all) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, width(cell));
    });
  }
  const render = (row: string[]) =>
    row
      .map((cell, i) => pad(cell, widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  const lines = all.map(render);
  if (header) {
    lines[0] = c.bold(lines[0] ?? "");
    lines.splice(1, 0, c.dim(widths.map((w) => "─".repeat(w)).join("  ")));
  }
  return lines.join("\n");
}

export function renderKv(rows: [string, string][]): string {
  const keyWidth = Math.max(0, ...rows.map(([k]) => width(k)));
  return rows.map(([k, v]) => `${c.dim(pad(k, keyWidth))}  ${v}`).join("\n");
}

export function renderNext(steps: [string, string][]): string {
  const cmdWidth = Math.max(0, ...steps.map(([command]) => width(command)));
  return steps
    .map(([command, why]) => `${cmd(pad(command, cmdWidth))}  ${c.dim(why)}`)
    .join("\n");
}

export function uiFor(ctx: CliContext): Ui {
  const quiet = ctx.json;
  const err = (message: string) => {
    if (!quiet) {
      return;
    }
    process.stderr.write(`${message}\n`);
  };
  // Content goes through clack's gutter so tables and notes line up with
  // intro/outro instead of floating outside the frame.
  const out = (message: string) => {
    if (quiet) {
      err(message);
    } else {
      log.message(message);
    }
  };
  return {
    json: ctx.json,
    intro: (title) =>
      quiet ? err(title) : intro(`${BRAND} ${c.dim("·")} ${title}`),
    outro: (message) => (quiet ? err(message) : outro(message)),
    info: (message) => (quiet ? err(message) : log.info(message)),
    success: (message) => (quiet ? err(message) : log.success(message)),
    celebrate: (message) =>
      quiet ? err(message) : log.success(`${message} 🎉`),
    warn: (message) => (quiet ? err(message) : log.warn(message)),
    step: (message) => (quiet ? err(message) : log.step(message)),
    line: out,
    kv: (rows) => out(renderKv(rows)),
    table: (rows, header) => out(renderTable(rows, header)),
    note: (body, title) => (quiet ? err(body) : note(body, title)),
    next: (steps) =>
      quiet
        ? err(steps.map(([command]) => command).join("\n"))
        : note(renderNext(steps), "Next"),
    spin: async (label, fn, done) => {
      if (quiet || !process.stderr.isTTY) {
        return await fn();
      }
      const s = spinner();
      s.start(label);
      try {
        const value = await fn();
        s.stop(done ?? label);
        return value;
      } catch (error) {
        s.error(label);
        throw error;
      }
    },
    result: (data) => {
      if (!quiet) {
        return;
      }
      console.log(JSON.stringify({ ok: true, data }));
    },
  };
}

export function printJsonError(explained: {
  code: string;
  message: string;
  hint?: string;
}): void {
  console.log(JSON.stringify({ ok: false, ...explained }));
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatWhen(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** "just now", "4 min ago", "2 h ago", "in 12 min", else the date. */
export function formatAgo(epochMs: number, now = Date.now()): string {
  const delta = Math.round((epochMs - now) / 1000);
  const seconds = Math.abs(delta);
  if (seconds < 45) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  let span: string;
  if (minutes < 60) {
    span = `${minutes} min`;
  } else if (hours < 24) {
    span = `${hours} h`;
  } else {
    return formatWhen(epochMs);
  }
  return delta > 0 ? `in ${span}` : `${span} ago`;
}

const WHITESPACE = /\s+/;

/** First name for greetings; falls back to the email's local part. */
export function firstName(name?: string, email?: string): string {
  const fromName = name?.trim().split(WHITESPACE)[0];
  if (fromName) {
    return fromName;
  }
  return email?.split("@")[0] ?? "hacker";
}
