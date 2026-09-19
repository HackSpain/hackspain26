import { note } from "@clack/prompts";
import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readConfig } from "../lib/config";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { formatEventDate, requireOnboarded } from "../lib/me";
import { firstName, uiFor } from "../lib/output";
import { c } from "../lib/style";
import { detectImageProtocol } from "../lib/term-images";
import { acquireWatchLock, runWatch } from "../watcher";
import { openMemory } from "../watcher/memory";
import { startScreen, summaryLines } from "../watcher/screen";
import { createState, feedLive, scrollFeed } from "../watcher/state";
import { collectionWindow, windowNotice } from "../watcher/window";
import { autoUpdate, restartCurrentCommand } from "./update";

type WatchFlags = {
  once?: boolean;
  interval: string;
  toast: boolean;
  upload: boolean;
  sinkUrl?: string;
  verbose?: boolean;
  plain?: boolean;
  images: boolean;
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
    .option("--no-toast", "print notifications only, no desktop toast")
    .option("--no-upload", "keep events in the local spool only")
    .option(
      "--sink-url <url>",
      "upload NDJSON batches here instead of the dashboard (config telemetry.url also works)"
    )
    .option("--plain", "line-by-line output instead of the full-screen view")
    .option("--no-images", "links instead of inline pictures in the feed band")
    .option("--verbose", "log every scan, even empty ones")
    .action(async (flags: WatchFlags, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const intervalMs = positiveNumber("--interval", flags.interval) * 1000;
      const memory = openMemory();
      const session = await openSession(ctx, { requireAuth: true });
      // Outside the hackathon the watcher still runs and says it is not
      // recording: opened early it starts on its own at the opening time,
      // opened late it delivers what the window holds and was never sent.
      const me = await requireOnboarded(session, { allowClosed: true });
      // The whole hackathon window, whenever the watcher was opened, and
      // nothing outside it for anybody. No schedule, nothing recorded.
      const window = collectionWindow(me);
      // Team and project are hackathon-window functions; closed means none.
      const [team, submission] = me.event.open
        ? await Promise.all([
            session.client.query(api.teams.mine, {}),
            session.client.query(api.submissions.mine, {}),
          ])
        : [null, null];
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
        intervalMs,
        once: Boolean(flags.once),
        toast: flags.toast,
        window,
        uploadUrl,
        verbose: Boolean(flags.verbose),
      };
      let updatedVersion: string | undefined;
      const checkForUpdate = async (): Promise<boolean> => {
        updatedVersion = await autoUpdate(process.argv.slice(2), {
          silent: true,
        });
        return Boolean(updatedVersion);
      };

      const restartAfterUpdate = async (): Promise<void> => {
        if (!updatedVersion) {
          return;
        }
        ui.success(
          `Updated to ${updatedVersion} while watching. Restarting watch…`
        );
        process.exit(await restartCurrentCommand());
      };

      if (fullScreen) {
        const state = createState({
          imageProtocol: flags.images
            ? detectImageProtocol(process.env, true)
            : null,
          me: { email: me.email, name: firstName(me.name, me.email) },
          project: submission
            ? {
                name: submission.name,
                status: submission.status,
                tracks: submission.challenges.map((x) => x.label),
                updatedAt: submission.updatedAt,
              }
            : undefined,
          team: team
            ? {
                name: team.name,
                isOwner: team.isOwner,
                repoUrl: team.repoUrl,
                members: team.members.length,
              }
            : undefined,
          uploadEnabled: Boolean(uploadUrl),
          window,
        });
        const screen = startScreen(state, {
          intervalMs,
          onQuit: () => {
            state.stopRequested = true;
            state.wake?.();
          },
          onFeedLive: () => feedLive(state),
          onFeedScroll: (delta) => {
            scrollFeed(state, delta);
            if (state.feedNeedOlder) {
              state.wake?.();
            }
          },
          onTogglePause: () => {
            state.paused = !state.paused;
            state.wake?.();
          },
        });
        try {
          await runWatch(options, {
            announce: () => process.stdout.write("\x07"),
            checkForUpdate,
            log: () => undefined,
            me,
            memory,
            say: () => undefined,
            session,
            state,
            teamId: team?._id,
          });
        } finally {
          screen.stop();
          releaseLock();
        }
        await restartAfterUpdate();
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
            JSON.stringify({ at: Date.now(), event: "log", message })
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
            JSON.stringify({ at, body, event: "notification", subject })
          );
          return;
        }
        process.stdout.write("\u0007");
        note(
          body,
          `📣 ${c.bold(subject)} ${c.dim(`· organisers · ${new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`)}`
        );
      };
      let code: number;
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
        const notice = windowNotice(window, Date.now(), formatEventDate);
        if (notice) {
          ui.warn(notice);
        }
        if (window) {
          ui.line(
            c.dim(
              `Reporting AI usage from ${formatEventDate(window.since)} to ${formatEventDate(window.until)}, including what happened while this was closed. Nothing outside that window is recorded or sent.`
            )
          );
        }
        code = await runWatch(options, {
          announce,
          checkForUpdate,
          log,
          me,
          memory,
          say,
          session,
          teamId: team?._id,
        });
      } finally {
        releaseLock();
      }
      await restartAfterUpdate();
      process.exitCode = code;
    });
}
