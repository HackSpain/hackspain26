import type { Command } from "commander";
import { recordCursorHook } from "../watcher/collectors/cursor";

const MAX_HOOK_BYTES = 8 * 1024 * 1024;

async function readHookInput(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_HOOK_BYTES) {
      return null;
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

/** Internal Cursor hook target; intentionally hidden from participant help. */
export function registerCursorHook(program: Command): void {
  program
    .command("_cursor-hook", { hidden: true })
    .allowUnknownOption(false)
    .action(async () => {
      const input = await readHookInput();
      if (input !== null) {
        recordCursorHook(input);
      }
    });
}
