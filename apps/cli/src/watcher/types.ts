import type { HarnessId, RawEvent } from "./schema";

/** Persisted per file so restarts continue where they left off. */
export type FileCursor = {
  offset: number;
  inode?: number;
  mtimeMs: number;
  /** Session ids already announced with session.start. */
  seenSessions?: string[];
  /** Harness-specific watermark (e.g. last `ts` for rewritten JSON files). */
  mark?: string | number;
};

export type CursorStore = {
  get(path: string): FileCursor | undefined;
  set(path: string, cursor: FileCursor): void;
  /** Persist to disk. Called after a successful flush, not before. */
  save(): void;
};

export type CollectorContext = {
  cursors: CursorStore;
  /** Ignore events that occurred before this time (epoch ms). */
  since: number;
  log: (message: string) => void;
};

export type Collector = {
  id: HarnessId;
  /** Directories that exist on this machine and should be scanned. */
  discover(): Promise<string[]>;
  /**
   * Read everything new since the stored cursors and yield canonical events.
   * Must never throw for a malformed file; log and skip instead.
   */
  collect(ctx: CollectorContext): AsyncIterable<RawEvent>;
};
