import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldApplyPoll, shouldReloadTv } from "./tv-playback";

test("old polling snapshots cannot replace a new subscription", () => {
  assert.equal(shouldApplyPoll(2, 3), false);
  assert.equal(shouldApplyPoll(3, 3), true);
});
test("fresh tabs adopt reload baseline and repeated commands do not loop", () => {
  assert.equal(shouldReloadTv(null, 12), false);
  assert.equal(shouldReloadTv(12, 12), false);
  assert.equal(shouldReloadTv(12, 11), false);
  assert.equal(shouldReloadTv(12, 13), true);
  assert.equal(shouldReloadTv(13, 13), false);
});
