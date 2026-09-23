import { describe, expect, test } from "bun:test";
import { terminalSafe, terminalText } from "../src/lib/style";
import { RLO } from "./recording-ui";

describe("terminalText", () => {
  test("drops every terminal instruction a remote string can carry", () => {
    const cases: [string, string][] = [
      ["Ana\u001B]52;c;ZXZpbA==\u0007", "Ana"],
      ["\u001B]8;;https://evil.example\u0007link\u001B]8;;\u0007", "link"],
      ["Quijote\u001B[2J Labs", "Quijote Labs"],
      ["safe\u001BPignored\u001B\\ text", "safe text"],
      ["image\rforged", "imageforged"],
      [`left${RLO}right`, "leftright"],
      ["c1\u009B2Jcontrol", "c1control"],
      ["bell\u0007 and\u0000 nul", "bell and nul"],
    ];
    for (const [hostile, visible] of cases) {
      expect(terminalText(hostile)).toBe(visible);
    }
  });

  test("keeps the line feeds and tabs the renderers rely on", () => {
    expect(terminalText("first\nsecond\tcell")).toBe("first\nsecond\tcell");
  });
});

describe("terminalSafe", () => {
  test("returns the same shape with every string cleaned, without touching the input", () => {
    const raw = {
      _id: "team_01HX",
      count: 3,
      members: [
        { email: null, name: "Ana\u001B]52;c;ZXZpbA==\u0007" },
        { email: "b@example.com\r", name: undefined },
      ],
      name: "Quijote\u001B[2J Labs",
      submitted: false,
      tags: [`Next.js${RLO}`, "Convex"],
    };
    const safe = terminalSafe(raw);
    expect(safe).toEqual({
      _id: "team_01HX",
      count: 3,
      members: [
        { email: null, name: "Ana" },
        { email: "b@example.com", name: undefined },
      ],
      name: "Quijote Labs",
      submitted: false,
      tags: ["Next.js", "Convex"],
    });
    expect(safe).not.toBe(raw);
    expect(raw.name).toBe("Quijote\u001B[2J Labs");
    expect(raw.members[0]?.name).toBe("Ana\u001B]52;c;ZXZpbA==\u0007");
  });

  test("passes null and primitives through", () => {
    expect(terminalSafe(null)).toBeNull();
    expect(terminalSafe(42)).toBe(42);
    expect(terminalSafe("x\u001B[2J")).toBe("x");
  });
});
