import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";

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
      const mine = await session.client.query(api.teams.mine, {});
      if (!mine) {
        throw new CliError("You are not in a team yet.", { code: "NO_TEAM" });
      }
      ui.result({ techStack: mine.techStack });
      ui.line(mine.techStack.length ? mine.techStack.join(", ") : "(not set)");
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
      const saved = await session.client.mutation(api.teams.setTechStack, {
        stack: tech.flatMap((t) => t.split(",")),
      });
      ui.result({ techStack: saved });
      ui.success(
        saved.length ? `Stack: ${saved.join(", ")}` : "Stack cleared."
      );
    });
}
