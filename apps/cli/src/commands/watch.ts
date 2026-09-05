import { note } from "@clack/prompts";
import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readConfig } from "../lib/config";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { requireOnboarded } from "../lib/me";
import { firstName, uiFor } from "../lib/output";
import { c } from "../lib/style";
import { acquireWatchLock, runWatch } from "../watcher";
import { startScreen, summaryLines } from "../watcher/screen";
import { createState } from "../watcher/state";

type WatchFlags = {
  once?: boolean;
  interval: string;
  backfill?: string;
  toast: boolean;
  upload: boolean;
  sinkUrl?: string;
  verbose?: boolean;
  plain?: boolean;
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
      "Keep this open during the hackathon: live usage board and organiser messages"
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
    .option("--plain", "line-by-line output instead of the full-screen view")
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
      const [team, submission] = await Promise.all([
        session.client.query(api.teams.mine, {}),
        session.client.query(api.submissions.mine, {}),
      ]);
      const releaseLock = acquireWatchLock();
      const uploadUrl = flags.upload
        ? (flags.sinkUrl ??
          readConfig().telemetry?.url ??
          `${session.url}/api/cli/telemetry`)
        : undefined;
      const fullScreen =
        !(ctx.json || flags.once || flags.plain) &&
        Boolean(process.stdout.isTTY);

      const options = {
        once: Boolean(flags.once),
        intervalMs,
        since: Date.now() - backfillMs,
        toast: flags.toast,
        uploadUrl,
        verbose: Boolean(flags.verbose),
      };

      if (fullScreen) {
        const state = createState({
          me: { name: firstName(me.name, me.email), email: me.email },
          team: team
            ? {
                name: team.name,
                isOwner: team.isOwner,
                repoUrl: team.repoUrl,
                members: team.members.length,
              }
            : undefined,
          project: submission
            ? {
                name: submission.name,
                status: submission.status,
                tracks: submission.challenges.map((x) => x.label),
                updatedAt: submission.updatedAt,
              }
            : undefined,
          uploadEnabled: Boolean(uploadUrl),
        });
        const screen = startScreen(state, {
          onQuit: () => {
            state.stopRequested = true;
          },
          onTogglePause: () => {
            state.paused = !state.paused;
          },
        });
        try {
          await runWatch(options, {
            session,
            me,
            teamId: team?._id,
            state,
            log: () => undefined,
            say: () => undefined,
            announce: () => process.stdout.write("\x07"),
          });
        } finally {
          screen.stop();
          releaseLock();
        }
        console.log();
        ui.intro("watch");
        for (const line of summaryLines(state)) {
          ui.line(line);
        }
        ui.outro("Thanks for keeping it running. Run it again any time.");
        process.exitCode = 0;
        return;
      }

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
      const announce = (subject: string, body: string, at: number) => {
        if (ctx.json) {
          console.log(
            JSON.stringify({ event: "notification", subject, body, at })
          );
          return;
        }
        process.stdout.write("\x07");
        note(
          body,
          `📣 ${c.bold(subject)} ${c.dim(`· organisers · ${new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`)}`
        );
      };
      try {
        ui.intro(
          flags.once
            ? "watch · once"
            : `watch ${c.dim(`· every ${flags.interval}s · Ctrl+C to stop`)}`
        );
        if (!flags.once) {
          ui.line(
            c.dim(
              `Hi ${firstName(me.name, me.email)}. Leave this running: your AI usage feeds the live board${team ? ` for ${team.name}` : ""}, and organiser messages show up here.`
            )
          );
        }
        const code = await runWatch(options, {
          session,
          me,
          teamId: team?._id,
          log,
          say,
          announce,
        });
        process.exitCode = code;
      } finally {
        releaseLock();
      }
    });
}
