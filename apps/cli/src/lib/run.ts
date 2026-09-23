import type { Command, CommanderError } from "commander";
import { EXIT, explainError, terminalExplained } from "./errors";
import { printJsonError } from "./output";
import { c, cmd } from "./style";

export function isCommanderError(err: unknown): err is CommanderError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("commander.")
  );
}

/**
 * Commander copies `exitOverride()` and `configureOutput()` into a subcommand
 * only while `.command()` creates it. Calling them on a finished root leaves
 * every registered subcommand on `process.exit`, so a usage error inside
 * `team join` exited 1 with no JSON envelope and killed the menu (#330).
 * Apply both to the whole tree, however the program was built.
 */
export function overrideExits(program: Command): void {
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  for (const subcommand of program.commands) {
    overrideExits(subcommand);
  }
}

/** Commander exits that are not failures: help and version were asked for. */
const PASSTHROUGH = new Set([
  "commander.helpDisplayed",
  "commander.version",
  "commander.help",
]);
const COMMANDER_ERROR_PREFIX = /^error: /;

/**
 * Parse and run, turning every failure into a single explained message and a
 * stable exit code. Commander's own help/version exits are passed through;
 * its usage errors exit 2 and, with --json, also get the error envelope on
 * stdout (Commander has already written the human message to stderr).
 * An action that finishes normally can still report through
 * `process.exitCode` (`watch --once`, `telemetry sync`); that value wins.
 */
export async function runToExitCode(
  program: Command,
  argv = process.argv
): Promise<number> {
  overrideExits(program);
  const json = argv.includes("--json");
  try {
    await program.parseAsync(argv);
    const reported = process.exitCode;
    return typeof reported === "number" ? reported : EXIT.OK;
  } catch (error) {
    if (isCommanderError(error)) {
      if (PASSTHROUGH.has(error.code)) {
        return EXIT.OK;
      }
      if (json) {
        printJsonError({
          code: "USAGE",
          hint: "Run the command with --help for its usage.",
          message: error.message.replace(COMMANDER_ERROR_PREFIX, ""),
        });
      }
      return EXIT.USAGE;
    }
    const explained = explainError(error);
    if (json) {
      printJsonError(explained);
    } else {
      const shown = terminalExplained(explained);
      const hint = shown.hint ? `\n${c.dim(shown.hint)}` : "";
      process.stderr.write(`  ${c.red("✗")}  ${c.red(shown.message)}${hint}\n`);
      if (explained.exitCode === EXIT.ERROR && !explained.hint) {
        process.stderr.write(
          `${c.dim(`  Stuck? ${cmd("hackspain --help")} lists every command; organisers are on Discord.`)}\n`
        );
      }
    }
    return explained.exitCode;
  }
}

export async function runCli(
  program: Command,
  argv = process.argv
): Promise<never> {
  process.exit(await runToExitCode(program, argv));
}
