import { describe, expect, test } from "bun:test";
import { banner, WORDMARK_WIDTH, wordmarkRows } from "../src/lib/banner";
import { stripAnsi } from "../src/lib/style";

const ESC = String.fromCodePoint(27);

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

describe("banner", () => {
  test("draws the real logo where the terminal can, replacing the last copy", () => {
    const out = banner("tag", { columns: 100, protocol: "kitty" });
    expect(out).toContain(`${ESC}_Ga=d,d=i,i=9001,q=2`);
    expect(out).toContain("_Ga=T,f=100,c=36,r=6,i=9001,q=2");
    expect(out).not.toContain("█");
    expect(stripAnsi(out).endsWith("tag")).toBe(true);
  });

  test("shrinks the picture on narrow terminals and gives up below 24 columns", () => {
    expect(banner("tag", { columns: 30, protocol: "iterm" })).toContain(
      "width=28;height=5;"
    );
    const tiny = banner("tag", { columns: 20, protocol: "iterm" });
    expect(tiny).not.toContain("1337");
    expect(stripAnsi(tiny)).toContain("hackspain");
  });

  test("text terminals keep the block letters, narrow ones the small mark", () => {
    expect(banner("tag", { columns: 100, protocol: null })).toContain("█");
    const small = banner("tag", { columns: 60, protocol: null });
    expect(small).not.toContain("█");
    expect(stripAnsi(small)).toContain("hackspain");
  });
});
