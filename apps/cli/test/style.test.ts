import { describe, expect, test } from "bun:test";
import { shouldUseColor } from "../src/lib/style";

describe("terminal color", () => {
  for (const value of ["0", "false", "FALSE"]) {
    test(`FORCE_COLOR=${value} disables color even on a TTY`, () => {
      expect(shouldUseColor(value, true)).toBe(false);
      expect(shouldUseColor(value, false)).toBe(false);
    });
  }

  for (const value of ["1", "2", "3"]) {
    test(`FORCE_COLOR=${value} enables color without a TTY`, () => {
      expect(shouldUseColor(value, false)).toBe(true);
    });
  }

  test("without FORCE_COLOR, color follows TTY detection", () => {
    expect(shouldUseColor(undefined, true)).toBe(true);
    expect(shouldUseColor(undefined, false)).toBe(false);
  });

  test("NO_COLOR and a dumb terminal override FORCE_COLOR", () => {
    expect(shouldUseColor("3", true, "1")).toBe(false);
    expect(shouldUseColor("3", true, undefined, "dumb")).toBe(false);
  });
});
