import { expect, test } from "bun:test";
import { telemetryWindow } from "./window";

test("telemetry follows the configured event opening, including schedule changes", () => {
  const endsAt = Date.parse("2026-09-20T16:00:00Z");
  for (const startsAt of [
    Date.parse("2026-09-18T15:00:00Z"),
    Date.parse("2026-09-18T16:45:00Z"),
    Date.parse("2026-09-19T09:00:00Z"),
  ]) {
    expect(telemetryWindow({ startsAt, endsAt })).toEqual({ startsAt, endsAt });
  }
});

test("a missing or invalid schedule never enables collection", () => {
  for (const event of [
    {},
    { startsAt: 1 },
    { endsAt: 2 },
    { startsAt: Number.NaN, endsAt: 2 },
    { startsAt: Infinity, endsAt: 2 },
    { startsAt: 1, endsAt: Number.NaN },
    { startsAt: 1, endsAt: Infinity },
    { startsAt: 1, endsAt: 1 },
    { startsAt: 2, endsAt: 1 },
  ]) {
    expect(telemetryWindow(event)).toBeNull();
  }
});
