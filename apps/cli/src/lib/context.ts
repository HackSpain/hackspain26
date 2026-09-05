import type { Command } from "commander";

export type CliContext = {
  json: boolean;
  urlOverride?: string;
  interactive: boolean;
};

export function contextFor(command: Command): CliContext {
  const opts = command.optsWithGlobals<{ json?: boolean; url?: string }>();
  const json = Boolean(opts.json);
  return {
    json,
    urlOverride: opts.url,
    interactive: !json && Boolean(process.stdin.isTTY && process.stdout.isTTY),
  };
}
