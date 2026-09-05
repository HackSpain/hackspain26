import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  type Option,
  password,
  text,
} from "@clack/prompts";
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

function requireInteractive(ctx: CliContext, flag: string): void {
  if (!ctx.interactive) {
    throw usageError(
      `Missing ${flag}.`,
      "Prompts are disabled in --json or non-interactive mode; pass the value as a flag."
    );
  }
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
    initialValue?: string;
    validate?: (value: string) => string | undefined;
    secret?: boolean;
    optional?: boolean;
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
    if (options.optional) {
      return options.initialValue ?? "";
    }
    requireInteractive(ctx, options.flag);
  }
  const prompt = options.secret ? password : text;
  const value = guard(
    await prompt({
      message: options.message,
      placeholder: options.placeholder,
      initialValue: options.initialValue,
      validate: (input) => {
        const current = input ?? "";
        if (options.optional && !current.trim()) {
          return;
        }
        return options.validate?.(current);
      },
    })
  );
  return value ?? "";
}

/** `--yes` style confirmation. Non-interactive without the flag is a usage error. */
export async function confirmOrFlag(
  ctx: CliContext,
  flagValue: boolean | undefined,
  options: { flag: string; message: string; initialValue?: boolean }
): Promise<boolean> {
  if (flagValue) {
    return true;
  }
  requireInteractive(ctx, options.flag);
  return guard(
    await confirm({
      message: options.message,
      initialValue: options.initialValue ?? true,
    })
  );
}

export async function pickMany<T extends string>(
  ctx: CliContext,
  flagValues: T[] | undefined,
  options: {
    flag: string;
    message: string;
    choices: Option<T>[];
    initial?: T[];
    required?: boolean;
  }
): Promise<T[]> {
  if (flagValues !== undefined) {
    return flagValues;
  }
  if (!ctx.interactive) {
    if (options.required && (options.initial ?? []).length === 0) {
      requireInteractive(ctx, options.flag);
    }
    return options.initial ?? [];
  }
  if (options.choices.length === 0) {
    return [];
  }
  return guard(
    await multiselect<T>({
      message: options.message,
      options: options.choices,
      initialValues: options.initial,
      required: options.required ?? false,
    })
  );
}
