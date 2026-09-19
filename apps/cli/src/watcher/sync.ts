import type { Session } from "../lib/api";
import { api } from "../lib/api";
import { readConfig } from "../lib/config";
import { CliError, EXIT } from "../lib/errors";
import type { Me } from "../lib/me";
import { formatEventDate } from "../lib/me";
import { acquireWatchLock, runWatch } from "./index";
import { collectionWindow } from "./window";

/** A finite authenticated catch-up, shared by login and `telemetry sync`. */
export async function syncTelemetry(
  session: Session,
  me: Me,
  log: (message: string) => void
): Promise<{
  status: "synced" | "pending" | "watcher-running" | "unscheduled";
}> {
  const window = collectionWindow(me);
  if (!window) {
    return { status: "unscheduled" };
  }
  let release: () => void;
  try {
    release = acquireWatchLock();
  } catch (error) {
    if (error instanceof CliError && error.code === "WATCHER_RUNNING") {
      return { status: "watcher-running" };
    }
    throw error;
  }
  try {
    // Team lookup can be closed outside the event; late usage still uploads.
    const team = me.event.open
      ? await session.client.query(api.teams.mine, {})
      : null;
    log(
      `Recovering available AI usage since the event started: ${formatEventDate(window.since)}…`
    );
    log(
      "Cursor usage before installing its hooks needs an external usage export; transcripts do not contain tokens."
    );
    const code = await runWatch(
      {
        backfill: true,
        once: true,
        intervalMs: 30_000,
        toast: false,
        uploadUrl:
          readConfig().telemetry?.url ?? `${session.url}/api/cli/telemetry`,
        verbose: false,
        window,
      },
      { session, me, teamId: team?._id, log, say: log }
    );
    return { status: code === EXIT.OK ? "synced" : "pending" };
  } finally {
    release();
  }
}
