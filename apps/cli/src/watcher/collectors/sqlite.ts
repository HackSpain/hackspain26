import { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function openReadOnly(path: string): Database {
  let db: Database | undefined;
  try {
    db = new Database(path, { readonly: true });
    db.query("PRAGMA schema_version").get();
    return db;
  } catch (error) {
    db?.close();
    // macOS cannot reopen a WAL database whose sidecars are gone, while Linux
    // rejects Bun's immutable URI. Never use immutable when a real WAL exists.
    if (existsSync(`${path}-wal`)) {
      throw error;
    }
    return new Database(`${pathToFileURL(path).href}?immutable=1`, {
      readonly: true,
    });
  }
}

export function lastWriteMs(path: string): number {
  const wal = `${path}-wal`;
  return Math.max(
    statSync(path).mtimeMs,
    existsSync(wal) ? statSync(wal).mtimeMs : 0
  );
}
