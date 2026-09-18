import { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";

/**
 * A WAL database whose writer has gone leaves no `-wal` file, and then a
 * read-only open fails because SQLite cannot create the shared-memory
 * index; `immutable=1` reads the main file as it is instead.
 */
export function openReadOnly(path: string): Database {
  const location = existsSync(`${path}-wal`)
    ? path
    : `file:${path.split("/").map(encodeURIComponent).join("/")}?immutable=1`;
  return new Database(location, { readonly: true });
}

/** When the database last changed, counting the WAL when there is one. */
export function lastWriteMs(path: string): number {
  const wal = `${path}-wal`;
  return Math.max(
    statSync(path).mtimeMs,
    existsSync(wal) ? statSync(wal).mtimeMs : 0
  );
}
