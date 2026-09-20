import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertScoreValue,
  assessmentScore,
  assessmentWriteKind,
  buildCalibrationSystem,
  calibrationConnected,
  completeScores,
  estimateGenerosity,
  isConnected,
  isFlagged,
  judgingComplete,
  pairingProblems,
  pairProjects,
  prepareDraft,
  prepareSubmission,
  rankProjects,
  rawScore,
  requireAssignedJudge,
  resolveConflicts,
  seededShuffle,
  solveLinearSystem,
  totalAssessments,
  validatePairs,
} from "../../convex/lib/judging";
import type {
  Conflict,
  Pair,
  PairedObservation,
} from "../../convex/lib/judging";

const JUDGE_COUNT = 13;
const PROJECT_COUNT = 52;
const PROJECTS_PER_JUDGE = 8;
const JUDGES = Array.from({ length: JUDGE_COUNT }, (_, i) => `j${i}`);

function judgeGraph(pairs: Pair[]): Set<number>[] {
  const adjacency = Array.from({ length: JUDGE_COUNT }, () => new Set<number>());
  for (const pair of pairs) {
    adjacency[pair.judges[0]]?.add(pair.judges[1]);
    adjacency[pair.judges[1]]?.add(pair.judges[0]);
  }
  return adjacency;
}

function must<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, "expected a value");
  return value;
}

function approx(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `expected ${actual} ≈ ${expected}`
  );
}

describe("assignment", () => {
  test("13 judges × 52 projects gives 8 per judge, 2 distinct per project", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    assert.equal(pairs.length, PROJECT_COUNT);
    const perJudge = new Map<number, number>();
    for (const pair of pairs) {
      assert.notEqual(pair.judges[0], pair.judges[1]);
      for (const judge of pair.judges) {
        perJudge.set(judge, (perJudge.get(judge) ?? 0) + 1);
      }
    }
    assert.equal(perJudge.size, JUDGE_COUNT);
    for (const count of perJudge.values()) {
      assert.equal(count, PROJECTS_PER_JUDGE);
    }
    assert.equal(pairs.length * 2, totalAssessments(PROJECT_COUNT));
  });

  test("each judge overlaps eight distinct judges and the network is connected", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    const adjacency = judgeGraph(pairs);
    for (const peers of adjacency) {
      assert.equal(peers.size, PROJECTS_PER_JUDGE);
    }
    assert.equal(isConnected(adjacency), true);
    assert.deepEqual(validatePairs(pairs, JUDGE_COUNT, PROJECT_COUNT), []);
  });

  test("validatePairs reports broken guarantees", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    const broken = pairs.map((pair) => ({ ...pair, judges: [...pair.judges] as [number, number] }));
    must(broken[0]).judges[1] = must(broken[0]).judges[0];
    const problems = validatePairs(broken, JUDGE_COUNT, PROJECT_COUNT);
    assert.ok(problems.length > 0);
    assert.ok(problems.some((problem) => problem.includes("mismo juez")));
  });

  test("the same formula works for other even loads, and refuses impossible counts", () => {
    const small = pairProjects(5, 10);
    assert.equal(small.length, 10);
    assert.deepEqual(validatePairs(small, 5, 10), []);
    const perJudge = new Map<number, number>();
    for (const pair of small) {
      for (const judge of pair.judges) {
        perJudge.set(judge, (perJudge.get(judge) ?? 0) + 1);
      }
    }
    for (const count of perJudge.values()) {
      assert.equal(count, 4);
    }
    assert.throws(() => pairProjects(1, 10), /al menos 2 jueces/);
    assert.throws(() => pairProjects(3, 7), /máximo es 6/);
    assert.deepEqual(pairingProblems(0, 0).length > 0, true);
  });

  test("seeded shuffle is a deterministic permutation", () => {
    const items = Array.from({ length: PROJECT_COUNT }, (_, i) => `p${i}`);
    const first = seededShuffle(items, "hackspain-2026");
    const second = seededShuffle(items, "hackspain-2026");
    const other = seededShuffle(items, "another-seed");
    assert.deepEqual(first, second);
    assert.deepEqual([...first].toSorted(), [...items].toSorted());
    assert.notDeepEqual(first, other);
    assert.notDeepEqual(first, items);
  });
});

