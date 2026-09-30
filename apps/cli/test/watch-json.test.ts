import { expect, test } from "bun:test";
import { createJsonWatchReporter } from "../src/commands/watch";
import { EXIT } from "../src/lib/errors";
import { uiFor } from "../src/lib/output";

function captureReporter(
  run: (reporter: ReturnType<typeof createJsonWatchReporter>) => void
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  const originalLog = console.log;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  console.log = (...args: unknown[]) => {
    stdout.push(`${args.map(String).join(" ")}\n`);
  };
  try {
    run(createJsonWatchReporter(uiFor({ interactive: false, json: true })));
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
    console.log = originalLog;
  }
  return { stdout: stdout.join(""), stderr: stderr.join("") };
}

test("watch --json --once returns one aggregate object and keeps progress off stdout", () => {
  const { stdout, stderr } = captureReporter((reporter) => {
    reporter.say("Watching: codex.");
    reporter.onScan({ byHarness: { codex: 2 }, events: 2, skipped: 1 });
    reporter.finish(EXIT.OK, true);
  });
  expect(stdout.trim().split("\n")).toHaveLength(1);
  expect(JSON.parse(stdout)).toEqual({
    ok: true,
    data: {
      byHarness: { codex: 2 },
      events: 2,
      exitCode: EXIT.OK,
      mode: "once",
      notifications: 0,
      scans: 1,
      skipped: 1,
      status: "completed",
    },
  });
  expect(stderr).toContain("Watching: codex.");
});

test("continuous watch --json writes one final object after scans and notifications", () => {
  const { stdout, stderr } = captureReporter((reporter) => {
    reporter.onScan({ byHarness: { codex: 1 }, events: 1, skipped: 0 });
    reporter.onScan({
      byHarness: { codex: 2, cursor: 1 },
      events: 3,
      skipped: 1,
    });
    reporter.announce("News", "Hello", Date.UTC(2026, 8, 19));
    reporter.finish(EXIT.INTERRUPTED, false);
  });
  expect(stdout.trim().split("\n")).toHaveLength(1);
  expect(JSON.parse(stdout).data).toEqual({
    byHarness: { codex: 3, cursor: 1 },
    events: 4,
    exitCode: EXIT.INTERRUPTED,
    mode: "continuous",
    notifications: 1,
    scans: 2,
    skipped: 1,
    status: "interrupted",
  });
  expect(stderr).toContain("Organisers: News\nHello");
});
