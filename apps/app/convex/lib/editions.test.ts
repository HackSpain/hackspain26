import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import { belongsToEdition, ofEdition } from "./editions";

const editionA = "editions:2026" as Id<"editions">;
const editionB = "editions:2027" as Id<"editions">;

describe("edition scoping", () => {
  test("ofEdition keeps only rows for that edition", () => {
    const rows = [
      { _id: "a", editionId: editionA },
      { _id: "b", editionId: editionB },
      { _id: "c", editionId: editionA },
    ];
    expect(ofEdition(rows, editionA).map((row) => row._id)).toEqual(["a", "c"]);
  });

  test("belongsToEdition is a strict id match", () => {
    expect(belongsToEdition({ editionId: editionA }, editionA)).toBe(true);
    expect(belongsToEdition({ editionId: editionB }, editionA)).toBe(false);
  });
});
