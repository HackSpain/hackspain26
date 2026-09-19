import { expect, test } from "bun:test";
import { TELEMETRY_STARTS_AT, telemetryWindow } from "./window";

test("telemetry starts at 17:00 Madrid regardless of the official opening", () => {
  const endsAt = Date.parse("2026-09-20T16:00:00Z");
  for (const startsAt of [
    TELEMETRY_STARTS_AT - 3_600_000,
    Date.parse("2026-09-18T16:45:00Z"),
  ]) {
    expect(telemetryWindow({ startsAt, endsAt })).toEqual({
      startsAt: Date.parse("2026-09-18T15:00:00Z"),
      endsAt,
    });
  }
});

test("a missing schedule or invalid end never enables collection", () => {
  for (const event of [
    {},
    { startsAt: 1 },
    { endsAt: Infinity },
    { startsAt: 1, endsAt: Number.NaN },
    { startsAt: 1, endsAt: TELEMETRY_STARTS_AT },
  ]) {
    expect(telemetryWindow(event)).toBeNull();
  }
});
