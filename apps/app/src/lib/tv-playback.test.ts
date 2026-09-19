import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldApplyPoll, shouldApplyScreenConfig, shouldReloadTv } from "./tv-playback";
import type { ScreenConfig } from "@convex/lib/tvScreens";

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

test("initial and newer screen configurations can be applied", () => {
  const config: ScreenConfig = { preset: "avisos", message: "Hola", revision: 4, reloadVersion: 2 };
  assert.equal(shouldApplyScreenConfig(undefined, config), true);
  assert.equal(shouldApplyScreenConfig(config, config), true);
  assert.equal(shouldApplyScreenConfig(config, { ...config, revision: 5 }), true);
  assert.equal(shouldApplyScreenConfig(config, { ...config, reloadVersion: 3 }), true);
});

test("neither transport can roll back an applied configuration or reload command", () => {
  const config: ScreenConfig = { preset: "avisos", message: "Hola", revision: 4, reloadVersion: 2 };
  assert.equal(shouldApplyScreenConfig(config, { ...config, revision: 3 }), false);
  assert.equal(shouldApplyScreenConfig(config, { ...config, reloadVersion: 1 }), false);
  assert.equal(shouldApplyScreenConfig(config, { ...config, revision: 5, reloadVersion: 1 }), false);
  assert.equal(shouldApplyScreenConfig(config, { ...config, revision: 3, reloadVersion: 3 }), false);
});
