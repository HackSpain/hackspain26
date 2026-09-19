import assert from "node:assert/strict";
import { test } from "node:test";
import { MENTORS, PRESENT_MENTOR_IDS, presentMentors } from "./mentors";

test("landing mentor names stay unique and complete", () => {
  const ids = MENTORS.map((mentor) => mentor.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(MENTORS.length, 7);
  assert.deepEqual(
    MENTORS.map((mentor) => mentor.name),
    [
      "Maex Ament",
      "Miguel Carranza",
      "Joan Rodríguez",
      "Kintxo Cortés",
      "David Gomes",
      "Guillermo García Cobo",
      "Mark Villacampa",
    ],
  );
});

test("presentMentors keeps landing order and only listed ids", () => {
  const present = presentMentors();
  assert.equal(present.length, PRESENT_MENTOR_IDS.length);
  assert.deepEqual(
    present.map((mentor) => mentor.id),
    [...PRESENT_MENTOR_IDS],
  );
});
