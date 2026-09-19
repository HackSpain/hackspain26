import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Collector } from "../types";
import { collectOpenCode } from "./opencode";

export const KILO_CODE = "kilo-code" as const;

/**
 * Kilo Code is built on OpenCode and keeps the same SQLite `message` table,
 * so the OpenCode reader does the work. The database lives in the XDG data
 * dir under `kilo/`: `kilo.db` for release builds, `kilo-<channel>.db` for
 * other channels, with older `opencode-<channel>.db` files still possible.
 * Written from the source, not verified against a local install.
 */
const DB_NAME = /^(kilo|opencode)(-[A-Za-z0-9._-]+)?\.db$/;

export function kiloDataDir(): string {
  const data =
    process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share");
  return join(data, "kilo");
}

function releaseFirst(a: string, b: string): number {
  if (a === "kilo.db") {
    return -1;
  }
  if (b === "kilo.db") {
    return 1;
  }
  return a.localeCompare(b);
}

/** Every Kilo database present, release build first, then by name. */
export function kiloDbPaths(dir = kiloDataDir()): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => DB_NAME.test(name))
    .toSorted(releaseFirst)
    .map((name) => join(dir, name));
}

export const kiloCodeCollector: Collector = {
  collect: (ctx) => collectOpenCode(kiloDbPaths(), ctx, KILO_CODE),
  discover: () => Promise.resolve(kiloDbPaths()),
  id: KILO_CODE,
};
