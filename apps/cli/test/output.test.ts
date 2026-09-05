import { describe, expect, test } from "bun:test";
import { renderTable } from "../src/lib/output";

describe("renderTable", () => {
  test("pads columns and underlines the header", () => {
    const out = renderTable(
      [
        ["Tortilla", "4"],
        ["Ñ", "12"],
      ],
      ["Team", "Members"]
    );
    expect(out.split("\n")).toEqual([
      "Team      Members",
      "────────  ───────",
      "Tortilla  4",
      "Ñ         12",
    ]);
  });

  test("handles empty input", () => {
    expect(renderTable([])).toBe("");
  });
});
