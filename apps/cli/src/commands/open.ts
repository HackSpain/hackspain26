import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { openInBrowser } from "../lib/browser";
import { contextFor } from "../lib/context";
import { CliError, EXIT } from "../lib/errors";
import { uiFor } from "../lib/output";
import { c, cmd } from "../lib/style";

/**
 * `hackspain open [page]`: the dashboard in your browser, already signed in.
 * The CLI's session mints a single-use handoff token (cliAuth.startWebHandoff)
 * and opens /cli-auth/handoff, whose page exchanges it for the ordinary
 * dashboard cookies. Logging in here is therefore enough for the web too.
 */

export const HANDOFF_PATH = "/cli-auth/handoff";

/** Friendly names people type; anything else must be a `/path`. */
const PAGE_ALIASES: Record<string, string> = {
  home: "/",
  feed: "/feed",
  team: "/teams",
  teams: "/teams",
  tracks: "/tracks",
  track: "/tracks",
  project: "/tracks",
  perks: "/perks",
  perk: "/perks",
  profile: "/profile",
  insights: "/insights",
  participantes: "/participantes",
  people: "/participantes",
  cli: "/cli",
  tv: "/tv",
  judging: "/judging",
  admin: "/admin",
};

export function pageAliases(): string[] {
  return Object.keys(PAGE_ALIASES);
}

/**
 * Turn what the user typed into a same-origin dashboard path. Absolute URLs,
 * `//host` and backslashes are refused here and again by the page itself.
 */
export function normalizeDashboardPath(input?: string): string {
  const raw = (input ?? "").trim();
  if (!raw) {
    return "/";
  }
  const alias = PAGE_ALIASES[raw.toLowerCase()];
  if (alias) {
    return alias;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    throw new CliError(`"${raw}" is not a dashboard page.`, {
      code: "USAGE",
      exitCode: EXIT.USAGE,
      hint: `Use one of ${pageAliases().join(", ")} or a path such as /feed.`,
    });
  }
  return raw;
}

export function handoffUrl(
  appUrl: string,
  token: string,
  path: string
): string {
  const url = new URL(HANDOFF_PATH, appUrl);
  url.searchParams.set("hs-token", token);
  if (path !== "/") {
    url.searchParams.set("next", path);
  }
  return url.toString();
}

export function registerOpen(program: Command): void {
  program
    .command("open")
    .description("Open the dashboard in your browser, already signed in")
    .argument(
      "[page]",
      `page or path: ${["feed", "teams", "tracks", "perks", "profile"].join(", ")}, /admin, … (default: home)`
    )
    .option("--print", "print the link instead of opening a browser")
    .action(
      async (
        page: string | undefined,
        opts: { print?: boolean },
        command: Command
      ) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const path = normalizeDashboardPath(page);
        const session = await openSession(ctx, { requireAuth: true });
        const { token, expiresAt } = await ui.spin(
          "Preparing a signed-in link…",
          () => session.client.mutation(api.cliAuth.startWebHandoff, {}),
          "Link ready"
        );
        const url = handoffUrl(session.url, token, path);

        if (ctx.json) {
          ui.result({ url, path, expiresAt, opened: false });
          return;
        }
        const opened = !opts.print && ctx.interactive && openInBrowser(url);
        ui.result({ url, path, expiresAt, opened });
        if (opened) {
          ui.success(
            `Opening ${c.bold(path)} in your browser, no login needed.`
          );
          ui.line(c.dim("If nothing happened, open this link yourself:"));
        } else {
          ui.info(`Open this link to land on ${c.bold(path)} signed in:`);
        }
        ui.line(url);
        ui.line(
          c.dim(
            `Works once and expires in 2 minutes. Run ${cmd("hackspain open")} again for a fresh one.`
          )
        );
      }
    );
}
