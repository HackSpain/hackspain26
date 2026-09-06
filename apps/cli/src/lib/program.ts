import { Command } from "commander";
import { registerAuth } from "../commands/auth";
import { registerFeed } from "../commands/feed";
import { registerHome } from "../commands/home";
import { registerMilestone } from "../commands/milestone";
import { registerPerk } from "../commands/perk";
import { registerProfile } from "../commands/profile";
import { registerProject } from "../commands/project";
import { registerStack } from "../commands/stack";
import { registerSubmit } from "../commands/submit";
import { registerTeam } from "../commands/team";
import { registerTelemetry } from "../commands/telemetry";
import { registerTrack } from "../commands/track";
import { registerUpdate } from "../commands/update";
import { registerWatch } from "../commands/watch";
import { VERSION } from "../version";
import { banner } from "./banner";
import { c, cmd } from "./style";

/**
 * Assemble the whole CLI. A factory rather than a singleton so the home
 * menu can dispatch each selection through a fresh program: Commander keeps
 * parsed option values on the command objects, and a clean instance
 * guarantees one menu action never leaks flags into the next.
 */
export function buildProgram(): Command {
  const program = new Command()
    .name("hackspain")
    .description("Your terminal companion for HackSpain 2026")
    .version(VERSION, "-v, --version")
    .addHelpText(
      "beforeAll",
      `${banner(`HackSpain 2026 · Madrid · v${VERSION}`)}\n`
    )
    .addHelpText(
      "afterAll",
      `\n${c.dim("Start with")} ${cmd("hackspain auth login")}${c.dim(", then just")} ${cmd("hackspain")} ${c.dim("to see where you stand.")}\n`
    )
    .option("--json", "machine-readable output on stdout, no prompts")
    .option(
      "--url <url>",
      "dashboard URL (default: HACKSPAIN_APP_URL, config, then app.hackspain.com)"
    )
    .showHelpAfterError("(run with --help for usage)")
    .showSuggestionAfterError();

  registerHome(program, buildProgram);
  registerAuth(program);
  registerProfile(program);
  registerTeam(program);
  registerTrack(program);
  registerProject(program);
  registerSubmit(program);
  registerPerk(program);
  registerMilestone(program);
  registerStack(program);
  registerFeed(program);
  registerWatch(program);
  registerTelemetry(program);
  registerUpdate(program);

  return program;
}
