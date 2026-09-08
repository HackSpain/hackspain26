import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import { ensureGithubLinked } from "../lib/github-link";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { detectAndConfirmStack } from "../lib/stack-flow";
import { c, highlight } from "../lib/style";

export function registerStack(program: Command): void {
  const stack = program
    .command("stack")
    .description("Detect or override the technologies your team is using");

  stack
    .command("show")
    .description("Your team's stack (detected from the repo, or set by hand)")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const mine = await ui.spin(
        "Fetching your team…",
        () => session.client.query(api.teams.mine, {}),
        "Stack"
      );
      if (!mine) {
        throw new CliError("You are not in a team yet.", { code: "NO_TEAM" });
      }
      ui.result({ techStack: mine.techStack });
      if (mine.techStack.length === 0) {
        ui.info("No stack yet.");
        ui.next([
          ["hackspain team repo <url>", "link the repo and we will detect it"],
          ["hackspain stack detect", "read it again from the linked repo"],
        ]);
        return;
      }
      ui.line(mine.techStack.map((t) => highlight(t)).join(c.dim(" · ")));
    });

  stack
    .command("detect")
    .description("Read the stack from the team's linked GitHub repo(s)")
    .option("-y, --yes", "accept the detected stack without asking")
    .action(async (opts: { yes?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session, me } = await openParticipant(ctx);
      const mine = await session.client.query(api.teams.mine, {});
      if (!mine) {
        throw new CliError("You are not in a team yet.", { code: "NO_TEAM" });
      }
      if (mine.repoUrls.length === 0 && !mine.repoUrl) {
        throw new CliError("No repo linked yet.", {
          code: "NO_REPO",
          hint: "Run `hackspain team repo org/name`.",
        });
      }
      await ensureGithubLinked(ctx, ui, session, me);
      const techStack = await detectAndConfirmStack(ctx, ui, session, opts);
      ui.result({ techStack, repoUrls: mine.repoUrls });
    });

  stack
    .command("set <tech...>")
    .description(
      "Replace the stack by hand, e.g. `hackspain stack set Next.js Convex`"
    )
    .action(async (tech: string[], _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const saved = await ui.spin(
        "Saving your stack…",
        () =>
          session.client.mutation(api.teams.setTechStack, {
            stack: tech.flatMap((t) => t.split(",")),
          }),
        "Saved"
      );
      ui.result({ techStack: saved });
      ui.success(
        saved.length
          ? `Building with ${saved.map((t) => highlight(t)).join(c.dim(" · "))}`
          : "Stack cleared."
      );
    });
}
