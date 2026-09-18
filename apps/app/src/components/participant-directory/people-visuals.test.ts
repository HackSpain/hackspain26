import { test } from "node:test";
import assert from "node:assert/strict";
import { ease, REST, targetFor } from "./people-visuals";

test("targets follow the old CSS: dim the rest, grow and name the active one", () => {
	assert.deepEqual(targetFor("", "rest", false), REST);
	assert.deepEqual(targetFor("active", "focus", false), {
		alpha: 1,
		gold: 0,
		halo: 1,
		name: 1,
		scale: 1.35,
	});
	assert.equal(targetFor("linked", "focus", false).scale, 1.12);
	assert.equal(targetFor("", "focus", false).alpha, 0.2);
	assert.equal(targetFor("", "peek", true).alpha, 0.2);
	assert.equal(targetFor("", "peek", true).scale, 1.35);
	assert.equal(targetFor("match", "search", false).gold, 1);
	assert.equal(targetFor("", "search", false).alpha, 0.16);
});

test("easing converges and reports when it is done", () => {
	const visual = { ...REST };
	const target = targetFor("active", "focus", false);
	assert.equal(ease(visual, target, 16, false), true);
	assert.ok(visual.scale > 1 && visual.scale < 1.35);
	let frames = 1;
	while (ease(visual, target, 16, false)) {
		frames++;
	}
	assert.ok(frames < 40, `settled in ${frames} frames`);
	assert.deepEqual(visual, target);
	const snapped = { ...REST };
	assert.equal(ease(snapped, target, 16, true), true);
	assert.deepEqual(snapped, target);
	assert.equal(ease(snapped, target, 16, true), false);
});
