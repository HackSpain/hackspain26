import { describe, expect, test } from "bun:test";
import { nationalNumberError, normalizePhone, splitPhone } from "./phone";

describe("normalizePhone", () => {
  test("keeps a prefixed number as E.164", () => {
    expect(normalizePhone("+34 600 111 222")).toBe("+34600111222");
    expect(normalizePhone("0034 600-111-222")).toBe("+34600111222");
    expect(normalizePhone("+351 912 345 678")).toBe("+351912345678");
    expect(normalizePhone("+1 (415) 555-0132")).toBe("+14155550132");
  });

  test("assumes Spain only for a bare Spanish number", () => {
    expect(normalizePhone("600111222")).toBe("+34600111222");
    expect(normalizePhone("912 345 678")).toBe("+34912345678");
    expect(normalizePhone("123456789")).toBeNull();
    expect(normalizePhone("4155550132")).toBeNull();
  });

  test("rejects a wrong length for a known prefix", () => {
    expect(normalizePhone("+34 600 111")).toBeNull();
    expect(normalizePhone("+34 6001112223")).toBeNull();
    expect(normalizePhone("+34 100111222")).toBeNull();
    expect(normalizePhone("+44 7700 900")).toBeNull();
  });

  test("stays loose for a prefix we do not list", () => {
    expect(normalizePhone("+81 90 1234 5678")).toBe("+819012345678");
    expect(normalizePhone("+81 12")).toBeNull();
  });

  test("rejects garbage", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("hola")).toBeNull();
    expect(normalizePhone("+")).toBeNull();
  });
});

describe("splitPhone", () => {
  test("prefers the longest matching prefix", () => {
    expect(splitPhone("+351912345678")).toEqual({ code: "351", national: "912345678" });
    expect(splitPhone("+34600111222")).toEqual({ code: "34", national: "600111222" });
    expect(splitPhone("+819012345678")).toBeNull();
  });
});

describe("nationalNumberError", () => {
  test("explains what is wrong", () => {
    expect(nationalNumberError("34", "")).toBe("Escribe tu número.");
    expect(nationalNumberError("34", "60011122")).toContain("9 cifras");
    expect(nationalNumberError("34", "100111222")).toContain("no empieza por 1");
    expect(nationalNumberError("49", "1234")).toContain("entre 7 y 12");
    expect(nationalNumberError("34", "600 111 222")).toBeNull();
  });
});
