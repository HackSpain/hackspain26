import { describe, expect, test } from "bun:test";
import { renderTeam, teamListRows } from "../src/commands/team";
import type { Team, TeamSummary } from "../src/lib/participant";
import { stripAnsi } from "../src/lib/style";
import {
  HOSTILE_CONTROL,
  RLO,
  recordingUi,
  withoutStyling,
} from "./recording-ui";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

type Member = Team["members"][number];

/** Every field a participant can write, each carrying a different terminal instruction. */
const hostileTeam: Team = {
  _id: "t1" as Team["_id"],
  createdAt: NOW,
  isOwner: true,
  joinCode: "ABCD1234\u001B[2J",
  logoUrl: undefined,
  members: [
    {
      _id: "m1" as Member["_id"],
      email: "ana@example.com\rforged",
      identifier: "ana@example.com",
      identifierType: "email",
      name: "Ana\u001B]52;c;ZXZpbA==\u0007",
      status: "member",
      userId: "u1" as Member["userId"],
    },
    {
      _id: "m2" as Member["_id"],
      email: undefined,
      identifier: "\u001B]8;;https://evil.example\u0007octocat\u001B]8;;\u0007",
      identifierType: "github",
      name: undefined,
      status: "pending",
      userId: undefined,
    },
  ],
  name: "Quijote\u001B[2J Labs",
  ownerId: "u1" as Team["ownerId"],
  repoUrl: "https://github.com/quijote/agentos\u001BPdcs\u001B\\",
  repoUrls: ["https://github.com/quijote/agentos\u001BPdcs\u001B\\"],
  techStack: [`Next.js${RLO}`, "Convex"],
};

describe("renderTeam", () => {
  test("shows the team, members and join code without any remote terminal controls", () => {
    const ui = recordingUi();
    renderTeam(ui, hostileTeam, "u1");

    const out = ui.printed.join("\n");
    const visible = withoutStyling(out);
    expect(visible.replaceAll("\n", "")).not.toMatch(HOSTILE_CONTROL);
    expect(out).not.toContain("\u001B]");
    expect(out).not.toContain("\u001BP");
    expect(out).not.toContain("evil.example");

    const text = stripAnsi(out);
    expect(text).toContain("Team: Quijote Labs");
    expect(text).toContain("Repo: https://github.com/quijote/agentos");
    expect(text).toContain("Stack: Next.js, Convex");
    expect(text).toContain("Ana (you) | ana@example.comforged | owner");
    expect(text).toContain("github:octocat | github:octocat | invited");
    expect(text).toContain("hackspain team join ABCD1234");
  });

  test("keeps HackSpain's own styling around the cleaned text", () => {
    const ui = recordingUi();
    renderTeam(ui, hostileTeam, "u1");
    // Colour is off under bun test (no TTY), so styling shows as identity;
    // the visible text must still read as the styled template.
    expect(stripAnsi(ui.printed[0] ?? "")).toMatch(
      /^Team: Quijote Labs · since /
    );
  });

  test("--json still gets the raw team, untouched", () => {
    const ui = recordingUi(true);
    renderTeam(ui, hostileTeam, "u1");
    expect(ui.results).toHaveLength(1);
    expect(ui.results[0]).toBe(hostileTeam);
    expect(hostileTeam.name).toBe("Quijote\u001B[2J Labs");
  });
});

describe("teamListRows", () => {
  test("every column is cleaned before it is styled", () => {
    const summary: TeamSummary = {
      _id: "t1" as TeamSummary["_id"],
      isMine: true,
      logoUrl: undefined,
      memberCount: 3,
      members: [],
      name: "Quijote\u001B[2J Labs",
      pendingCount: 1,
      projectName: undefined,
      repoUrl: "https://github.com/quijote/agentos\rforged",
      repoUrls: [],
      submissionStatus: "draft",
      techStack: [],
      tracks: [{ label: "Maisa", logoUrl: undefined, slug: `maisa${RLO}` }],
    };
    const [row] = teamListRows([summary]);
    const joined = (row ?? []).join(" | ");
    expect(withoutStyling(joined)).not.toMatch(HOSTILE_CONTROL);
    expect(stripAnsi(joined)).toBe(
      "Quijote Labs (you) | 3 +1 invited | maisa | draft | quijote/agentosforged"
    );
    expect(summary.name).toBe("Quijote\u001B[2J Labs");
  });
});
