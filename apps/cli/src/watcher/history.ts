import type { RawEvent, TelemetryEvent } from "./schema";
import { validateEvent } from "./schema";
import type { Collector } from "./types";

/** Replay the local spool too: source files may be gone or collected with --no-upload. */
export function historyCollectors(
  history: Iterable<TelemetryEvent>,
  userId: string
): Collector[] {
  const byHarness = new Map<RawEvent["harness"], RawEvent[]>();
  for (const event of history) {
    if (validateEvent(event).length > 0 || event.identity.userId !== userId) {
      continue;
    }
    const events = byHarness.get(event.harness) ?? [];
    events.push({
      eventId: event.eventId,
      harness: event.harness,
      harnessVersion: event.harnessVersion,
      occurredAt: event.occurredAt,
      project: event.project,
      sessionId: event.sessionId,
      type: event.type,
      model: event.model,
      tokens: event.tokens,
      native: event.native?.requestId
        ? { requestId: event.native.requestId }
        : undefined,
      costUsd: event.native?.costUsd,
    });
    byHarness.set(event.harness, events);
  }
  return [...byHarness].map(([id, events]) => ({
    id,
    discover: () => Promise.resolve(["local-spool"]),
    async *collect() {
      for (const event of events) {
        yield event;
      }
      await Promise.resolve();
    },
  }));
}
