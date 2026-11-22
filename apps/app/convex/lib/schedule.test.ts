import { describe, expect, test } from "bun:test";
import {
  applicationsStatus,
  checkInIsOpen,
  submissionsAreOpenFor,
} from "./schedule";

const NOW = 1_000_000;

function schedule(
  extra: Partial<Parameters<typeof applicationsStatus>[0]> = {}
) {
  return {
    submissionsOpen: false,
    ...extra,
  };
}

describe("applicationsStatus", () => {
  test("unscheduled auto is closed", () => {
    expect(applicationsStatus(schedule(), NOW)).toBe("closed");
  });

  test("overrides ignore the calendar", () => {
    expect(
      applicationsStatus(
        schedule({
          applicationsMode: "open",
          applicationsClosesAt: NOW - 1,
        }),
        NOW
      )
    ).toBe("open");
    expect(
      applicationsStatus(schedule({ applicationsMode: "waitlist" }), NOW)
    ).toBe("waitlist");
    expect(
      applicationsStatus(
        schedule({
          applicationsMode: "closed",
          applicationsOpensAt: NOW - 1,
        }),
        NOW
      )
    ).toBe("closed");
  });

  test("auto follows open, waitlist and close", () => {
    expect(
      applicationsStatus(
        schedule({
          applicationsOpensAt: NOW + 1,
          applicationsWaitlistFrom: NOW + 2,
          applicationsClosesAt: NOW + 3,
        }),
        NOW
      )
    ).toBe("closed");
    expect(
      applicationsStatus(
        schedule({
          applicationsOpensAt: NOW - 1,
          applicationsWaitlistFrom: NOW + 1,
          applicationsClosesAt: NOW + 2,
        }),
        NOW
      )
    ).toBe("open");
    expect(
      applicationsStatus(
        schedule({
          applicationsOpensAt: NOW - 2,
          applicationsWaitlistFrom: NOW - 1,
          applicationsClosesAt: NOW + 1,
        }),
        NOW
      )
    ).toBe("waitlist");
    expect(
      applicationsStatus(
        schedule({
          applicationsOpensAt: NOW - 3,
          applicationsWaitlistFrom: NOW - 2,
          applicationsClosesAt: NOW,
        }),
        NOW
      )
    ).toBe("closed");
  });
});

describe("submissionsAreOpenFor", () => {
  test("unset mode keeps the stored boolean", () => {
    expect(
      submissionsAreOpenFor(schedule({ submissionsOpen: true }), NOW)
    ).toBe(true);
    expect(
      submissionsAreOpenFor(schedule({ submissionsOpen: false }), NOW)
    ).toBe(false);
  });

  test("on and off override dates", () => {
    expect(
      submissionsAreOpenFor(
        schedule({ submissionsMode: "on", submitClosesAt: NOW - 1 }),
        NOW
      )
    ).toBe(true);
    expect(
      submissionsAreOpenFor(
        schedule({ submissionsMode: "off", submitOpensAt: NOW - 1 }),
        NOW
      )
    ).toBe(false);
  });

  test("auto uses the submit window; empty is closed", () => {
    expect(
      submissionsAreOpenFor(schedule({ submissionsMode: "auto" }), NOW)
    ).toBe(false);
    expect(
      submissionsAreOpenFor(
        schedule({
          submissionsMode: "auto",
          submitOpensAt: NOW - 1,
          submitClosesAt: NOW + 1,
        }),
        NOW
      )
    ).toBe(true);
    expect(
      submissionsAreOpenFor(
        schedule({
          submissionsMode: "auto",
          submitOpensAt: NOW + 1,
        }),
        NOW
      )
    ).toBe(false);
  });
});

describe("checkInIsOpen", () => {
  test("unset is allowed", () => {
    expect(checkInIsOpen(schedule(), NOW)).toBe(true);
  });

  test("refuses before the opening time", () => {
    expect(checkInIsOpen(schedule({ checkInOpensAt: NOW + 1 }), NOW)).toBe(
      false
    );
    expect(checkInIsOpen(schedule({ checkInOpensAt: NOW }), NOW)).toBe(true);
  });
});
