import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Command } from "commander";
import { EXIT, usageError } from "../src/lib/errors";
import { buildProgram } from "../src/lib/program";
import { isCommanderError, overrideExits, runToExitCode } from "../src/lib/run";

function programWith(action: () => void | Promise<void>): Command {
  // `--json` lives on the root like in the real program. The subcommands are
  // registered before runToExitCode ever sees the program, exactly like
  // buildProgram() does, so they only stop calling process.exit if the
  // override reaches the whole tree (#330).
  const program = new Command("hackspain").option("--json");
  program.command("sync").action(action);
  program.command("join <code>").action(action);
  return program;
}

const argv = (...args: string[]) => ["bun", "hackspain", ...args];

type Captured<T> = { value: T; stdout: string[] };

/**
 * Run with stdout, stderr and console muted so explained errors do not litter
 * the test log; what went to stdout is kept, one entry per write, for the
 * `--json` contract.
 */
async function capture<T>(work: () => Promise<T>): Promise<Captured<T>> {
  const stdout: string[] = [];
  const out = process.stdout.write;
  const err = process.stderr.write;
  const consoleLog = console.log;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  try {
    return { stdout, value: await work() };
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
    console.log = consoleLog;
  }
}

async function quiet<T>(work: () => Promise<T>): Promise<T> {
  return (await capture(work)).value;
}

describe("runToExitCode", () => {
  // Bun ignores `process.exitCode = undefined` (Node resets it), so reset to
  // 0: otherwise the code one test reports leaks into the next test and into
  // the exit status of `bun test` itself.
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(() => {
    process.exitCode = 0;
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

  test("a subcommand usage error exits USAGE instead of leaving through process.exit", async () => {
    expect(
      await quiet(() =>
        runToExitCode(
          programWith(() => {}),
          argv("join")
        )
      )
    ).toBe(EXIT.USAGE);
    expect(
      await quiet(() =>
        runToExitCode(
          programWith(() => {}),
          argv("sync", "--bogus")
        )
      )
    ).toBe(EXIT.USAGE);
  });

  test("without --json a subcommand usage error writes nothing to stdout", async () => {
    const { stdout } = await capture(() =>
      runToExitCode(
        programWith(() => {}),
        argv("join")
      )
    );
    expect(stdout).toEqual([]);
  });

  test("with --json a subcommand usage error prints exactly one error envelope on stdout", async () => {
    const { value, stdout } = await capture(() =>
      runToExitCode(
        programWith(() => {}),
        argv("--json", "join")
      )
    );
    expect(value).toBe(EXIT.USAGE);
    expect(stdout).toHaveLength(1);
    const envelope = JSON.parse(stdout[0] ?? "") as {
      ok: boolean;
      code: string;
      message: string;
      hint?: string;
    };
    expect(envelope).toMatchObject({ code: "USAGE", ok: false });
    expect(envelope.message).toContain("missing required argument 'code'");
    expect(envelope.hint).toContain("--help");
  });

  test("the real program: `team join` without a code and `feed --bogus` are usage errors", async () => {
    expect(
      await quiet(() => runToExitCode(buildProgram(), argv("team", "join")))
    ).toBe(EXIT.USAGE);
    expect(
      await quiet(() => runToExitCode(buildProgram(), argv("feed", "--bogus")))
    ).toBe(EXIT.USAGE);
    expect(
      await quiet(() => runToExitCode(buildProgram(), argv("team", "--help")))
    ).toBe(EXIT.OK);

    const { value, stdout } = await capture(() =>
      runToExitCode(buildProgram(), argv("--json", "team", "join"))
    );
    expect(value).toBe(EXIT.USAGE);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      code: "USAGE",
      ok: false,
    });
  });
});

describe("overrideExits", () => {
  test("a subcommand usage error comes back as a CommanderError the menu can catch", async () => {
    const program = programWith(() => {});
    overrideExits(program);
    const failure = await quiet(() =>
      program.parseAsync(["join"], { from: "user" }).then(
        () => null,
        (error: unknown) => error
      )
    );
    expect(isCommanderError(failure)).toBe(true);
    expect((failure as { code: string }).code).toBe(
      "commander.missingArgument"
    );
  });
});
