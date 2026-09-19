import { describe, expect, test } from "bun:test";
import { safeNextPath } from "./cli-handoff";

describe("safeNextPath", () => {
  test("keeps same-origin dashboard paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/feed")).toBe("/feed");
    expect(safeNextPath("/admin/tracks?tab=2#x")).toBe("/admin/tracks?tab=2#x");
  });

  test("falls back to home for anything that could leave the origin", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("feed")).toBe("/");
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("//evil.example/")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/");
  });
});
