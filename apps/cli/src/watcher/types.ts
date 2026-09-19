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
  /**
   * Make sure the cursors cover everything from `since` on. Collectors skip
   * lines older than the run's `since` and still move the cursor past them,
   * so an earlier `since` than the one the cursors were built with means
   * those lines must be read again. Returns true when it started over.
   */
  coverFrom(since: number): boolean;
};

export type CollectorContext = {
  cursors: CursorStore;
  /** Ignore events that occurred before this time (epoch ms). */
  since: number;
  /** Ignore events that occurred at or after this time (epoch ms). */
  until?: number;
  log: (message: string) => void;
};

export type Collector = {
  id: HarnessId;
  /** One-time setup needed before discovery, such as installing a local hook. */
  prepare?(log: (message: string) => void): Promise<void> | void;
  /** Update integrations that must enforce the same collection window. */
  setWindow?(window: { since: number; until: number } | null): void;
  /** Directories that exist on this machine and should be scanned. */
  discover(): Promise<string[]>;
  /**
   * Read everything new since the stored cursors and yield canonical events.
   * Must never throw for a malformed file; log and skip instead.
   */
  collect(ctx: CollectorContext): AsyncIterable<RawEvent>;
};
