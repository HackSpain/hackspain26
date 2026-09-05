import { join } from "node:path";
import { readJsonFile, stateDir, writeFileAtomic } from "../lib/config";
import type { CursorStore, FileCursor } from "./types";

type Persisted = { version: 1; files: Record<string, FileCursor> };

export function cursorsPath(): string {
  return join(stateDir(), "cursors.json");
}

export function openCursorStore(path = cursorsPath()): CursorStore {
  const loaded = readJsonFile<Persisted>(path);
  const files: Record<string, FileCursor> =
    loaded?.version === 1 ? { ...loaded.files } : {};
  let dirty = false;
  return {
    get: (file) => files[file],
    set: (file, cursor) => {
      files[file] = cursor;
      dirty = true;
    },
    save: () => {
      if (!dirty) {
        return;
      }
      const data: Persisted = { version: 1, files };
      writeFileAtomic(path, `${JSON.stringify(data)}\n`, 0o600);
      dirty = false;
    },
  };
}

/** In-memory store for tests and `--once --dry-run`. */
export function memoryCursorStore(): CursorStore {
  const files: Record<string, FileCursor> = {};
  return {
    get: (file) => files[file],
    set: (file, cursor) => {
      files[file] = cursor;
    },
    save: () => undefined,
  };
}
