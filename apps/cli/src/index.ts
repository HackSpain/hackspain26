#!/usr/bin/env bun
import { Command } from "commander";
import { registerAuth } from "./commands/auth";
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

await runCli(program);
