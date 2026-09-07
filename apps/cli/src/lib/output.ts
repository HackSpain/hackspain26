import { intro, log, outro } from "@clack/prompts";
import type { CliContext } from "./context";

/**
 * All user-facing output goes through here so `--json` can guarantee exactly
 * one JSON document on stdout and everything else on stderr.
 */
export type Ui = {
  json: boolean;
  intro(title: string): void;
  outro(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  step(message: string): void;
  line(message: string): void;
  table(rows: string[][], header?: string[]): void;
  result(data: unknown): void;
};

function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - text.length));
}

export function renderTable(rows: string[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows;
  if (all.length === 0) {
    return "";
  }
  const widths: number[] = [];
  for (const row of all) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  const render = (row: string[]) =>
    row
      .map((cell, i) => pad(cell, widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  const lines = all.map(render);
  if (header) {
    lines.splice(1, 0, widths.map((w) => "-".repeat(w)).join("  "));
  }
  return lines.join("\n");
}

export function uiFor(ctx: CliContext): Ui {
  const quiet = ctx.json;
  const err = (message: string) => {
    if (!quiet) {
      return;
    }
    process.stderr.write(`${message}\n`);
  };
  return {
    json: ctx.json,
    intro: (title) => (quiet ? err(title) : intro(title)),
    outro: (message) => (quiet ? err(message) : outro(message)),
    info: (message) => (quiet ? err(message) : log.info(message)),
    success: (message) => (quiet ? err(message) : log.success(message)),
    warn: (message) => (quiet ? err(message) : log.warn(message)),
    step: (message) => (quiet ? err(message) : log.step(message)),
    line: (message) => (quiet ? err(message) : console.log(message)),
    table: (rows, header) => {
      if (quiet) {
        return;
      }
      console.log(renderTable(rows, header));
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
