import { describe, expect, test } from "bun:test";
import { WORDMARK_WIDTH, wordmarkRows } from "../src/lib/banner";

describe("wordmark", () => {
  test("every row has the same width and fits an 80-column terminal", () => {
    const rows = wordmarkRows();
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect([...row]).toHaveLength(WORDMARK_WIDTH);
    }
    expect(WORDMARK_WIDTH).toBeLessThanOrEqual(78);
  });

  test("uses only box-drawing cells, no tabs or stray characters", () => {
    for (const row of wordmarkRows()) {
      expect(row).toMatch(/^[█╗║╔═╝╚ ]+$/u);
    }
  });
});
