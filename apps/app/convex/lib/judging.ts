export const JUDGING_SETTINGS_KEY = "judging";
export const JUDGING_ROUND_KEY = "main";

export const JUDGES_PER_PROJECT = 2;
export const DEFAULT_LAMBDA = 2;
export const DEFAULT_DISAGREEMENT_THRESHOLD = 1.5;
export const MAX_COMMENT_LENGTH = 600;

export const ALLOWED_SCORES = [1, 2, 4, 5] as const;
export type ScoreValue = (typeof ALLOWED_SCORES)[number];

export const SCORE_LABELS: Record<ScoreValue, string> = {
  1: "Flojo",
  2: "Prometedor, con lagunas importantes",
  4: "Sólido",
  5: "Excepcional",
};

export const CRITERIA = [
  "craftsmanship",
  "problemSolving",
  "creativity",
  "overall",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_LABELS: Record<Criterion, string> = {
  craftsmanship: "Craftsmanship",
  problemSolving: "Problem solving",
  creativity: "Creativity",
  overall: "Overall",
};

export type CriterionScores = Record<Criterion, ScoreValue>;
export type PartialScores = Partial<Record<Criterion, ScoreValue>>;

export function isScoreValue(value: unknown): value is ScoreValue {
  return (
    typeof value === "number" &&
    (ALLOWED_SCORES as readonly number[]).includes(value)
  );
}

export function assertScoreValue(
  value: unknown,
  label = "La puntuación"
): asserts value is ScoreValue {
  if (!isScoreValue(value)) {
    throw new Error(`${label} debe ser 1, 2, 4 o 5`);
  }
}

export function assertComment(comment: string): string {
  const trimmed = comment.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `El comentario no puede superar ${MAX_COMMENT_LENGTH} caracteres`
    );
  }
  return trimmed;
}

/** Returns the four validated scores when an assessment can be submitted. */
export function completeScores(scores: PartialScores): CriterionScores | null {
  const out: PartialScores = {};
  for (const criterion of CRITERIA) {
    const value = scores[criterion];
    if (!isScoreValue(value)) {
      return null;
    }
    out[criterion] = value;
  }
  return out as CriterionScores;
}

export function assertLambda(lambda: number): void {
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error("Lambda debe ser un número mayor que cero");
  }
}

export function assertThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("El umbral debe ser un número mayor o igual que cero");
  }
}

export function rawScore(scores: CriterionScores): number {
  return (
    (scores.craftsmanship +
      scores.problemSolving +
      scores.creativity +
      scores.overall) /
    CRITERIA.length
  );
}

export type AssessmentStatus = "draft" | "submitted";

/** Raw score of a submitted, complete assessment; null for drafts or gaps. */
export function assessmentScore(
  row: PartialScores & { status: AssessmentStatus }
): number | null {
  if (row.status !== "submitted") {
    return null;
  }
  const scores = completeScores(row);
  return scores ? rawScore(scores) : null;
}

export function judgingComplete(
  submittedCount: number,
  total: number
): boolean {
  return total > 0 && submittedCount >= total;
}

export function totalAssessments(projectCount: number): number {
  return projectCount * JUDGES_PER_PROJECT;
}

/** Largest project count the cyclic pairing can cover with this many judges. */
export function maxProjectsFor(judgeCount: number): number {
  if (judgeCount < 2) {
    return 0;
  }
  return judgeCount * (judgeCount - 1);
}

export function pairingProblems(
  judgeCount: number,
  projectCount: number
): string[] {
  const problems: string[] = [];
  if (judgeCount < 2) {
    problems.push("Hacen falta al menos 2 jueces");
  }
  if (projectCount < 1) {
    problems.push("Hace falta al menos 1 proyecto enviado");
  }
  const max = maxProjectsFor(judgeCount);
  if (judgeCount >= 2 && projectCount > max) {
    problems.push(
      `Con ${judgeCount} jueces el máximo es ${max} proyectos (hay ${projectCount})`
    );
  }
  return problems;
}

