#!/usr/bin/env bun
import { Command } from "commander";
import { registerAuth } from "./commands/auth";
import { registerMilestone } from "./commands/milestone";
import { registerPerk } from "./commands/perk";
import { registerProject } from "./commands/project";
import { registerStack } from "./commands/stack";
import { registerSubmit } from "./commands/submit";
import { registerTeam } from "./commands/team";
import { registerTrack } from "./commands/track";
import { runCli } from "./lib/run";
import { VERSION } from "./version";

const program = new Command()
  .name("hackspain")
  .description("Terminal client for HackSpain participants")
  .version(VERSION, "-v, --version")
  .option("--json", "machine-readable output on stdout, no prompts")
  .option(
    "--url <url>",
    "dashboard URL (default: HACKSPAIN_APP_URL, config, then app.hackspain.com)"
  )
  .showHelpAfterError("(run with --help for usage)")
  .showSuggestionAfterError();

registerAuth(program);
registerTeam(program);
registerTrack(program);
registerProject(program);
registerSubmit(program);
registerPerk(program);
registerMilestone(program);
registerStack(program);

await runCli(program);
