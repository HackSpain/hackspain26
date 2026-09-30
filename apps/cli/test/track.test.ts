import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { registerTrack } from "../src/commands/track";
import { overrideExits } from "../src/lib/run";

describe("track commands", () => {
  for (const action of ["register", "unregister"]) {
    test(`${action} rejects a second slug`, async () => {
      const program = new Command().name("hackspain");
      registerTrack(program);
      overrideExits(program);
      const track = program.commands.find(
        (command) => command.name() === "track"
      );
      const command = track?.commands.find((item) => item.name() === action);
      command?.configureOutput({ writeErr: () => {} });

      await expect(
        program.parseAsync(["track", action, "theker", "maisa"], {
          from: "user",
        })
      ).rejects.toMatchObject({ code: "commander.excessArguments" });
    });
  }
});
