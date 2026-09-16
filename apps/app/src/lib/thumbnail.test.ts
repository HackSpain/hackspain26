import { describe, expect, test } from "bun:test";
import { parseThumbnailWidth } from "./thumbnail";

describe("parseThumbnailWidth", () => {
  test("absent or malformed means the original file", () => {
    expect(parseThumbnailWidth(null)).toBeNull();
    expect(parseThumbnailWidth("")).toBeNull();
    expect(parseThumbnailWidth("abc")).toBeNull();
    expect(parseThumbnailWidth("-5")).toBeNull();
    expect(parseThumbnailWidth("1.5")).toBeNull();
    expect(parseThumbnailWidth("99999")).toBeNull();
  });

  test("clamps into the allowed range", () => {
    expect(parseThumbnailWidth("480")).toBe(480);
    expect(parseThumbnailWidth("1")).toBe(16);
    expect(parseThumbnailWidth("4000")).toBe(1024);
  });
});