export function assertPairingCounts(
  judgeCount: number,
  projectCount: number
): void {
  const problems = pairingProblems(judgeCount, projectCount);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
}

// --- Assessment writes -----------------------------------------------------

export type AssessmentInput = {
  ownCriteriaComment: string;
  scores: PartialScores;
};

/** Judges only write assessments for projects assigned to them. */
export function requireAssignedJudge<J>(
  assignment: { judgeId: J } | null,
  judgeId: J
): void {
  if (!assignment || assignment.judgeId !== judgeId) {
    throw new Error("No tienes asignado este proyecto");
  }
}

export function prepareDraft(
  existing: { status: AssessmentStatus } | null,
  input: AssessmentInput
): { ownCriteriaComment: string; scores: PartialScores; status: "draft" } {
  if (existing?.status === "submitted") {
    throw new Error(
      "Esta evaluación ya está enviada. Modifícala y vuelve a enviarla."
    );
  }
  const scores: PartialScores = {};
  for (const criterion of CRITERIA) {
    const value = input.scores[criterion];
    if (value !== undefined) {
      assertScoreValue(value, "Cada criterio");
      scores[criterion] = value;
    }
  }
  return {
    ownCriteriaComment: input.ownCriteriaComment.trim(),
    scores,
    status: "draft",
  };
}

export function prepareSubmission(input: AssessmentInput): {
  ownCriteriaComment: string;
  scores: CriterionScores;
  status: "submitted";
} {
  for (const criterion of CRITERIA) {
    assertScoreValue(input.scores[criterion], CRITERION_LABELS[criterion]);
  }
  const scores = completeScores(input.scores);
  if (!scores) {
    throw new Error("Faltan criterios por puntuar");
  }
  return {
    ownCriteriaComment: assertComment(input.ownCriteriaComment),
    scores,
    status: "submitted",
  };
}

/** One row per (project, judge): a second write replaces, never inserts. */
export function assessmentWriteKind(
  existing: { _id: string } | null
): "insert" | "replace" {
  return existing ? "replace" : "insert";
}

// --- Seeded shuffle -------------------------------------------------------

const MODULUS = 2_147_483_647; // 2^31 - 1
const MULTIPLIER = 48_271; // Park–Miller minimal standard generator

function hashSeed(seed: string): number {
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + (seed.codePointAt(i) ?? 0)) % MODULUS;
  }
  return hash === 0 ? 1 : hash;
}

