import assert from "node:assert/strict";
import { test } from "node:test";
import { isSubmitFeatured } from "./event";

test("submission highlight follows the configured deadline's final three hours", () => {
  const original = Date.parse("2026-09-20T11:00:00+02:00");
  const moved = Date.parse("2026-10-20T11:00:00+02:00");
  const threeHours = 3 * 60 * 60 * 1000;
  assert.equal(isSubmitFeatured(original, original - threeHours - 1), false);
  assert.equal(isSubmitFeatured(original, original - threeHours), true);
  assert.equal(isSubmitFeatured(moved, original), false);
  assert.equal(isSubmitFeatured(moved, moved - threeHours), true);
  assert.equal(isSubmitFeatured(moved, moved), false);
  assert.equal(isSubmitFeatured(undefined, moved), false);
});
