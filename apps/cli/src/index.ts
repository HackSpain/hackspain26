#!/usr/bin/env bun
import { autoUpdate, restartCurrentCommand } from "./commands/update";
import { buildProgram } from "./lib/program";
import { runCli } from "./lib/run";

if (await autoUpdate(process.argv.slice(2))) {
  process.exit(await restartCurrentCommand());
}
await runCli(buildProgram());