function parkMiller(state: number): () => number {
  let current = state % MODULUS || 1;
  return () => {
    current = (current * MULTIPLIER) % MODULUS;
    return (current - 1) / (MODULUS - 1);
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const next = parkMiller(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

// --- Pairing --------------------------------------------------------------

export type Pair = { project: number; judges: [number, number] };

export function pairProjects(judgeCount: number, projectCount: number): Pair[] {
  assertPairingCounts(judgeCount, projectCount);
  const pairs: Pair[] = [];
  for (let i = 0; i < projectCount; i += 1) {
    const group = Math.floor(i / judgeCount);
    const first = i % judgeCount;
    const second = (first + group + 1) % judgeCount;
    pairs.push({ project: i, judges: [first, second] });
  }
  return pairs;
}

function judgeGraph(pairs: readonly Pair[], judgeCount: number): Set<number>[] {
  const adjacency: Set<number>[] = [];
  for (let j = 0; j < judgeCount; j += 1) {
    adjacency.push(new Set());
  }
  for (const pair of pairs) {
    const [a, b] = pair.judges;
    if (a === b) {
      continue;
    }
    adjacency[a]?.add(b);
    adjacency[b]?.add(a);
  }
  return adjacency;
}

export function isConnected(adjacency: readonly Set<number>[]): boolean {
  if (adjacency.length === 0) {
    return true;
  }
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    for (const next of adjacency[current] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === adjacency.length;
}

/** Empty when every structural guarantee of the pairing holds. */
export function validatePairs(
  pairs: readonly Pair[],
  judgeCount: number,
  projectCount: number
): string[] {
  const problems: string[] = [];
  if (pairs.length !== projectCount) {
    problems.push(`Hay ${pairs.length} proyectos repartidos, no ${projectCount}`);
  }
  const perJudge = Array.from({ length: judgeCount }, () => 0);
  const seenProjects = new Set<number>();
  for (const pair of pairs) {
    const [a, b] = pair.judges;
    if (seenProjects.has(pair.project)) {
      problems.push(`El proyecto ${pair.project} aparece dos veces`);
    }
    seenProjects.add(pair.project);
    if (a === b) {
      problems.push(`El proyecto ${pair.project} tiene el mismo juez dos veces`);
    }
    for (const judge of pair.judges) {
      if (judge < 0 || judge >= judgeCount || !Number.isInteger(judge)) {
        problems.push(`Juez ${judge} fuera de rango`);
        continue;
      }
      perJudge[judge] = (perJudge[judge] ?? 0) + 1;
    }
  }
  const adjacency = judgeGraph(pairs, judgeCount);
  const assigned = [];
  for (const [judge, count] of perJudge.entries()) {
    if (count > 0) {
      assigned.push(judge);
    }
  }
  if (assigned.length < 2) {
    problems.push("Hacen falta al menos dos jueces con proyectos");
  } else if (!isConnected(subgraph(adjacency, assigned))) {
    problems.push("La red de jueces no está conectada");
  }
  return problems;
}

function subgraph(
  adjacency: readonly Set<number>[],
  nodes: readonly number[]
): Set<number>[] {
  const index = new Map<number, number>();
  for (const [i, node] of nodes.entries()) {
    index.set(node, i);
  }
  const out: Set<number>[] = [];
  for (const node of nodes) {
    const peers = new Set<number>();
    for (const peer of adjacency[node] ?? []) {
      const mapped = index.get(peer);
      if (mapped !== undefined) {
        peers.add(mapped);
      }
    }
    out.push(peers);
  }
  return out;
}

// --- Conflicts of interest -------------------------------------------------

export type Conflict = { judge: number; project: number };

function conflictKey(judge: number, project: number): string {
  return `${judge}:${project}`;
}

function clonePairs(pairs: readonly Pair[]): Pair[] {
  return pairs.map((pair) => ({
    project: pair.project,
    judges: [pair.judges[0], pair.judges[1]],
  }));
}

function findConflicts(
  pairs: readonly Pair[],
  blocked: ReadonlySet<string>
): Conflict[] {
  const found: Conflict[] = [];
  for (const pair of pairs) {
    for (const judge of pair.judges) {
      if (blocked.has(conflictKey(judge, pair.project))) {
        found.push({ judge, project: pair.project });
      }
    }
  }
  return found;
}

function trySwap(
  pairs: Pair[],
  conflict: Conflict,
  blocked: ReadonlySet<string>,
  judgeCount: number,
  projectCount: number
): boolean {
  const source = pairs.find((pair) => pair.project === conflict.project);
  if (!source) {
    return false;
  }
  const slot = source.judges.indexOf(conflict.judge) as 0 | 1 | -1;
  if (slot === -1) {
    return false;
  }
  const judge = conflict.judge;
  for (const target of pairs) {
    if (target.project === source.project) {
      continue;
    }
    for (const targetSlot of [0, 1] as const) {
      const other = target.judges[targetSlot];
      if (
        other === judge ||
        source.judges.includes(other) ||
        target.judges.includes(judge) ||
        blocked.has(conflictKey(other, source.project)) ||
        blocked.has(conflictKey(judge, target.project))
      ) {
        continue;
      }
      source.judges[slot] = other;
      target.judges[targetSlot] = judge;
      if (validatePairs(pairs, judgeCount, projectCount).length === 0) {
        return true;
      }
      source.judges[slot] = judge;
      target.judges[targetSlot] = other;
    }
  }
  return false;
}

/**
 * Greedy pairwise swaps that remove conflicts while keeping every guarantee
 * checked by validatePairs. Conflicts left in `unresolved` need a human.
 */
export function resolveConflicts(
  input: readonly Pair[],
  conflicts: readonly Conflict[],
  judgeCount: number,
  projectCount: number
): { pairs: Pair[]; unresolved: Conflict[]; swaps: number } {
  const blocked = new Set(
    conflicts.map((conflict) => conflictKey(conflict.judge, conflict.project))
  );
  const pairs = clonePairs(input);
  let swaps = 0;
  let pending = findConflicts(pairs, blocked);
  for (let pass = 0; pass < 3 && pending.length > 0; pass += 1) {
    let progressed = false;
    for (const conflict of pending) {
      if (!blocked.has(conflictKey(conflict.judge, conflict.project))) {
        continue;
      }
      const stillThere = pairs.some(
        (pair) =>
          pair.project === conflict.project &&
          pair.judges.includes(conflict.judge)
      );
      if (!stillThere) {
        continue;
      }
      if (trySwap(pairs, conflict, blocked, judgeCount, projectCount)) {
        swaps += 1;
        progressed = true;
      }
    }
    pending = findConflicts(pairs, blocked);
    if (!progressed) {
      break;
    }
  }
  return { pairs, swaps, unresolved: pending };
}

// --- Calibration -----------------------------------------------------------

export type PairedObservation<J> = {
  judgeA: J;
  judgeB: J;
  scoreA: number;
  scoreB: number;
};

export function buildCalibrationSystem<J>(
  judges: readonly J[],
  observations: readonly PairedObservation<J>[],
  lambda: number
): { L: number[][]; d: number[] } {
  const index = new Map<J, number>();
  for (const [i, judge] of judges.entries()) {
    index.set(judge, i);
  }
  const n = judges.length;
  const L = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );
  const d = Array.from({ length: n }, () => 0);
  for (const observation of observations) {
    const a = index.get(observation.judgeA);
    const b = index.get(observation.judgeB);
    const rowA = a === undefined ? undefined : L[a];
    const rowB = b === undefined ? undefined : L[b];
    if (a === undefined || b === undefined || a === b || !rowA || !rowB) {
      continue;
    }
    const difference = observation.scoreA - observation.scoreB;
    rowA[a] = (rowA[a] ?? 0) + 1;
    rowB[b] = (rowB[b] ?? 0) + 1;
    rowA[b] = (rowA[b] ?? 0) - 1;
    rowB[a] = (rowB[a] ?? 0) - 1;
    d[a] = (d[a] ?? 0) + difference;
    d[b] = (d[b] ?? 0) - difference;
  }
  for (const [i, row] of L.entries()) {
    row[i] = (row[i] ?? 0) + lambda;
  }
  return { L, d };
}

/** Gaussian elimination with partial pivoting. */
export function solveLinearSystem(
  matrix: readonly (readonly number[])[],
  vector: readonly number[]
): number[] {
  const n = vector.length;
  const a: number[][] = matrix.map((row, i) => [...row, vector[i] ?? 0]);
  const cell = (row: number, col: number): number => a[row]?.[col] ?? 0;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(cell(row, col)) > Math.abs(cell(pivot, col))) {
        pivot = row;
      }
    }
    if (Math.abs(cell(pivot, col)) < 1e-12) {
      throw new Error("El sistema de calibración es singular");
    }
    const pivotRow = a[pivot];
    const colRow = a[col];
    if (!pivotRow || !colRow) {
      throw new Error("El sistema de calibración está mal formado");
    }
    if (pivot !== col) {
      a[col] = pivotRow;
      a[pivot] = colRow;
    }
    const lead = a[col] as number[];
    const leadValue = lead[col] ?? 0;
    for (let row = col + 1; row < n; row += 1) {
      const current = a[row];
      if (!current) {
        continue;
      }
      const factor = (current[col] ?? 0) / leadValue;
      if (factor === 0) {
        continue;
      }
      for (let k = col; k <= n; k += 1) {
        current[k] = (current[k] ?? 0) - factor * (lead[k] ?? 0);
      }
    }
  }
  const x = Array.from({ length: n }, () => 0);
  for (let row = n - 1; row >= 0; row -= 1) {
    const current = a[row];
    if (!current) {
      continue;
    }
    let sum = current[n] ?? 0;
    for (let k = row + 1; k < n; k += 1) {
      sum -= (current[k] ?? 0) * (x[k] ?? 0);
    }
    x[row] = sum / (current[row] ?? 1);
  }
  return x;
}

