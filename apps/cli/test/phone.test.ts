import { describe, expect, test } from "bun:test";
import { formatPhone, validatePhone } from "../src/lib/phone";

describe("validatePhone", () => {
  test("accepts numbers with a country code", () => {
    expect(validatePhone("+34 600 111 222")).toBeUndefined();
    expect(validatePhone("0034600111222")).toBeUndefined();
    expect(validatePhone("+1 (415) 555-0132")).toBeUndefined();
    expect(validatePhone("+81 90 1234 5678")).toBeUndefined();
  });

  test("accepts a bare Spanish number, nothing else without a code", () => {
    expect(validatePhone("600111222")).toBeUndefined();
    expect(validatePhone("4155550132")).toBe(
      "Start with your country code, like +34 600 111 222."
    );
  });

  test("explains a wrong length or leading digit", () => {
    expect(validatePhone("+34 600 111")).toBe("A +34 number has 9 digits.");
    expect(validatePhone("+34 100 111 222")).toBe(
      "A +34 number does not start with 1."
    );
    expect(validatePhone("+49 1234")).toBe("A +49 number has 7 to 12 digits.");
    expect(validatePhone("+34")).toBe("Add the number after the country code.");
    expect(validatePhone("+81 12")).toBe(
      "That does not look like a phone number."
    );
    expect(validatePhone("   ")).toBe("Enter your number.");
  });
});

describe("formatPhone", () => {
  test("returns E.164", () => {
    expect(formatPhone("+34 600-111-222")).toBe("+34600111222");
    expect(formatPhone("600111222")).toBe("+34600111222");
  });
});
