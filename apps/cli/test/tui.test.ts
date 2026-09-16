import { describe, expect, test } from "bun:test";
import { stripAnsi, width } from "../src/lib/style";
import { cardWidth, formatPickBox, parsePickKey } from "../src/lib/tui";

describe("cardWidth", () => {
  test("fills the terminal minus the card inset", () => {
    expect(cardWidth(80)).toBe(76);
    expect(cardWidth(20)).toBe(40);
  });
});

describe("formatPickBox", () => {
  test("is a watcher card: gold title, cursor, hints, key line", () => {
    const lines = formatPickBox(
      "menu",
      [
        { value: "watch", label: "Start the watcher", hint: "takes over" },
        { value: "exit", label: "Exit" },
      ],
      0,
      40
    );
    expect(lines).toHaveLength(5);
    for (const line of lines.slice(0, 4)) {
      expect(width(line)).toBe(40);
    }
    const text = stripAnsi(lines.join("\n"));
    expect(text).toContain("menu");
    expect(text).toContain("▸");
    expect(text).toContain("Start the watcher");
    expect(text).toContain("takes over");
    expect(text).toContain("Exit");
    expect(stripAnsi(lines.at(-1) ?? "")).toContain("↑↓");
    expect(stripAnsi(lines.at(-1) ?? "")).toContain("q");
  });
});

describe("parsePickKey", () => {
  test("arrows, vim, enter and cancel", () => {
    expect(parsePickKey("\x1b[A")).toBe("up");
    expect(parsePickKey("k")).toBe("up");
    expect(parsePickKey("\x1b[B")).toBe("down");
    expect(parsePickKey("j")).toBe("down");
    expect(parsePickKey("\r")).toBe("enter");
    expect(parsePickKey("q")).toBe("cancel");
    expect(parsePickKey("\x1b")).toBe("cancel");
    expect(parsePickKey("\u0003")).toBe("cancel");
    expect(parsePickKey("x")).toBe("ignore");
  });
});
