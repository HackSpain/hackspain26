import type { TelemetryEvent } from "./schema";
import type { Sink } from "./sinks/spool";

export const BATCH_MAX = 200;
export const BUFFER_CAP = 5000;
const BACKOFF_MIN_MS = 5000;
const BACKOFF_MAX_MS = 60_000;

export type Batcher = {
  push(event: TelemetryEvent): void;
  /** Write what is buffered to every sink. Returns true when everything went through. */
  flush(): Promise<boolean>;
  size(): number;
  dropped(): number;
};

/**
 * Buffers events and writes them to all sinks in batches. A failing sink keeps
 * its events for the next attempt (with backoff); the buffer is capped so a
 * dead endpoint cannot grow memory without bound.
 */
export function createBatcher(
  sinks: Sink[],
  log: (message: string) => void,
  now: () => number = Date.now
): Batcher {
  const pending = new Map<string, TelemetryEvent[]>(
    sinks.map((s) => [s.name, []])
  );
  const notBefore = new Map<string, number>();
  const backoff = new Map<string, number>();
  let dropped = 0;

  return {
    push: (event) => {
      for (const sink of sinks) {
        const queue = pending.get(sink.name) ?? [];
        queue.push(event);
        if (queue.length > BUFFER_CAP) {
          queue.splice(0, queue.length - BUFFER_CAP);
          dropped++;
        }
        pending.set(sink.name, queue);
      }
    },
    flush: async () => {
      let allOk = true;
      for (const sink of sinks) {
        const queue = pending.get(sink.name) ?? [];
        if (queue.length === 0) {
          continue;
        }
        if ((notBefore.get(sink.name) ?? 0) > now()) {
          allOk = false;
          continue;
        }
        while (queue.length > 0) {
          const batch = queue.slice(0, BATCH_MAX);
          try {
            await sink.write(batch);
            queue.splice(0, batch.length);
            backoff.delete(sink.name);
            notBefore.delete(sink.name);
          } catch (err) {
            const wait = Math.min(
              BACKOFF_MAX_MS,
              (backoff.get(sink.name) ?? BACKOFF_MIN_MS / 2) * 2
            );
            backoff.set(sink.name, wait);
            notBefore.set(sink.name, now() + wait);
            log(
              `${sink.name}: ${String(err)} (retry in ${Math.round(wait / 1000)}s, ${queue.length} queued)`
            );
            allOk = false;
            break;
          }
        }
      }
      return allOk;
    },
    size: () => Math.max(...[...pending.values()].map((q) => q.length), 0),
    dropped: () => dropped,
  };
}
