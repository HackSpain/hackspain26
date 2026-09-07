import type { Command, CommanderError } from "commander";
import { EXIT, explainError } from "./errors";
import { printJsonError } from "./output";

function isCommanderError(err: unknown): err is CommanderError {
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
 */
export async function runCli(
  program: Command,
  argv = process.argv
): Promise<never> {
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  const json = argv.includes("--json");
  try {
    await program.parseAsync(argv);
    process.exit(EXIT.OK);
  } catch (err) {
    if (isCommanderError(err)) {
      const passthrough =
        err.code === "commander.helpDisplayed" ||
        err.code === "commander.version" ||
        err.code === "commander.help";
      process.exit(passthrough ? EXIT.OK : EXIT.USAGE);
    }
    const explained = explainError(err);
    if (json) {
      printJsonError(explained);
    } else {
      process.stderr.write(`error: ${explained.message}\n`);
      if (explained.hint) {
        process.stderr.write(`  ${explained.hint}\n`);
      }
    }
    process.exit(explained.exitCode);
  }
}
