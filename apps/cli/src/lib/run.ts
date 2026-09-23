import { log } from "@clack/prompts";
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
 * Parse and run, turning every failure into a single explained message and a
 * stable exit code. Commander's own help/version exits are passed through.
 * An action that finishes normally can still report through
 * `process.exitCode` (`watch --once`, `telemetry sync`); that value wins.
 */
export async function runToExitCode(
  program: Command,
  argv = process.argv
): Promise<number> {
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  const json = argv.includes("--json");
  try {
    await program.parseAsync(argv);
    const reported = process.exitCode;
    return typeof reported === "number" ? reported : EXIT.OK;
  } catch (error) {
    if (isCommanderError(error)) {
      const passthrough =
        error.code === "commander.helpDisplayed" ||
        error.code === "commander.version" ||
        error.code === "commander.help";
      return passthrough ? EXIT.OK : EXIT.USAGE;
    }
    const explained = explainError(error);
    if (json) {
      printJsonError(explained);
    } else {
      const shown = terminalExplained(explained);
      const hint = shown.hint ? `\n${c.dim(shown.hint)}` : "";
      log.error(`${c.red(shown.message)}${hint}`);
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
