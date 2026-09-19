import { closeSync, openSync, readSync, statSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
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
    inode: stat.ino,
    mark: rotated ? undefined : previous?.mark,
    mtimeMs: stat.mtimeMs,
    offset,
    seenSessions: rotated ? [] : previous?.seenSessions,
  };
  if (stat.size <= offset) {
    return { cursor, lines: [] };
  }

  const lines: string[] = [];
  const buffer = Buffer.alloc(Math.min(CHUNK, stat.size - offset));
  const decoder = new StringDecoder("utf8");
  let fragments: string[] = [];
  const fd = openSync(path, "r");
  try {
    let remaining = stat.size - offset;
    while (remaining > 0) {
      const read = readSync(
        fd,
        buffer,
        0,
        Math.min(buffer.length, remaining),
        offset
      );
      if (read <= 0) {
        break;
      }
      const chunk = buffer.subarray(0, read);
      const text = decoder.write(chunk);
      let start = 0;
      for (
        let end = text.indexOf("\n");
        end !== -1;
        end = text.indexOf("\n", start)
      ) {
        const part = text.slice(start, end);
        const line = fragments.length ? fragments.join("") + part : part;
        fragments = [];
        if (line.trim().length > 0) {
          lines.push(line);
        }
        start = end + 1;
      }
      if (start < text.length) {
        fragments.push(text.slice(start));
      }
      // Byte offsets must follow the file, including invalid UTF-8 bytes.
      const lastNewline = chunk.lastIndexOf(10);
      if (lastNewline !== -1) {
        cursor.offset = offset + lastNewline + 1;
      }
      offset += read;
      remaining -= read;
    }
  } finally {
    closeSync(fd);
  }
  return { cursor, lines };
}

export function parseJsonLine(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
