import type { CsvValue } from "./csv";
import { toCsv } from "./csv";
import { CRITERIA, CRITERION_LABELS } from "@convex/lib/judging";
import type { PartialScores } from "@convex/lib/judging";

export { toCsv, downloadCsv } from "./csv";

/**
 * CSV exports for the organiser judging dashboard. The shapes below are the
 * subset of `judging.adminOverview` the sheets need, kept structural so the
 * builders stay testable without Convex.
 */

type ExportJudgeRef = { _id: string; name: string };

type ExportAssessment = PartialScores & {
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
  return project.assessments.find((row) => row.judge._id === judge._id) ?? null;
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
    "Id",
    "Proyecto",
    "Equipo",
    "Reto",
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
    const track = project.challenges
      .map((challenge) => challenge.label)
      .join(" | ");
    for (const judge of project.judges) {
      const assessment = assessmentFor(project, judge);
      const submitted = assessment?.status === "submitted";
      rows.push([
        project._id,
        project.name,
        project.teamName ?? "",
        track,
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
