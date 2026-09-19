import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ExportProject } from "./judging-export";
import {
  assessmentsCsv,
  csvCell,
  exportFileName,
  judgesCsv,
  rankingCsv,
  toCsv,
} from "./judging-export";

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
      ownCriteria: 4,
      ownCriteriaComment: 'Buen "pitch"\ny demo',
      problemSolving: 5,
      rawScore: 4.5,
      status: "submitted",
      submittedAt: Date.UTC(2026, 8, 19, 10, 0, 0),
    },
    {
      adjustedScore: null,
      craftsmanship: 2,
      judge: bruno,
      ownCriteriaComment: "",
      rawScore: null,
      status: "draft",
    },
  ],
  calibratedMean: null,
  challenges: [{ label: "Track A" }, { label: "Track B" }],
  difference: null,
  flagged: false,
  judges: [ana, bruno],
  name: "Proyecto Uno",
  rank: null,
  rawMean: null,
  submittedCount: 1,
  teamName: "Equipo 1",
};

function submittedOf(index: number) {
  const row = project.assessments[index];
  assert.ok(row, "fixture assessment exists");
  return row;
}

function lines(csv: string): string[] {
  assert.ok(csv.startsWith("\uFEFF"), "starts with a UTF-8 BOM");
  return csv.slice(1).split("\r\n").filter((line) => line.length > 0);
}

describe("csv cells", () => {
  test("quotes only what needs quoting and doubles inner quotes", () => {
    assert.equal(csvCell("plain"), "plain");
    assert.equal(csvCell("a,b"), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("two\nlines"), '"two\nlines"');
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(4.333333333333333), "4.333333333333333");
    assert.equal(csvCell(Number.NaN), "");
    assert.equal(csvCell(true), "Sí");
  });

  test("toCsv writes header, CRLF rows and a trailing newline", () => {
    const csv = toCsv(["a", "b"], [[1, "x"], [null, "y,z"]]);
    assert.equal(csv, '\uFEFFa,b\r\n1,x\r\n,"y,z"\r\n');
  });
});

describe("ranking export", () => {
  test("one row per project with both judges' raw scores and the status", () => {
    const rows = lines(rankingCsv([project], { final: false }));
    assert.equal(rows.length, 2);
    assert.equal(
      rows[0],
      "Puesto,Proyecto,Equipo,Retos,Juez A,Nota bruta A,Juez B,Nota bruta B,Media bruta,Media calibrada,Diferencia,Revisar,Evaluaciones enviadas,Clasificación"
    );
    assert.equal(
      rows[1],
      ',Proyecto Uno,Equipo 1,Track A | Track B,Ana,4.5,"Bruno, B.",,,,,No,1,Provisional'
    );
  });

  test("drafts never leak a raw score and full precision is kept", () => {
    const ranked: ExportProject = {
      ...project,
      assessments: [
        submittedOf(0),
        {
          ...submittedOf(1),
          adjustedScore: 4.083333333333333,
          rawScore: 4.25,
          status: "submitted",
        },
      ],
      calibratedMean: 4.166666666666667,
      difference: 0.25,
      flagged: true,
      rank: 1,
      rawMean: 4.375,
      submittedCount: 2,
    };
    const [, row] = lines(rankingCsv([ranked], { final: true }));
    assert.equal(
      row,
      '1,Proyecto Uno,Equipo 1,Track A | Track B,Ana,4.5,"Bruno, B.",4.25,4.375,4.166666666666667,0.25,Sí,2,Final'
    );
  });
});

describe("assessments export", () => {
  test("one row per assigned judge, pending ones included", () => {
    const pendingProject: ExportProject = {
      ...project,
      assessments: [submittedOf(0)],
    };
    const rows = lines(assessmentsCsv([pendingProject]));
    assert.equal(rows.length, 3);
    assert.ok(rows[0]?.includes("Factura técnica,Resolución del problema,Creatividad,Criterio propio"));
    assert.equal(
      rows[1],
      'Proyecto Uno,Equipo 1,Ana,Enviada,5,5,4,4,"Buen ""pitch""\ny demo",4.5,4.25,2026-09-19T10:00:00.000Z'
    );
    assert.equal(rows[2], "Proyecto Uno,Equipo 1,\"Bruno, B.\",Pendiente,,,,,,,,");
  });

  test("draft criteria are exported but not the raw or adjusted score", () => {
    const draft = lines(assessmentsCsv([project]))[2];
    assert.equal(draft, 'Proyecto Uno,Equipo 1,"Bruno, B.",Borrador,2,,,,,,,');
  });
});

describe("judges export", () => {
  test("keeps signed generosity and blanks it before calibration", () => {
    const rows = lines(
      judgesCsv([
        { assigned: 8, drafts: 1, email: "ana@x.es", generosity: -0.125, name: "Ana", submitted: 7 },
        { assigned: 8, drafts: 0, generosity: null, name: "Bruno", submitted: 0 },
      ])
    );
    assert.deepEqual(rows, [
      "Juez,Email,Asignados,Enviadas,Borradores,Generosidad",
      "Ana,ana@x.es,8,7,1,-0.125",
      "Bruno,,8,0,0,",
    ]);
  });
});

test("file names carry the kind and a minute stamp", () => {
  assert.equal(
    exportFileName("clasificacion", new Date(2026, 8, 19, 9, 5)),
    "hackspain-jurado-clasificacion-20260919-0905.csv"
  );
});
