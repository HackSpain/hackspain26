/** Collection follows the configured event schedule for every account. */
export function telemetryWindow(event: { startsAt?: number; endsAt?: number }): {
  startsAt: number;
  endsAt: number;
} | null {
  if (
    event.startsAt === undefined ||
    event.endsAt === undefined ||
    !Number.isFinite(event.startsAt) ||
    !Number.isFinite(event.endsAt) ||
    event.endsAt <= event.startsAt
  ) {
    return null;
  }
  return { startsAt: event.startsAt, endsAt: event.endsAt };
}
