import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExportProject } from "./judging-export";
import { assessmentsCsv, rankingCsv, toCsv } from "./judging-export";

const ana = { _id: "j1", name: "Ana" };
const bruno = { _id: "j2", name: "Bruno, B." };

const project: ExportProject = {
  _id: "p1",
  assessments: [
    {
      adjustedScore: 4.25,
      craftsmanship: 5,
      creativity: 4,
      judge: ana,
      overall: 4,
      ownCriteriaComment: 'Buen "pitch"',
      problemSolving: 5,
      rawScore: 4.5,
      status: "submitted",
      submittedAt: Date.UTC(2026, 8, 19, 10),
    },
    {
      adjustedScore: null,
      craftsmanship: 2,
      judge: bruno,
      ownCriteriaComment: "",
      rawScore: 2,
      status: "draft",
    },
  ],
  calibratedMean: null,
  challenges: [{ label: "Track A" }],
  difference: null,
  flagged: false,
  judges: [ana, bruno],
  name: "Proyecto Uno",
  rank: null,
  rawMean: null,
  submittedCount: 1,
  teamName: "Equipo 1",
};

function rows(csv: string): string[] {
  return csv.slice(1).split("\r\n").filter(Boolean);
}

test("csv has a BOM, CRLF rows, and quotes only what needs it", () => {
  assert.equal(
    toCsv(["a", "b"], [[1, 'say "hi"'], [null, "y,z"]]),
    '\uFEFFa,b\r\n1,"say ""hi"""\r\n,"y,z"\r\n'
  );
});

test("ranking rows keep full precision and never show a draft as a score", () => {
  const [, row] = rows(rankingCsv([project], { final: false }));
  assert.equal(
    row,
    ',Proyecto Uno,Equipo 1,Track A,Ana,4.5,"Bruno, B.",,,,,No,1,Provisional'
  );
});

test("assessment rows cover every assigned judge, drafts without a score", () => {
  const [, ana1, bruno1] = rows(assessmentsCsv([project]));
  assert.equal(
    ana1,
    'Proyecto Uno,Equipo 1,Ana,Enviada,5,5,4,4,"Buen ""pitch""",4.5,4.25,2026-09-19T10:00:00.000Z'
  );
  assert.equal(bruno1, 'Proyecto Uno,Equipo 1,"Bruno, B.",Borrador,2,,,,,,,');
});
