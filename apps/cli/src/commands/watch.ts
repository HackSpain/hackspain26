import { note } from "@clack/prompts";
import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readConfig } from "../lib/config";
import { contextFor } from "../lib/context";
import { EXIT, usageError } from "../lib/errors";
import { formatEventDate, requireOnboarded } from "../lib/me";
import type { Ui } from "../lib/output";
import { firstName, uiFor } from "../lib/output";
import { c, terminalText } from "../lib/style";
import { detectImageProtocol } from "../lib/term-images";
import type { ScanResult } from "../watcher";
import { acquireWatchLock, runWatch } from "../watcher";
import { uninstallClaudeOtel } from "../watcher/collectors/claude-otel";
import { uninstallCursorHook } from "../watcher/collectors/cursor";
import { openMemory } from "../watcher/memory";
import { startScreen, summaryLines } from "../watcher/screen";
import { createState, feedLive, scrollFeed } from "../watcher/state";
import { collectionWindow, windowNotice } from "../watcher/window";
import { autoUpdate, restartCurrentCommand } from "./update";

type WatchFlags = {
  uninstall?: boolean;
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

export function createJsonWatchReporter(ui: Pick<Ui, "result">) {
  const summary = {
    scans: 0,
    events: 0,
    skipped: 0,
    byHarness: {} as Record<string, number>,
    notifications: 0,
  };
  return {
    onScan(scanned: ScanResult) {
      summary.scans++;
      summary.events += scanned.events;
      summary.skipped += scanned.skipped;
      for (const [harness, count] of Object.entries(scanned.byHarness)) {
        summary.byHarness[harness] = (summary.byHarness[harness] ?? 0) + count;
      }
    },
    say(message: string) {
      process.stderr.write(`${terminalText(message)}\n`);
    },
    announce(subject: string, body: string, at: number) {
      summary.notifications++;
      process.stderr.write(
        `${new Date(at).toISOString()} Organisers: ${terminalText(subject)}\n${terminalText(body)}\n`
      );
    },
    finish(code: number, once: boolean) {
      let status = "pending";
      if (code === EXIT.OK) {
        status = "completed";
      } else if (code === EXIT.INTERRUPTED) {
        status = "interrupted";
      }
      ui.result({
        ...summary,
        exitCode: code,
        mode: once ? "once" : "continuous",
        status,
      });
    },
  };
}

export function registerWatch(program: Command): void {
  program
    .command("watch")
    .description(
      "Keep this open during the hackathon: live usage board and organiser messages"
    )
    .option("--once", "scan once, flush, and exit")
    .option(
      "--uninstall",
      "remove HackSpain Cursor hooks and Claude exporter settings"
    )
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
      if (flags.uninstall) {
        const releaseLock = acquireWatchLock();
        try {
          const failures: string[] = [];
          let cursor: ReturnType<typeof uninstallCursorHook> | "error" =
            "error";
          let claude: ReturnType<typeof uninstallClaudeOtel> | "error" =
            "error";
          try {
            cursor = uninstallCursorHook();
          } catch (error) {
            failures.push(`Cursor: ${String(error)}`);
          }
          try {
            claude = uninstallClaudeOtel();
          } catch (error) {
            failures.push(`Claude Code: ${String(error)}`);
          }
          if (ctx.json) {
            ui.result({ claude, cursor, failures });
          } else {
            ui.intro("watch · uninstall");
            ui.line(`Cursor hooks: ${cursor}`);
            ui.line(`Claude exporter: ${claude}`);
            for (const failure of failures) {
              ui.warn(failure);
            }
            if (claude === "unverified") {
              ui.warn(
                "Claude settings were kept because their ownership could not be verified."
              );
            }
            ui.outro("Local telemetry and saved sessions remain available.");
          }
          process.exitCode =
            failures.length > 0 || claude === "unverified" ? 1 : 0;
        } finally {
          releaseLock();
        }
        return;
      }
      const jsonReporter = ctx.json ? createJsonWatchReporter(ui) : undefined;
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
        backfill: true,
        intervalMs,
        once: Boolean(flags.once),
        toast: flags.toast,
        window,
        uploadUrl,
        verbose: Boolean(flags.verbose),
      };
      let updatedVersion: string | undefined;
      const checkForUpdate = async (): Promise<boolean> => {
        // The JSON result belongs to this invocation; restarting here would
        // exit before it is written and may create a second result document.
        if (ctx.json) {
          return false;
        }
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
        if (jsonReporter) {
          jsonReporter.say(message);
        } else {
          console.log(message);
        }
      };
      const log = (message: string) => {
        process.stderr.write(`${terminalText(message)}\n`);
      };
      const announce = (subject: string, body: string, at: number) => {
        if (jsonReporter) {
          jsonReporter.announce(subject, body, at);
          return;
        }
        process.stdout.write("\u0007");
        note(
          terminalText(body),
          `📣 ${c.bold(terminalText(subject))} ${c.dim(`· organisers · ${new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`)}`
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
              `Hi ${terminalText(firstName(me.name, me.email))}. Leave this running: your AI usage feeds the live board${team ? ` for ${terminalText(team.name)}` : ""}, and organiser messages show up here.`
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
          onScan: jsonReporter?.onScan,
          say,
          session,
          teamId: team?._id,
        });
      } finally {
        releaseLock();
      }
      await restartAfterUpdate();
      jsonReporter?.finish(code, Boolean(flags.once));
      process.exitCode = code;
    });
}