export function estimateGenerosity<J>(
  judges: readonly J[],
  observations: readonly PairedObservation<J>[],
  lambda: number
): Map<J, number> {
  const out = new Map<J, number>();
  if (judges.length === 0) {
    return out;
  }
  const { L, d } = buildCalibrationSystem(judges, observations, lambda);
  const solution = solveLinearSystem(L, d);
  for (const [i, judge] of judges.entries()) {
    out.set(judge, solution[i] ?? 0);
  }
  return out;
}

/** True when every judge is reachable through projects both have scored. */
export function calibrationConnected<J>(
  judges: readonly J[],
  observations: readonly PairedObservation<J>[]
): boolean {
  const index = new Map<J, number>();
  for (const [i, judge] of judges.entries()) {
    index.set(judge, i);
  }
  const pairs: Pair[] = [];
  for (const [i, observation] of observations.entries()) {
    const a = index.get(observation.judgeA);
    const b = index.get(observation.judgeB);
    if (a !== undefined && b !== undefined) {
      pairs.push({ project: i, judges: [a, b] });
    }
  }
  return isConnected(judgeGraph(pairs, judges.length));
}

// --- Ranking ---------------------------------------------------------------

export type ScoredAssessment<J> = { judge: J; score: number };

export type ProjectResult<P, J> = {
  project: P;
  assessments: { judge: J; score: number; adjusted: number }[];
  rawMean: number | null;
  calibratedMean: number | null;
  difference: number | null;
  rank: number | null;
};

