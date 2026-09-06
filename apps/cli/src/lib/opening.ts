import { firstName } from "./output";
import { BRAND, c, highlight, stripAnsi, width } from "./style";

/**
 * Designed post-banner opening: a short boot (check-in / loaded) and a
 * compact status board. Kept off clack's intro/spinner timeline so those
 * lines read as UI, not leftover logs.
 */

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INDENT = "  ";

function pad(text: string, size: number): string {
  return text + " ".repeat(Math.max(0, size - width(text)));
}

function fit(text: string, max: number): string {
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

export function formatVersionLine(version: string): string {
  return `${BRAND} ${c.dim("·")} ${c.dim(`v${version}`)}`;
}

export function formatGreeting(name: string): string {
  return `Hey ${highlight(name)} 👋`;
}

export function formatBootStep(options: {
  ok?: boolean;
  label: string;
  detail?: string;
}): string {
  const mark = options.ok === false ? c.red("✗") : c.teal("✓");
  const detail = options.detail ? `${c.dim("  ·  ")}${options.detail}` : "";
  return `${INDENT}${mark}  ${options.label}${detail}`;
}

export type OpeningBoardInput = {
  email?: string;
  team?: {
    name: string;
    isOwner: boolean;
    members: number;
    repoUrl?: string | null;
  } | null;
  project?: {
    name: string | null;
    submitted: boolean;
    tracks: number;
    trackLabels?: string[];
  } | null;
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function teamValue(team: NonNullable<OpeningBoardInput["team"]>): string {
  return `${team.name} ${c.dim(`· ${plural(team.members, "member")}${team.isOwner ? " · you own it" : ""}`)}`;
}

function projectValue(
  project: NonNullable<OpeningBoardInput["project"]>
): string {
  const name = project.name || c.dim("(untitled draft)");
  const state = project.submitted ? "submitted" : "draft";
  let tracks: string;
  if (project.trackLabels?.length) {
    tracks = project.trackLabels.join(", ");
  } else if (project.tracks === 0) {
    tracks = "no track yet";
  } else {
    tracks = plural(project.tracks, "track");
  }
  return `${name} ${c.dim(`· ${state} · ${tracks}`)}`;
}

/** Four-row status board: Team / Project / Repo / Signed in. */
export function openingBoardRows(input: OpeningBoardInput): [string, string][] {
  return [
    ["Team", input.team ? teamValue(input.team) : c.dim("none yet")],
    [
      "Project",
      input.project ? projectValue(input.project) : c.dim("none yet"),
    ],
    ["Repo", input.team?.repoUrl ?? c.dim("not set")],
    ["Signed in", c.dim(input.email ?? "?")],
  ];
}

/** Rounded teal card, same language as `hackspain watch`. */
export function formatStatusBoard(
  rows: [string, string][],
  columns = process.stdout.columns ?? 80
): string {
  if (rows.length === 0) {
    return "";
  }
  const title = "status";
  const maxInner = Math.max(24, columns - 8);
  const keyW = Math.max(...rows.map(([key]) => width(key)));
  const cells = rows.map(([key, value]) => {
    const keyPad = `${c.dim(pad(key, keyW))}  `;
    return `${keyPad}${fit(value, Math.max(8, maxInner - width(keyPad)))}`;
  });
  const innerW = Math.min(
    maxInner,
    Math.max(width(title) + 4, ...cells.map((cell) => width(cell)))
  );
  const boxW = innerW + 4;
  const prefixCells = 3 + width(title) + 1;
  const dashes = Math.max(1, boxW - prefixCells - 1);
  const top = `${c.teal("╭─ ")}${c.bold(c.gold(title))}${c.teal(` ${"─".repeat(dashes)}╮`)}`;
  const body = cells.map(
    (cell) => `${c.teal("│")} ${pad(cell, innerW)} ${c.teal("│")}`
  );
  const bottom = c.teal(`╰${"─".repeat(boxW - 2)}╯`);
  return [top, ...body, bottom].map((line) => `${INDENT}${line}`).join("\n");
}

export type OpeningView = {
  version: string;
  greeting?: string;
  steps?: { ok?: boolean; label: string; detail?: string }[];
  board?: [string, string][];
  message?: string;
  hint?: string;
};

/** Full post-banner block: version, optional boot, greeting, board or note. */
export function renderOpening(view: OpeningView): string {
  const lines: string[] = [formatVersionLine(view.version)];
  if (view.steps?.length) {
    lines.push("");
    for (const step of view.steps) {
      lines.push(formatBootStep(step));
    }
  }
  if (view.greeting && !view.steps?.some((step) => step.detail)) {
    lines.push("");
    lines.push(`${INDENT}${view.greeting}`);
  }
  if (view.message) {
    lines.push("");
    lines.push(`${INDENT}${view.message}`);
    if (view.hint) {
      lines.push(`${INDENT}${c.dim(view.hint)}`);
    }
  }
  if (view.board?.length) {
    lines.push("");
    lines.push(formatStatusBoard(view.board));
  }
  return lines.join("\n");
}

export function greetingFor(
  name?: string | null,
  email?: string | null
): string {
  return formatGreeting(firstName(name ?? undefined, email ?? undefined));
}

export type Boot = {
  step<T>(
    pending: string,
    done: string | ((value: T) => string),
    fn: () => Promise<T>,
    detail?: (value: T) => string | undefined
  ): Promise<T>;
};

function shouldAnimate(): boolean {
  return (
    Boolean(process.stdout.isTTY) &&
    process.env.TERM !== "dumb" &&
    !process.env.CI
  );
}

/** In-place boot spinner on TTY; a single designed done line otherwise. Silent in --json. */
export function bootFor(ctx: { json: boolean }): Boot {
  return {
    async step(pending, done, fn, detail) {
      if (ctx.json) {
        return await fn();
      }
      if (!shouldAnimate()) {
        const value = await fn();
        const label = typeof done === "function" ? done(value) : done;
        console.log(
          formatBootStep({ ok: true, label, detail: detail?.(value) })
        );
        return value;
      }
      let frame = 0;
      const tick = () => {
        const spin = c.teal(SPINNER[frame % SPINNER.length] ?? "·");
        frame += 1;
        process.stdout.write(`\r${INDENT}${spin}  ${c.dim(pending)}\x1b[K`);
      };
      tick();
      const timer = setInterval(tick, 80);
      try {
        const value = await fn();
        clearInterval(timer);
        const label = typeof done === "function" ? done(value) : done;
        process.stdout.write(
          `\r\x1b[K${formatBootStep({ ok: true, label, detail: detail?.(value) })}\n`
        );
        return value;
      } catch (error) {
        clearInterval(timer);
        process.stdout.write("\r\x1b[K");
        throw error;
      }
    },
  };
}
