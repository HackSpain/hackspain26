/** HackSpain 2026 usage starts Friday at 17:00 Europe/Madrid (UTC+02:00). */
export const TELEMETRY_STARTS_AT = Date.parse("2026-09-18T15:00:00.000Z");

/** Collection has its own start; event access gates keep the admin schedule. */
export function telemetryWindow(event: { startsAt?: number; endsAt?: number }): {
  startsAt: number;
  endsAt: number;
} | null {
  if (
    event.startsAt === undefined ||
    event.endsAt === undefined ||
    !Number.isFinite(event.endsAt) ||
    event.endsAt <= TELEMETRY_STARTS_AT
  ) {
    return null;
  }
  return { startsAt: TELEMETRY_STARTS_AT, endsAt: event.endsAt };
}
