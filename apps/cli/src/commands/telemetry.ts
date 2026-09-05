import type { Command } from "commander";
import { contextFor } from "../lib/context";
import { compactNumber, uiFor } from "../lib/output";
import type { TelemetryEvent } from "../watcher/schema";
import { readSpool, spoolDir } from "../watcher/sinks/spool";

type Totals = {
  events: number;
  sessions: Set<string>;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
};

function empty(): Totals {
  return {
    events: 0,
    sessions: new Set(),
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    costUsd: 0,
  };
}

function add(totals: Totals, event: TelemetryEvent): void {
  totals.sessions.add(event.sessionId);
  if (event.type !== "usage" || !event.tokens) {
    return;
  }
  totals.events++;
  totals.input += event.tokens.input;
  totals.output += event.tokens.output;
  totals.cacheRead += event.tokens.cacheRead;
  totals.cacheWrite += event.tokens.cacheWrite;
  totals.costUsd += event.costUsd ?? 0;
}

export function summarize(events: Iterable<TelemetryEvent>): {
  all: Totals;
  byHarness: Map<string, Totals>;
  byFamily: Map<string, Totals>;
  first?: string;
  last?: string;
} {
  const all = empty();
  const byHarness = new Map<string, Totals>();
  const byFamily = new Map<string, Totals>();
  let first: string | undefined;
  let last: string | undefined;
  for (const event of events) {
    add(all, event);
    const h = byHarness.get(event.harness) ?? empty();
    add(h, event);
    byHarness.set(event.harness, h);
    if (event.type === "usage") {
      const family = event.model?.family ?? "other";
      const f = byFamily.get(family) ?? empty();
      add(f, event);
      byFamily.set(family, f);
    }
    if (!first || event.occurredAt < first) {
      first = event.occurredAt;
    }
    if (!last || event.occurredAt > last) {
      last = event.occurredAt;
    }
  }
  return { all, byHarness, byFamily, first, last };
}

function row(name: string, t: Totals): string[] {
  return [
    name,
    String(t.events),
    String(t.sessions.size),
    compactNumber(t.input),
    compactNumber(t.output),
    compactNumber(t.cacheRead + t.cacheWrite),
    t.costUsd ? `$${t.costUsd.toFixed(2)}` : "-",
  ];
}

export function registerTelemetry(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("What the watcher has recorded on this machine");

  telemetry
    .command("stats")
    .description("Totals from the local spool, by harness and model family")
    .action((_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const summary = summarize(readSpool());
      const serial = (t: Totals) => ({ ...t, sessions: t.sessions.size });
      ui.result({
        spool: spoolDir(),
        first: summary.first ?? null,
        last: summary.last ?? null,
        all: serial(summary.all),
        byHarness: Object.fromEntries(
          [...summary.byHarness].map(([k, v]) => [k, serial(v)])
        ),
        byFamily: Object.fromEntries(
          [...summary.byFamily].map(([k, v]) => [k, serial(v)])
        ),
      });
      if (summary.all.events === 0 && summary.all.sessions.size === 0) {
        ui.info(
          `Nothing recorded yet in ${spoolDir()}. Run \`hackspain watch\`.`
        );
        return;
      }
      const header = [
        "",
        "Requests",
        "Sessions",
        "Input",
        "Output",
        "Cached",
        "Cost",
      ];
      ui.table(
        [
          ...[...summary.byHarness].map(([k, v]) => row(k, v)),
          row("total", summary.all),
        ],
        header
      );
      ui.line("");
      ui.table(
        [...summary.byFamily].map(([k, v]) => row(k, v)),
        ["Model", "Requests", "Sessions", "Input", "Output", "Cached", "Cost"]
      );
      ui.line("");
      ui.info(`${summary.first} → ${summary.last}\n${spoolDir()}`);
    });
}