describe("conflicts of interest", () => {
  test("no conflicts leaves the pairing untouched", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    const result = resolveConflicts(pairs, [], JUDGE_COUNT, PROJECT_COUNT);
    assert.equal(result.swaps, 0);
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(result.pairs, pairs);
  });

  test("a conflict is removed with swaps that keep every guarantee", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    const conflicts: Conflict[] = [
      { judge: must(pairs[0]).judges[0], project: 0 },
      { judge: must(pairs[20]).judges[1], project: 20 },
    ];
    const result = resolveConflicts(pairs, conflicts, JUDGE_COUNT, PROJECT_COUNT);
    assert.deepEqual(result.unresolved, []);
    assert.ok(result.swaps >= 2);
    assert.deepEqual(validatePairs(result.pairs, JUDGE_COUNT, PROJECT_COUNT), []);
    for (const conflict of conflicts) {
      const pair = result.pairs.find((row) => row.project === conflict.project);
      assert.ok(pair);
      assert.equal(pair.judges.includes(conflict.judge), false);
    }
    assert.deepEqual(
      pairs.map((pair) => pair.judges),
      pairProjects(JUDGE_COUNT, PROJECT_COUNT).map((pair) => pair.judges),
      "input pairs are not mutated"
    );
  });

  test("impossible conflicts are reported instead of silently dropped", () => {
    const pairs = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    const conflicts: Conflict[] = Array.from(
      { length: PROJECT_COUNT },
      (_, project) => ({ judge: 0, project })
    );
    const result = resolveConflicts(pairs, conflicts, JUDGE_COUNT, PROJECT_COUNT);
    assert.ok(result.unresolved.length > 0);
    assert.ok(result.unresolved.every((conflict) => conflict.judge === 0));
    assert.deepEqual(validatePairs(result.pairs, JUDGE_COUNT, PROJECT_COUNT), []);
  });
});

describe("scores", () => {
  test("only 1, 2, 4 and 5 are valid", () => {
    for (const value of [1, 2, 4, 5]) {
      assert.doesNotThrow(() => assertScoreValue(value));
    }
    for (const value of [3, 0, 6, 2.5, -1, Number.NaN, "4", undefined]) {
      assert.throws(() => assertScoreValue(value), /1, 2, 4 o 5/);
    }
  });

  test("raw score is the equal-weight mean of the four criteria", () => {
    approx(
      rawScore({ craftsmanship: 5, creativity: 2, overall: 1, problemSolving: 4 }),
      3
    );
    approx(
      rawScore({ craftsmanship: 5, creativity: 5, overall: 4, problemSolving: 4 }),
      4.5
    );
  });

  test("submission requires all four scores and rejects 3", () => {
    const scores = { craftsmanship: 5 as const, creativity: 4 as const, overall: 2 as const, problemSolving: 1 as const };
    const ok = prepareSubmission({ ownCriteriaComment: "  una nota ", scores });
    assert.equal(ok.status, "submitted");
    assert.equal(ok.ownCriteriaComment, "una nota");
    assert.throws(
      () => prepareSubmission({ ownCriteriaComment: "", scores: { ...scores, creativity: undefined } }),
      /1, 2, 4 o 5/
    );
    assert.throws(
      () =>
        prepareSubmission({
          ownCriteriaComment: "",
          scores: { ...scores, creativity: 3 as unknown as 4 },
        }),
      /1, 2, 4 o 5/
    );
    const withoutNote = prepareSubmission({ ownCriteriaComment: "   ", scores });
    assert.equal(withoutNote.ownCriteriaComment, "");
    assert.equal(completeScores({ ...scores, overall: undefined }), null);
  });

  test("drafts accept gaps but not invalid values or submitted rows", () => {
    const draft = prepareDraft(null, { ownCriteriaComment: "", scores: { craftsmanship: 4 } });
    assert.equal(draft.status, "draft");
    assert.deepEqual(draft.scores, { craftsmanship: 4 });
    assert.throws(
      () => prepareDraft(null, { ownCriteriaComment: "", scores: { craftsmanship: 3 as unknown as 4 } }),
      /1, 2, 4 o 5/
    );
    assert.throws(
      () => prepareDraft({ status: "submitted" }, { ownCriteriaComment: "", scores: {} }),
      /ya está enviada/
    );
  });

  test("judges only write their own assigned assessments", () => {
    assert.doesNotThrow(() => requireAssignedJudge({ judgeId: "j1" }, "j1"));
    assert.throws(() => requireAssignedJudge(null, "j1"), /No tienes asignado/);
    assert.throws(() => requireAssignedJudge({ judgeId: "j2" }, "j1"), /No tienes asignado/);
  });

  test("a second write for the same (project, judge) replaces instead of inserting", () => {
    assert.equal(assessmentWriteKind(null), "insert");
    assert.equal(assessmentWriteKind({ _id: "a1" }), "replace");
  });

  test("drafts and incomplete assessments never produce a score", () => {
    const full = { craftsmanship: 4 as const, creativity: 4 as const, overall: 4 as const, problemSolving: 4 as const };
    assert.equal(assessmentScore({ ...full, status: "draft" }), null);
    assert.equal(assessmentScore({ ...full, overall: undefined, status: "submitted" }), null);
    approx(assessmentScore({ ...full, status: "submitted" }) ?? Number.NaN, 4);
  });
});

