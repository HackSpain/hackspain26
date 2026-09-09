import assert from "node:assert/strict";
import { test } from "node:test";
import { INSIGHTS_LAYOUT } from "../../convex/lib/tvLayouts";
import { layoutTvBox, tvFontSizeClass, tvFontSizePixels, tvFontSizeStyle } from "./tv";

test("custom pixels scale from the same 1920px canvas in preview and TV", () => {
  assert.deepEqual(tvFontSizeStyle(48), { fontSize: "2.5cqw" });
  assert.equal(tvFontSizeClass("banner", 48), "");
  for (const invalid of [NaN, Infinity, 0, 7, 241]) {
    assert.equal(tvFontSizeStyle(invalid), undefined);
  }
});

test("legacy text presets keep their classes until edited", () => {
  assert.equal(tvFontSizeStyle(1.1), undefined);
  assert.ok(tvFontSizeClass("banner", 1.1).includes("clamp"));
  assert.equal(tvFontSizePixels("banner", 1.1), 28);
  assert.equal(tvFontSizePixels("clock", 55), 55);
});

test("default reset layout fits the canvas and has no team leaderboards", () => {
  assert.equal(INSIGHTS_LAYOUT.length, 7);
  for (const widget of INSIGHTS_LAYOUT) {
    assert.ok(!widget.kind.toLowerCase().includes("leaderboard"));
    const { x, y, w, h } = widget;
    assert.deepEqual(layoutTvBox(widget), { x, y, w, h });
  }
});
