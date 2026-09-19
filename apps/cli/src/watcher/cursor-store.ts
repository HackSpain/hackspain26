import { join } from "node:path";
import { readJsonFile, stateDir, writeFileAtomic } from "../lib/config";
import type { CursorStore, FileCursor } from "./types";

type Persisted = {
  version: 1;
  files: Record<string, FileCursor>;
  /** The earliest `since` these cursors were read with. */
  coveredSince?: number;
};

export function cursorsPath(): string {
  return join(stateDir(), "cursors.json");
}

export function openCursorStore(
  path = cursorsPath(),
  replay = false
): CursorStore {
  const loaded = replay ? null : readJsonFile<Persisted>(path);
  let files: Record<string, FileCursor> =
    loaded?.version === 1 ? { ...loaded.files } : {};
  let coveredSince = loaded?.version === 1 ? loaded.coveredSince : undefined;
  let dirty = replay;
  return {
    coverFrom: (since) => {
      // Stores written before `coveredSince` existed count as not covering.
      const covered = coveredSince !== undefined && coveredSince <= since;
      if (covered) {
        return false;
      }
      const restarted = Object.keys(files).length > 0;
      files = {};
      coveredSince = since;
      dirty = true;
      return restarted;
    },
    get: (file) => files[file],
    save: () => {
      if (!dirty) {
        return;
      }
      const data: Persisted = { version: 1, files, coveredSince };
      writeFileAtomic(path, `${JSON.stringify(data)}\n`, 0o600);
      dirty = false;
    },
    set: (file, cursor) => {
      files[file] = cursor;
      dirty = true;
    },
  };
}

/** In-memory store for tests and `--once --dry-run`. */
export function memoryCursorStore(): CursorStore {
  let files: Record<string, FileCursor> = {};
  let coveredSince: number | undefined;
  return {
    coverFrom: (since) => {
      if (coveredSince !== undefined && coveredSince <= since) {
        return false;
      }
      const restarted = Object.keys(files).length > 0;
      files = {};
      coveredSince = since;
      return restarted;
    },
    get: (file) => files[file],
    save: () => undefined,
    set: (file, cursor) => {
      files[file] = cursor;
    },
  };
}
