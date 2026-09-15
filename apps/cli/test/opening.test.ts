import { describe, expect, test } from "bun:test";
import {
  formatBootStep,
  formatGreeting,
  formatStatusBoard,
  formatVersionLine,
  openingBoardRows,
  renderOpening,
} from "../src/lib/opening";
import { stripAnsi } from "../src/lib/style";

function lines(text: string): string[] {
  return stripAnsi(text).split("\n");
}

describe("formatVersionLine", () => {
  test("keeps the brand mark and the version off the clack timeline", () => {
    const line = stripAnsi(formatVersionLine("1.2.3"));
    expect(line).toContain("hackspain");
    expect(line).toContain("v1.2.3");
    expect(line).not.toMatch(/^[◇◆]/);
  });
});

describe("formatGreeting", () => {
  test("sits on one line with the first name", () => {
    expect(stripAnsi(formatGreeting("Leonardo"))).toBe("Hey Leonardo 👋");
  });
});

describe("formatBootStep", () => {
  test("reads as a designed beat, not a leftover spinner log", () => {
    const line = stripAnsi(
      formatBootStep({
        ok: true,
        label: "checked in",
        detail: "Hey Ana 👋",
      })
    );
    expect(line).toContain("✓");
    expect(line).toContain("checked in");
    expect(line).toContain("Hey Ana");
    expect(line).not.toContain("Checked in");
  });

  test("failed beat uses a distinct mark", () => {
    const line = stripAnsi(
      formatBootStep({ ok: false, label: "checking in…" })
    );
    expect(line).toContain("✗");
  });
});

describe("openingBoardRows", () => {
  test("empty state is a compact four-row board", () => {
    const rows = openingBoardRows({ email: "ana@example.com" });
    expect(rows.map(([key]) => key)).toEqual([
      "Team",
      "Project",
      "Repo",
      "Signed in",
    ]);
    const values = rows.map(([, value]) => stripAnsi(value));
    expect(values[0]).toBe("none yet");
    expect(values[1]).toBe("none yet");
    expect(values[2]).toBe("not set");
    expect(values[3]).toBe("ana@example.com");
  });

  test("filled state shows team, project tracks, and repo", () => {
    const rows = openingBoardRows({
      email: "ana@example.com",
      team: {
        name: "Los Increíbles",
        isOwner: true,
        members: 3,
        repoUrl: "https://github.com/org/repo",
      },
      project: {
        name: "Quijote",
        submitted: false,
        tracks: 2,
        trackLabels: ["AI Agents", "Climate"],
      },
    });
    const values = rows.map(([, value]) => stripAnsi(value));
    expect(values[0]).toContain("Los Increíbles");
    expect(values[0]).toContain("3 members");
    expect(values[0]).toContain("you own it");
    expect(values[1]).toContain("Quijote");
    expect(values[1]).toContain("draft");
    expect(values[1]).toContain("AI Agents");
    expect(values[2]).toBe("https://github.com/org/repo");
  });
});

describe("formatStatusBoard", () => {
  test("draws a titled card with aligned keys", () => {
    const board = formatStatusBoard(
      [
        ["Team", "none yet"],
        ["Project", "none yet"],
        ["Repo", "not set"],
        ["Signed in", "ana@example.com"],
      ],
      80
    );
    const out = lines(board);
    expect(out[0]).toContain("status");
    expect(out[0]?.startsWith("  ╭")).toBe(true);
    expect(out.at(-1)?.startsWith("  ╰")).toBe(true);
    expect(
      out.some((line) => line.includes("Team") && line.includes("none yet"))
    ).toBe(true);
    expect(out.some((line) => line.includes("Signed in"))).toBe(true);
    const widths = out.map((line) => line.length);
    expect(new Set(widths).size).toBe(1);
  });
});

describe("renderOpening", () => {
  test("first-open sequence: version, boot, board", () => {
    const out = lines(
      renderOpening({
        version: "0.1.0",
        steps: [
          { ok: true, label: "checked in", detail: "Hey Leonardo 👋" },
          { ok: true, label: "loaded" },
        ],
        board: openingBoardRows({ email: "leo@example.com" }),
      })
    );
    const text = out.join("\n");
    expect(out[0]).toContain("hackspain");
    expect(out[0]).toContain("v0.1.0");
    expect(text).toContain("checked in");
    expect(text).toContain("Hey Leonardo");
    expect(text).toContain("loaded");
    expect(text).toContain("status");
    expect(text).not.toMatch(/◇|◆/);
  });

  test("return-to-menu: greeting and board, no boot replay", () => {
    const text = lines(
      renderOpening({
        version: "0.1.0",
        greeting: formatGreeting("Leonardo"),
        board: openingBoardRows({ email: "leo@example.com" }),
      })
    ).join("\n");
    expect(text).toContain("Hey Leonardo");
    expect(text).not.toContain("checked in");
    expect(text).not.toContain("loaded");
    expect(text).toContain("Team");
  });

  test("signed-out note, no board", () => {
    const text = lines(
      renderOpening({
        version: "0.1.0",
        message: "Signed out.",
      })
    ).join("\n");
    expect(text).toContain("Signed out.");
    expect(text).not.toContain("status");
  });
});
