import { describe, expect, test } from "bun:test";
import {
  legacyParticipationStatus,
  participationIsAccepted,
  participationIsRegistered,
} from "./participations";

describe("participation status", () => {
  test("interested is not registered; applied and later are", () => {
    expect(participationIsRegistered("interested")).toBe(false);
    expect(participationIsRegistered("applied")).toBe(true);
    expect(participationIsRegistered("waitlist")).toBe(true);
    expect(participationIsRegistered("rejected")).toBe(true);
    expect(participationIsRegistered("accepted")).toBe(true);
  });

  test("accepted, confirmed and cancelled count as accepted", () => {
    expect(participationIsAccepted("applied")).toBe(false);
    expect(participationIsAccepted("waitlist")).toBe(false);
    expect(participationIsAccepted("rejected")).toBe(false);
    expect(participationIsAccepted("accepted")).toBe(true);
    expect(participationIsAccepted("confirmed")).toBe(true);
    expect(participationIsAccepted("cancelled")).toBe(true);
  });

  test("legacy 2026 mapping keeps applicants, staff and cancellations", () => {
    expect(
      legacyParticipationStatus({
        accepted: false,
        hasSignup: true,
        onboarded: false,
        staffWithoutSignup: false,
      })
    ).toBe("applied");
    expect(
      legacyParticipationStatus({
        accepted: true,
        hasSignup: true,
        onboarded: false,
        staffWithoutSignup: false,
      })
    ).toBe("accepted");
    expect(
      legacyParticipationStatus({
        accepted: true,
        hasSignup: true,
        onboarded: true,
        staffWithoutSignup: false,
      })
    ).toBe("confirmed");
    expect(
      legacyParticipationStatus({
        accepted: true,
        attendanceStatus: "cancelled",
        hasSignup: true,
        onboarded: true,
        staffWithoutSignup: false,
      })
    ).toBe("cancelled");
    expect(
      legacyParticipationStatus({
        accepted: false,
        hasSignup: false,
        onboarded: false,
        staffWithoutSignup: true,
      })
    ).toBe("accepted");
  });
});
