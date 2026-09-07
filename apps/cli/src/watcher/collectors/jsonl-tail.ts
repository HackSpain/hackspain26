import { closeSync, openSync, readSync, statSync } from "node:fs";
import type { CursorStore, FileCursor } from "../types";

const CHUNK = 64 * 1024;

export type TailResult = {
  lines: string[];
  cursor: FileCursor;
};

/**
 * Read complete lines appended since the stored cursor. A shrunken file or a
 * new inode means rotation, so reading restarts from zero. The trailing
 * partial line (still being written) is left for the next call.
 */
export function tailJsonl(path: string, cursors: CursorStore): TailResult {
  const stat = statSync(path);
  const previous = cursors.get(path);
  const rotated =
    previous !== undefined &&
    ((previous.inode !== undefined && previous.inode !== stat.ino) ||
      stat.size < previous.offset);
  let offset = rotated || previous === undefined ? 0 : previous.offset;
  const cursor: FileCursor = {
    offset,
    inode: stat.ino,
    mtimeMs: stat.mtimeMs,
    seenSessions: rotated ? [] : previous?.seenSessions,
    mark: rotated ? undefined : previous?.mark,
  };
  if (stat.size <= offset) {
    return { lines: [], cursor };
  }

  const fd = openSync(path, "r");
  const chunks: Buffer[] = [];
  try {
    let remaining = stat.size - offset;
    while (remaining > 0) {
      const buf = Buffer.alloc(Math.min(CHUNK, remaining));
      const read = readSync(fd, buf, 0, buf.length, offset);
      if (read <= 0) {
        break;
      }
      chunks.push(buf.subarray(0, read));
      offset += read;
      remaining -= read;
    }
  } finally {
    closeSync(fd);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline === -1) {
    return { lines: [], cursor };
  }
  const complete = text.slice(0, lastNewline);
  const consumedBytes = Buffer.byteLength(complete, "utf8") + 1;
  cursor.offset += consumedBytes;
  const lines = complete.split("\n").filter((line) => line.trim().length > 0);
  return { lines, cursor };
}

export function parseJsonLine(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