function pairedObservations(
  scoreFor: (judge: number, project: number) => number,
  projects: Pair[] = pairProjects(JUDGE_COUNT, PROJECT_COUNT)
): PairedObservation<string>[] {
  return projects.map((pair) => ({
    judgeA: must(JUDGES[pair.judges[0]]),
    judgeB: must(JUDGES[pair.judges[1]]),
    scoreA: scoreFor(pair.judges[0], pair.project),
    scoreB: scoreFor(pair.judges[1], pair.project),
  }));
}

describe("calibration", () => {
  test("the linear system matches the specified construction", () => {
    const { L, d } = buildCalibrationSystem(
      ["a", "b", "c"],
      [{ judgeA: "a", judgeB: "b", scoreA: 4, scoreB: 2.5 }],
      2
    );
    assert.deepEqual(L, [
      [3, -1, 0],
      [-1, 3, 0],
      [0, 0, 2],
    ]);
    assert.deepEqual(d, [1.5, -1.5, 0]);
  });

  test("the solver satisfies L·x = d", () => {
    const L = [
      [4, 1, 0],
      [1, 3, -1],
      [0, -1, 2],
    ];
    const d = [1, 2, 3];
    const x = solveLinearSystem(L, d);
    for (let i = 0; i < 3; i += 1) {
      const row = must(L[i]);
      approx(must(row[0]) * must(x[0]) + must(row[1]) * must(x[1]) + must(row[2]) * must(x[2]), must(d[i]));
    }
    assert.throws(() => solveLinearSystem([[1, 1], [1, 1]], [1, 1]), /singular/);
  });

  test("agreement on every project gives zero generosity for everyone", () => {
    const observations = pairedObservations((_, project) => 1 + (project % 4));
    const generosity = estimateGenerosity(JUDGES, observations, 2);
    for (const judge of JUDGES) {
      approx(generosity.get(judge) ?? Number.NaN, 0);
    }
  });

  test("a systematically lenient judge gets a positive adjustment", () => {
    const observations = pairedObservations((judge, project) => {
      const base = 2 + (project % 3);
      return judge === 0 ? base + 1 : base;
    });
    const generosity = estimateGenerosity(JUDGES, observations, 2);
    const lenient = generosity.get("j0") ?? Number.NaN;
    assert.ok(lenient > 0, `expected positive, got ${lenient}`);
    for (const judge of JUDGES.slice(1)) {
      const other = generosity.get(judge) ?? Number.NaN;
      assert.ok(other < lenient);
      assert.ok(other <= 1e-9, `partners drift slightly negative, got ${other}`);
    }
  });

  test("generosity recomputes from the current submitted scores after an edit", () => {
    const before = estimateGenerosity(
      JUDGES,
      pairedObservations((judge) => (judge === 3 ? 5 : 4)),
      2
    );
    const after = estimateGenerosity(
      JUDGES,
      pairedObservations(() => 4),
      2
    );
    assert.ok((before.get("j3") ?? 0) > 0.5);
    approx(after.get("j3") ?? Number.NaN, 0);
  });

  test("missing assessments leave the calibration network disconnected", () => {
    const all = pairProjects(JUDGE_COUNT, PROJECT_COUNT);
    assert.equal(calibrationConnected(JUDGES, pairedObservations(() => 4, all)), true);
    const firstFive = all.filter((pair) => pair.project < 5);
    assert.equal(
      calibrationConnected(JUDGES, pairedObservations(() => 4, firstFive)),
      false
    );
    assert.equal(calibrationConnected(JUDGES, []), false);
  });
});

