import { describe, expect, test } from "bun:test";
import { milestoneRows } from "../src/commands/milestone";
import type { Milestone } from "../src/lib/participant";
import { stripAnsi } from "../src/lib/style";
import { HOSTILE_CONTROL, RLO, withoutStyling } from "./recording-ui";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

const hostile: Milestone = {
  _id: "m1" as Milestone["_id"],
  at: NOW,
  byName: "Ana\u001B]52;c;ZXZpbA==\u0007",
  kind: "custom",
  label: `Demo\u001B[2J works${RLO} on \u001B]8;;https://evil.example\u0007stage\u001B]8;;\u0007`,
  teamId: "t1" as Milestone["teamId"],
  teamName: "Quijote\rLabs\u001BPdcs\u001B\\",
};

describe("milestoneRows", () => {
  test("team, label and author are cleaned before they are styled", () => {
    const [row] = milestoneRows([hostile], true);
    const joined = (row ?? []).join(" | ");
    expect(withoutStyling(joined)).not.toMatch(HOSTILE_CONTROL);
    expect(joined).not.toContain("evil.example");
    expect(stripAnsi(joined)).toMatch(
      /^.+ \| QuijoteLabs \| Milestone \| Demo works on stage \| Ana$/
    );
    expect(hostile.label).toContain("\u001B[2J");
  });

  test("without --all the team column is left out", () => {
    const [row] = milestoneRows([hostile], false);
    expect(row).toHaveLength(4);
    expect(stripAnsi(row?.[1] ?? "")).toBe("Milestone");
  });
});
