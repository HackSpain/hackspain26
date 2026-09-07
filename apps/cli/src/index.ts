#!/usr/bin/env bun
import { Command } from "commander";
import { registerAuth } from "./commands/auth";
import { registerFeed } from "./commands/feed";
import { registerHome } from "./commands/home";
import { registerMilestone } from "./commands/milestone";
import { registerPerk } from "./commands/perk";
import { registerProfile } from "./commands/profile";
import { registerProject } from "./commands/project";
import { registerStack } from "./commands/stack";
import { registerSubmit } from "./commands/submit";
import { registerTeam } from "./commands/team";
import { registerTelemetry } from "./commands/telemetry";
import { registerTrack } from "./commands/track";
import { registerUpdate } from "./commands/update";
import { registerWatch } from "./commands/watch";
import { banner } from "./lib/banner";
import { runCli } from "./lib/run";
import { c, cmd } from "./lib/style";
import { VERSION } from "./version";

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

registerHome(program);
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

await runCli(program);