export function rankProjects<P, J>(
  projects: readonly { project: P; assessments: ScoredAssessment<J>[] }[],
  generosity: ReadonlyMap<J, number>
): ProjectResult<P, J>[] {
  const results: ProjectResult<P, J>[] = projects.map((entry) => {
    const assessments = entry.assessments.map((assessment) => ({
      ...assessment,
      adjusted: assessment.score - (generosity.get(assessment.judge) ?? 0),
    }));
    const [first, second] = assessments;
    if (assessments.length < JUDGES_PER_PROJECT || !first || !second) {
      return {
        project: entry.project,
        assessments,
        rawMean: null,
        calibratedMean: null,
        difference: null,
        rank: null,
      };
    }
    return {
      project: entry.project,
      assessments,
      rawMean: (first.score + second.score) / 2,
      calibratedMean: (first.adjusted + second.adjusted) / 2,
      difference: Math.abs(first.score - second.score),
      rank: null,
    };
  });
  const ranked = results.filter((result) => result.calibratedMean !== null);
  for (const result of ranked) {
    const score = result.calibratedMean as number;
    let above = 0;
    for (const other of ranked) {
      if ((other.calibratedMean as number) > score) {
        above += 1;
      }
    }
    result.rank = above + 1;
  }
  return results;
}

export function compareByRank<P, J>(
  a: ProjectResult<P, J>,
  b: ProjectResult<P, J>
): number {
  if ((a.rank === null) !== (b.rank === null)) {
    return a.rank === null ? 1 : -1;
  }
  if (a.rank !== null && b.rank !== null && a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  return 0;
}

export function isFlagged(
  difference: number | null,
  threshold: number
): boolean {
  return difference !== null && difference >= threshold;
}
