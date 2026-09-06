#!/usr/bin/env bun
import { buildProgram } from "./lib/program";
import { runCli } from "./lib/run";

await runCli(buildProgram());
