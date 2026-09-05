import {
  appendFileSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { ensureDir, stateDir } from "../../lib/config";
import type { TelemetryEvent } from "../schema";

export type Sink = {
  name: string;
  write(events: TelemetryEvent[]): Promise<void>;
};

export const SPOOL_CAP_BYTES = 50 * 1024 * 1024;

export function spoolDir(): string {
  return join(stateDir(), "telemetry");
}

function dayFile(dir: string, now: Date): string {
  return join(dir, `${now.toISOString().slice(0, 10)}.ndjson`);
}

/** Delete the oldest day files until the directory is under the cap. */
export function enforceCap(dir: string, cap = SPOOL_CAP_BYTES): void {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".ndjson"))
    .map((name) => {
      const path = join(dir, name);
      return { path, size: statSync(path).size };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  let total = files.reduce((sum, f) => sum + f.size, 0);
  // Never delete the newest file: it is the one being written.
  for (const file of files.slice(0, -1)) {
    if (total <= cap) {
      break;
    }
    unlinkSync(file.path);
    total -= file.size;
  }
}

/**
 * Local source of truth: one canonical event per line, one file per day.
 * Always on, so nothing is lost while the remote store is undecided.
 */
export function spoolSink(dir = spoolDir(), cap = SPOOL_CAP_BYTES): Sink {
  ensureDir(dir, 0o700);
  return {
    name: "spool",
    write: async (events) => {
      if (events.length === 0) {
        return;
      }
      const path = dayFile(dir, new Date());
      appendFileSync(
        path,
        `${events.map((e) => JSON.stringify(e)).join("\n")}\n`,
        {
          mode: 0o600,
        }
      );
      enforceCap(dir, cap);
      await Promise.resolve();
    },
  };
}

export function* readSpool(dir = spoolDir()): Iterable<TelemetryEvent> {
  let names: string[];
  try {
    names = readdirSync(dir)
      .filter((name) => name.endsWith(".ndjson"))
      .sort();
  } catch {
    return;
  }
  for (const name of names) {
    const text = readFileSync(join(dir, name), "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        yield JSON.parse(line) as TelemetryEvent;
      } catch {
        // A torn last line from a crash; skip it.
      }
    }
  }
}
