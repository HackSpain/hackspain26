import { startGithubLink } from "../commands/profile";
import type { Session } from "./api";
import type { CliContext } from "./context";
import { CliError } from "./errors";
import type { Me } from "./me";
import { fetchMe } from "./me";
import type { Ui } from "./output";
import { cmd } from "./style";

const POLL_MS = 2000;
const WAIT_MS = 3 * 60 * 1000;

export function canReadGithubRepos(me: Me): boolean {
  return me.githubCanReadRepos;
}

/**
 * Stack/repo detection reads GitHub as the participant. Block until their
 * OAuth token is stored; completeProfile may skip this, this flow does not.
 */
export async function ensureGithubLinked(
  ctx: CliContext,
  ui: Ui,
  session: Session,
  me: Me
): Promise<Me> {
  if (canReadGithubRepos(me)) {
    return me;
  }
  const url = await startGithubLink(session, ui);
  if (!ctx.interactive) {
    throw new CliError(
      me.githubLinked
        ? "GitHub is linked, but we cannot read your repos yet. Authorise again."
        : "Link GitHub before setting a repo.",
      {
        code: "GITHUB",
        hint: url,
      }
    );
  }
  ui.note(
    `${url}\n\nAuthorise HackSpain there (we need repo read so private team repos work). Come back when the dashboard says you are linked.`,
    "Open this link in your browser"
  );
  return await ui.spin(
    "Waiting for GitHub…",
    async () => {
      const deadline = Date.now() + WAIT_MS;
      while (Date.now() < deadline) {
        await Bun.sleep(POLL_MS);
        const current = await fetchMe(session);
        if (current && canReadGithubRepos(current)) {
          return current;
        }
      }
      throw new CliError("GitHub was not linked in time.", {
        code: "GITHUB",
        hint: `Open the link again, or run ${cmd("hackspain profile github")}.`,
      });
    },
    "GitHub linked"
  );
}
