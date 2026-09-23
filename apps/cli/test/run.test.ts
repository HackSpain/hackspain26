import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Command } from "commander";
import { EXIT, usageError } from "../src/lib/errors";
import { runToExitCode } from "../src/lib/run";

function programWith(action: () => void | Promise<void>): Command {
  // `--json` lives on the root like in the real program; a subcommand that
  // does not know the flag would call process.exit itself (see #330).
  const program = new Command("hackspain").option("--json");
  program.command("sync").action(action);
  return program;
}

const argv = (...args: string[]) => ["bun", "hackspain", ...args];

/** Run with stdout, stderr and console muted so explained errors do not litter the test log. */
async function quiet<T>(work: () => Promise<T>): Promise<T> {
  const out = process.stdout.write;
  const err = process.stderr.write;
  const consoleLog = console.log;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  console.log = () => {};
  try {
    return await work();
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
    console.log = consoleLog;
  }
}

describe("runToExitCode", () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });
  afterEach(() => {
    process.exitCode = undefined;
  });

  test("an action that finishes normally exits OK", async () => {
    expect(
      await runToExitCode(
        programWith(() => {}),
        argv("sync")
      )
    ).toBe(EXIT.OK);
  });

  test("keeps the code an action reports through process.exitCode", async () => {
    const program = programWith(() => {
      process.exitCode = EXIT.NETWORK;
    });
    expect(await runToExitCode(program, argv("sync"))).toBe(EXIT.NETWORK);
  });

  test("an action that reports 0 explicitly exits OK", async () => {
    const program = programWith(() => {
      process.exitCode = 0;
    });
    expect(await runToExitCode(program, argv("sync"))).toBe(EXIT.OK);
  });

  test("a thrown CliError maps to its exit code", async () => {
    const program = programWith(() => {
      throw usageError("missing name", "pass --name");
    });
    expect(await quiet(() => runToExitCode(program, argv("sync")))).toBe(
      EXIT.USAGE
    );
  });

  test("with --json the error keeps its exit code too", async () => {
    const program = programWith(() => {
      throw usageError("missing name");
    });
    expect(
      await quiet(() => runToExitCode(program, argv("sync", "--json")))
    ).toBe(EXIT.USAGE);
  });

  test("an unexpected error exits ERROR even if the action reported another code", async () => {
    const program = programWith(() => {
      process.exitCode = EXIT.NETWORK;
      throw new Error("boom");
    });
    expect(await quiet(() => runToExitCode(program, argv("sync")))).toBe(
      EXIT.ERROR
    );
  });

  test("commander help passes through as OK and an unknown option is a usage error", async () => {
    expect(
      await quiet(() =>
        runToExitCode(
          programWith(() => {}),
          argv("--help")
        )
      )
    ).toBe(EXIT.OK);
    expect(
      await quiet(() =>
        runToExitCode(
          programWith(() => {}),
          argv("--bogus")
        )
      )
    ).toBe(EXIT.USAGE);
  });
});
