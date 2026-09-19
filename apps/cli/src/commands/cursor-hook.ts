import type { Command } from "commander";
import {
  readCursorWindow,
  recordCursorHook,
} from "../watcher/collectors/cursor";

const MAX_HOOK_BYTES = 8 * 1024 * 1024;

async function readHookInput(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  // Bun's native stream also reads redirected regular-file stdin on Linux.
  const reader = Bun.stdin.stream().getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > MAX_HOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
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
    .option("--event-log <path>", "recorder destination")
    .option("--window-file <path>", "collection window")
    .action(async (flags: { eventLog?: string; windowFile?: string }) => {
      const input = await readHookInput();
      if (input !== null) {
        recordCursorHook(
          input,
          flags.eventLog,
          Date.now(),
          readCursorWindow(flags.windowFile)
        );
      }
    });
}
