import { CRITERIA, CRITERION_LABELS } from "@convex/lib/judging";
import type { PartialScores } from "@convex/lib/judging";

/**
 * CSV exports for the organiser judging dashboard. The shapes below are the
 * subset of `judging.adminOverview` the sheets need, kept structural so the
 * builders stay testable without Convex.
 */

export type ExportJudgeRef = { _id: string; name: string };

export type ExportAssessment = PartialScores & {
  adjustedScore: number | null;
  judge: ExportJudgeRef;
  ownCriteriaComment: string;
  rawScore: number | null;
  status: "draft" | "submitted";
  submittedAt?: number;
};

export type ExportProject = {
  _id: string;
  assessments: ExportAssessment[];
  calibratedMean: number | null;
  challenges: { label: string }[];
  difference: number | null;
  flagged: boolean;
  judges: ExportJudgeRef[];
  name: string;
  rank: number | null;
  rawMean: number | null;
  submittedCount: number;
  teamName?: string;
};

export type ExportJudge = {
  assigned: number;
  drafts: number;
  email?: string;
  generosity: number | null;
  name: string;
  submitted: number;
};

type CsvValue = string | number | boolean | null | undefined;

const BOM = "\uFEFF";
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** UTF-8 BOM so Excel reads accents, CRLF because that is what it writes. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

function statusLabel(assessment: ExportAssessment | null): string {
  if (!assessment) {
    return "Pendiente";
  }
  return assessment.status === "submitted" ? "Enviada" : "Borrador";
}

function submittedRaw(assessment: ExportAssessment | null): number | null {
  return assessment?.status === "submitted" ? assessment.rawScore : null;
}

function assessmentFor(
  project: ExportProject,
  judge: ExportJudgeRef
): ExportAssessment | null {
  return (
    project.assessments.find((row) => row.judge._id === judge._id) ?? null
  );
}

export function rankingCsv(
  projects: ExportProject[],
  options: { final: boolean }
): string {
  const header = [
    "Puesto",
    "Proyecto",
    "Equipo",
    "Retos",
    "Juez A",
    "Nota bruta A",
    "Juez B",
    "Nota bruta B",
    "Media bruta",
    "Media calibrada",
    "Diferencia",
    "Revisar",
    "Evaluaciones enviadas",
    "Clasificación",
  ];
  const rows = projects.map((project) => {
    const [a, b] = project.judges;
    const rowA = a ? assessmentFor(project, a) : null;
    const rowB = b ? assessmentFor(project, b) : null;
    return [
      project.rank,
      project.name,
      project.teamName ?? "",
      project.challenges.map((challenge) => challenge.label).join(" | "),
      a?.name ?? "",
      submittedRaw(rowA),
      b?.name ?? "",
      submittedRaw(rowB),
      project.rawMean,
      project.calibratedMean,
      project.difference,
      project.flagged,
      project.submittedCount,
      options.final ? "Final" : "Provisional",
    ];
  });
  return toCsv(header, rows);
}

export function assessmentsCsv(projects: ExportProject[]): string {
  const header = [
    "Proyecto",
    "Equipo",
    "Juez",
    "Estado",
    ...CRITERIA.map((criterion) => CRITERION_LABELS[criterion]),
    "Notas",
    "Nota bruta",
    "Nota ajustada",
    "Enviada el",
  ];
  const rows: CsvValue[][] = [];
  for (const project of projects) {
    for (const judge of project.judges) {
      const assessment = assessmentFor(project, judge);
      const submitted = assessment?.status === "submitted";
      rows.push([
        project.name,
        project.teamName ?? "",
        judge.name,
        statusLabel(assessment),
        ...CRITERIA.map((criterion) => assessment?.[criterion] ?? null),
        assessment?.ownCriteriaComment ?? "",
        submitted ? assessment.rawScore : null,
        submitted ? assessment.adjustedScore : null,
        submitted && assessment.submittedAt
          ? new Date(assessment.submittedAt).toISOString()
          : "",
      ]);
    }
  }
  return toCsv(header, rows);
}

export function judgesCsv(judges: ExportJudge[]): string {
  const header = [
    "Juez",
    "Email",
    "Asignados",
    "Enviadas",
    "Borradores",
    "Generosidad",
  ];
  const rows = judges.map((judge) => [
    judge.name,
    judge.email ?? "",
    judge.assigned,
    judge.submitted,
    judge.drafts,
    judge.generosity,
  ]);
  return toCsv(header, rows);
}

export function exportFileName(kind: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `hackspain-jurado-${kind}-${stamp}.csv`;
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
