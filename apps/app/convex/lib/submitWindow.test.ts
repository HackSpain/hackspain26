import { describe, expect, test } from "bun:test";
import {
  isSubmissionsAccepting,
  SUBMIT_CLOSES_AT_MS,
  submissionsClosedMessage,
} from "./submitWindow";

describe("isSubmissionsAccepting", () => {
  test("closes at 11:05 Madrid even if the admin flag is still on", () => {
    expect(isSubmissionsAccepting(true, SUBMIT_CLOSES_AT_MS - 1)).toBe(true);
    expect(isSubmissionsAccepting(true, SUBMIT_CLOSES_AT_MS)).toBe(false);
    expect(isSubmissionsAccepting(false, SUBMIT_CLOSES_AT_MS - 1)).toBe(false);
  });

  test("names the 11:05 cutoff after it passes", () => {
    expect(submissionsClosedMessage(SUBMIT_CLOSES_AT_MS)).toBe(
      "El plazo de envío cerró a las 11:05."
    );
    expect(submissionsClosedMessage(SUBMIT_CLOSES_AT_MS - 1)).toBe(
      "El envío de proyectos aún no está abierto"
    );
  });
});
