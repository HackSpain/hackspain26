import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readConfig } from "../lib/config";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { requireOnboarded } from "../lib/me";
import { uiFor } from "../lib/output";
import { acquireWatchLock, runWatch } from "../watcher";

type WatchFlags = {
  once?: boolean;
  interval: string;
  backfill?: string;
  toast: boolean;
  upload: boolean;
  sinkUrl?: string;
  verbose?: boolean;
};

function positiveNumber(flag: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw usageError(`${flag} must be a positive number, got "${raw}".`);
  }
  return value;
}

export function registerWatch(program: Command): void {
  program
    .command("watch")
    .description(
      "Run in the background during the hackathon: reports AI-harness usage and shows organiser messages"
    )
    .option("--once", "scan once, flush, and exit")
    .option("-i, --interval <seconds>", "seconds between scans", "30")
    .option(
      "--backfill <hours>",
      "also report usage from the last N hours (default: from now)"
    )
    .option("--no-toast", "print notifications only, no desktop toast")
    .option("--no-upload", "keep events in the local spool only")
    .option(
      "--sink-url <url>",
      "upload NDJSON batches here instead of the dashboard (config telemetry.url also works)"
    )
    .option("--verbose", "log every scan, even empty ones")
    .action(async (flags: WatchFlags, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const intervalMs = positiveNumber("--interval", flags.interval) * 1000;
      const backfillMs = flags.backfill
        ? positiveNumber("--backfill", flags.backfill) * 3_600_000
        : 0;

      const session = await openSession(ctx, { requireAuth: true });
      const me = await requireOnboarded(session);
      const team = await session.client.query(api.teams.mine, {});
      const releaseLock = acquireWatchLock();
      const say = (message: string) => {
        if (ctx.json) {
          console.log(
            JSON.stringify({ event: "log", message, at: Date.now() })
          );
        } else {
          console.log(message);
        }
      };
      const log = (message: string) => {
        if (flags.verbose || ctx.json) {
          process.stderr.write(`${message}\n`);
        }
      };
      const uploadUrl = flags.upload
        ? (flags.sinkUrl ??
          readConfig().telemetry?.url ??
          `${session.url}/api/cli/telemetry`)
        : undefined;
      try {
        ui.intro(
          `hackspain watch ${flags.once ? "(once)" : `every ${flags.interval}s`}`
        );
        const code = await runWatch(
          {
            once: Boolean(flags.once),
            intervalMs,
            since: Date.now() - backfillMs,
            toast: flags.toast,
            uploadUrl,
            verbose: Boolean(flags.verbose),
          },
          { session, me, teamId: team?._id, log, say }
        );
        process.exitCode = code;
      } finally {
        releaseLock();
      }
    });
}