describe("ranking", () => {
  const generosity = new Map([
    ["j0", 0.5],
    ["j1", -0.25],
    ["j2", 0],
  ]);

  test("projects with fewer than two submitted assessments stay unranked", () => {
    const results = rankProjects(
      [
        { project: "p1", assessments: [{ judge: "j0", score: 4 }] },
        { project: "p2", assessments: [] },
        {
          project: "p3",
          assessments: [
            { judge: "j0", score: 4 },
            { judge: "j1", score: 4 },
          ],
        },
      ],
      generosity
    );
    assert.equal(must(results[0]).rank, null);
    assert.equal(must(results[0]).rawMean, null);
    assert.equal(must(results[0]).calibratedMean, null);
    assert.equal(must(results[1]).rank, null);
    assert.equal(must(results[2]).rank, 1);
  });

  test("adjusted scores subtract generosity, are not clamped, and keep full precision", () => {
    const [result] = rankProjects(
      [
        {
          project: "p",
          assessments: [
            { judge: "j0", score: 5 },
            { judge: "j1", score: 4.75 },
          ],
        },
      ],
      generosity
    );
    const ranked = must(result);
    approx(must(ranked.rawMean), 4.875);
    approx(must(ranked.assessments[0]).adjusted, 4.5);
    approx(must(ranked.assessments[1]).adjusted, 5);
    approx(must(ranked.calibratedMean), 4.75);
    approx(must(ranked.difference), 0.25);
    const [tiny] = rankProjects(
      [
        {
          project: "q",
          assessments: [
            { judge: "j0", score: 4.25 },
            { judge: "j2", score: 4 },
          ],
        },
      ],
      generosity
    );
    approx(must(must(tiny).calibratedMean), 3.875);
    assert.equal(must(must(tiny).calibratedMean).toFixed(2), "3.88");
  });

  test("exact ties share a rank and the next rank skips", () => {
    const results = rankProjects(
      [
        { project: "a", assessments: [{ judge: "j2", score: 4 }, { judge: "j2", score: 4 }] },
        { project: "b", assessments: [{ judge: "j2", score: 4 }, { judge: "j2", score: 4 }] },
        { project: "c", assessments: [{ judge: "j2", score: 5 }, { judge: "j2", score: 5 }] },
        { project: "d", assessments: [{ judge: "j2", score: 1 }, { judge: "j2", score: 2 }] },
      ],
      new Map()
    );
    const rankOf = (project: string) => must(results.find((row) => row.project === project)).rank;
    assert.equal(rankOf("c"), 1);
    assert.equal(rankOf("a"), 2);
    assert.equal(rankOf("b"), 2);
    assert.equal(rankOf("d"), 4);
  });

  test("rankings stay provisional until every assigned assessment is in", () => {
    assert.equal(judgingComplete(0, 10), false);
    assert.equal(judgingComplete(9, 10), false);
    assert.equal(judgingComplete(10, 10), true);
    assert.equal(judgingComplete(0, 0), false);
  });

  test("disagreement flag uses a configurable threshold", () => {
    assert.equal(isFlagged(1.5, 1.5), true);
    assert.equal(isFlagged(1.25, 1.5), false);
    assert.equal(isFlagged(1.25, 1), true);
    assert.equal(isFlagged(null, 1.5), false);
  });
});
