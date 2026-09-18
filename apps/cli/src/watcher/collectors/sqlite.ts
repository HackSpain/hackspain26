import { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * A WAL database without its `-wal` file cannot be opened read-only, only as
 * immutable.
 */
export function openReadOnly(path: string): Database {
  const location = existsSync(`${path}-wal`)
    ? path
    : `${pathToFileURL(path).href}?immutable=1`;
  return new Database(location, { readonly: true });
}

export function lastWriteMs(path: string): number {
  const wal = `${path}-wal`;
  return Math.max(
    statSync(path).mtimeMs,
    existsSync(wal) ? statSync(wal).mtimeMs : 0
  );
}
