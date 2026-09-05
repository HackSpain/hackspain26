import { cancel, isCancel, password, text } from "@clack/prompts";
import type { CliContext } from "./context";
import { EXIT, usageError } from "./errors";

/** Exit cleanly when the user hits Ctrl+C inside a prompt. */
export function guard<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(EXIT.INTERRUPTED);
  }
  return value as T;
}

/**
 * Use a flag value when given; otherwise prompt, but only when interactive.
 * In `--json` or non-TTY mode a missing value is a usage error naming the flag.
 */
export async function textOrFlag(
  ctx: CliContext,
  flagValue: string | undefined,
  options: {
    flag: string;
    message: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
    secret?: boolean;
  }
): Promise<string> {
  if (flagValue !== undefined) {
    const error = options.validate?.(flagValue);
    if (error) {
      throw usageError(`${options.flag}: ${error}`);
    }
    return flagValue;
  }
  if (!ctx.interactive) {
    throw usageError(
      `Missing ${options.flag}.`,
      "Prompts are disabled in --json or non-interactive mode; pass the value as a flag."
    );
  }
  const prompt = options.secret ? password : text;
  const value = guard(
    await prompt({
      message: options.message,
      placeholder: options.placeholder,
      validate: (input) => options.validate?.(input ?? ""),
    })
  );
  return value;
}
