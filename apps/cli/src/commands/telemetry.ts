import type { Command } from "commander";
import { rememberTelemetry } from "../../../app/src/app/api/cli/telemetry/canonical";
import { openSession } from "../lib/api";
import { contextFor } from "../lib/context";
import { EXIT } from "../lib/errors";
import { requireOnboarded } from "../lib/me";
import { compactNumber, formatWhen, uiFor } from "../lib/output";
import { c, terminalText } from "../lib/style";
import type { TelemetryEvent } from "../watcher/schema";
import { readSpool, spoolDir } from "../watcher/sinks/spool";
import { syncTelemetry } from "../watcher/sync";

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
    cacheRead: 0,
    cacheWrite: 0,
    costUsd: 0,
    events: 0,
    input: 0,
    output: 0,
    sessions: new Set(),
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
  totals.costUsd += event.native?.costUsd ?? 0;
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
  const seen = new Set<string>();
  for (const event of events) {
    if (rememberTelemetry(seen, event)) {
      continue;
    }
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
  return { all, byFamily, byHarness, first, last };
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
    .command("sync")
    .description(
      "Upload all available AI usage since the event started, then exit"
    )
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const session = await openSession(ctx, { requireAuth: true });
      const me = await requireOnboarded(session, { allowClosed: true });
      const result = await syncTelemetry(session, me, (message) =>
        process.stderr.write(`${terminalText(message)}\n`)
      );
      ui.result(result);
      if (result.status === "synced") {
        ui.success("Available history uploaded.");
      } else if (result.status === "watcher-running") {
        ui.info(
          "The running watcher owns collection. Stop it before requesting a full replay."
        );
      } else if (result.status === "unscheduled") {
        ui.warn("No hackathon is scheduled; nothing was collected.");
      } else {
        ui.warn(
          "Some history is pending. Run hackspain telemetry sync again to retry."
        );
        process.exitCode = EXIT.NETWORK;
      }
    });

  telemetry
    .command("stats")
    .description("Totals from the local spool, by harness and model family")
    .action((_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const summary = summarize(readSpool());
      const serial = (t: Totals) => ({ ...t, sessions: t.sessions.size });
      ui.result({
        all: serial(summary.all),
        byFamily: Object.fromEntries(
          [...summary.byFamily].map(([k, v]) => [k, serial(v)])
        ),
        byHarness: Object.fromEntries(
          [...summary.byHarness].map(([k, v]) => [k, serial(v)])
        ),
        first: summary.first ?? null,
        last: summary.last ?? null,
        spool: spoolDir(),
      });
      ui.intro("telemetry");
      if (summary.all.events === 0 && summary.all.sessions.size === 0) {
        ui.info("Nothing recorded on this machine yet.");
        ui.next([
          [
            "hackspain watch",
            "start reporting your AI usage to the live board",
          ],
        ]);
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
      ui.table(
        [...summary.byFamily].map(([k, v]) => row(k, v)),
        ["Model", "Requests", "Sessions", "Input", "Output", "Cached", "Cost"]
      );
      ui.line(
        c.dim(
          `${formatWhen(Date.parse(summary.first ?? ""))} → ${formatWhen(Date.parse(summary.last ?? ""))} · ${spoolDir()}`
        )
      );
    });
}
