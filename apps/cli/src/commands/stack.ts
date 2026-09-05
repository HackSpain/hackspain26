import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { c, highlight } from "../lib/style";

export function registerStack(program: Command): void {
  const stack = program
    .command("stack")
    .description("Declare the technologies your team is using");

  stack
    .command("show")
    .description("Your team's declared stack")
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
        ui.info("No stack declared yet.");
        ui.next([
          [
            "hackspain stack set nextjs convex claude-code",
            "list what you are building with",
          ],
        ]);
        return;
      }
      ui.line(mine.techStack.map((t) => highlight(t)).join(c.dim(" · ")));
    });

  stack
    .command("set <tech...>")
    .description(
      "Replace the stack, e.g. `hackspain stack set nextjs convex claude-code`"
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
