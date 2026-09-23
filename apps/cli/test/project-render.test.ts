import { describe, expect, test } from "bun:test";
import { projectListRows, renderSubmission } from "../src/commands/project";
import type { PublicSubmission, Submission } from "../src/lib/participant";
import { stripAnsi } from "../src/lib/style";
import {
  HOSTILE_CONTROL,
  RLO,
  recordingUi,
  withoutStyling,
} from "./recording-ui";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

const hostileSubmission = {
  _id: "s1",
  challengeIds: ["t1"],
  challenges: [
    { _id: "t1", label: `Maisa${RLO}`, logoUrl: undefined, slug: "maisa" },
  ],
  createdAt: NOW,
  description: "Agents for\u001B[2J everyone\rforged",
  name: "Agent\u001B]52;c;ZXZpbA==\u0007OS",
  perkIds: [],
  perks: [{ _id: "p1", company: "Vercel\u001BPdcs\u001B\\", title: "Pro" }],
  status: "submitted",
  submittedAt: NOW,
  submittedBy: "u1",
  submittedTracks: [],
  teamId: "team1",
  teamLogoUrl: undefined,
  teamName: "Quijote\u001B[2J Labs",
  techStack: [],
  updatedAt: NOW,
  urls: [
    {
      kind: "repo",
      url: "\u001B]8;;https://evil.example\u0007https://github.com/quijote/agentos\u001B]8;;\u0007",
    },
  ],
} as unknown as Submission;

describe("renderSubmission", () => {
  test("shows the project without any remote terminal controls", () => {
    const ui = recordingUi();
    renderSubmission(ui, hostileSubmission);

    const out = ui.printed.join("\n");
    expect(withoutStyling(out).replaceAll("\n", "")).not.toMatch(
      HOSTILE_CONTROL
    );
    expect(out).not.toContain("\u001B]");
    expect(out).not.toContain("evil.example");

    const text = stripAnsi(out);
    expect(text).toContain("Project: AgentOS");
    expect(text).toContain("Team: Quijote Labs");
    expect(text).toContain("Tracks: Maisa");
    expect(text).toContain("Repo: https://github.com/quijote/agentos");
    expect(text).toContain("Perks: Vercel: Pro");
    expect(text).toContain("Agents for everyoneforged");
  });

  test("--json still gets the raw submission, untouched", () => {
    const ui = recordingUi(true);
    renderSubmission(ui, hostileSubmission);
    expect(ui.results[0]).toBe(hostileSubmission);
    expect(hostileSubmission.name).toBe("Agent\u001B]52;c;ZXZpbA==\u0007OS");
  });
});

describe("projectListRows", () => {
  test("every column is cleaned before it is styled", () => {
    const project = {
      _id: "s1",
      challenges: [
        { _id: "t1", label: "Maisa", logoUrl: undefined, slug: `maisa${RLO}` },
      ],
      description: "",
      name: "Agent\u001B[2JOS",
      status: "draft",
      submittedAt: undefined,
      teamId: "team1",
      teamLogoUrl: undefined,
      teamName: "Quijote\rLabs",
      updatedAt: NOW,
      urls: [
        {
          kind: "repo",
          url: "https://github.com/quijote/agentos\u001BPx\u001B\\",
        },
      ],
    } as unknown as PublicSubmission;
    const [row] = projectListRows([project]);
    const joined = (row ?? []).join(" | ");
    expect(withoutStyling(joined)).not.toMatch(HOSTILE_CONTROL);
    expect(stripAnsi(joined)).toBe(
      "AgentOS | QuijoteLabs | maisa | draft | quijote/agentos"
    );
  });
});
