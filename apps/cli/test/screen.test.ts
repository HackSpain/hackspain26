import { describe, expect, test } from "bun:test";
import { stripAnsi, width } from "../src/lib/style";
import { box, fit, frame } from "../src/watcher/screen";
import {
  createState,
  recordEvent,
  recordNotification,
} from "../src/watcher/state";
import { validEvent } from "./schema.test";

function sampleState() {
  const state = createState({
    me: { name: "Domènec", email: "d@example.com" },
    team: {
      name: "Quijote Labs",
      isOwner: true,
      repoUrl: "https://github.com/HackSpain/hackspain26",
      members: 3,
    },
    project: {
      name: "AgentOS",
      status: "draft",
      tracks: ["Maisa"],
      updatedAt: Date.now(),
    },
    uploadEnabled: true,
  });
  state.harnesses = [
    { id: "claude-code", found: true, requests: 0 },
    { id: "codex", found: false, requests: 0 },
  ];
  recordEvent(state, validEvent);
  recordEvent(state, { ...validEvent, eventId: "x2", sessionId: "s2" });
  recordNotification(
    state,
    "Pizza at 14:00",
    "Courtyard, bring your badge.",
    Date.now()
  );
  state.nextScanAt = Date.now() + 18_000;
  state.upload.lastOkAt = Date.now() - 2000;
  return state;
}

describe("frame", () => {
  test("never exceeds the terminal size and shows every panel", () => {
    for (const size of [
      { columns: 120, rows: 40 },
      { columns: 80, rows: 30 },
      { columns: 60, rows: 20 },
      { columns: 30, rows: 12 },
    ]) {
      const lines = frame(sampleState(), size);
      expect(lines.length).toBeLessThanOrEqual(size.rows);
      for (const line of lines) {
        expect(width(line)).toBeLessThanOrEqual(Math.max(40, size.columns));
      }
      const text = stripAnsi(lines.join("\n"));
      if (size.rows >= 18) {
        expect(text).toContain("Domènec");
      }
      expect(text).toContain("Live usage board");
      expect(text).toContain("Organisers");
      expect(lines.at(-1)).toContain("q");
      expect(stripAnsi(lines.at(-1) ?? "")).toContain("quit");
    }
  });

  test("shows the wordmark only when there is room", () => {
    const big = stripAnsi(
      frame(sampleState(), { columns: 100, rows: 40 }).join("\n")
    );
    const small = stripAnsi(
      frame(sampleState(), { columns: 100, rows: 24 }).join("\n")
    );
    expect(big).toContain("██╗");
    expect(small).not.toContain("██╗");
    expect(small).toContain("hackspain · watch");
  });

  test("counts requests, sessions and tokens, and lists notifications", () => {
    const text = stripAnsi(
      frame(sampleState(), { columns: 100, rows: 40 }).join("\n")
    );
    expect(text).toContain("2 requests");
    expect(text).toContain("2 sessions");
    // The megaphone is two cells wide; the box must still close on the same column.
    const lines = frame(sampleState(), { columns: 100, rows: 40 });
    const widths = new Set(
      lines.filter((l) => l.includes("┐")).map((l) => width(l))
    );
    expect(widths.size).toBe(1);
    expect(text).toContain("Pizza at 14:00");
    expect(text).toContain("Courtyard");
    expect(text).toContain("not on this machine");
  });

  test("paused state is visible in the status line", () => {
    const state = sampleState();
    state.paused = true;
    const text = stripAnsi(frame(state, { columns: 100, rows: 30 }).join("\n"));
    expect(text).toContain("paused");
    expect(text).toContain("p resume");
  });
});

describe("box and fit", () => {
  test("box lines are exactly the requested width", () => {
    for (const line of box(
      "Title",
      ["short", "a much longer line that will need to be cut down to size"],
      30
    )) {
      expect(width(line)).toBe(30);
    }
  });

  test("fit truncates visible width and drops colour when cutting", () => {
    expect(fit("hello", 10)).toBe("hello");
    expect(fit("\x1b[1mhello world\x1b[22m", 6)).toBe("hello…");
  });
});
