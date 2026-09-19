import assert from "node:assert/strict";
import { test } from "node:test";
import { INSIGHTS_LAYOUT, PANEL_V2_LAYOUT } from "../../convex/lib/tvLayouts";
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

test("panelv2 layout fits the canvas and keeps live CLI widgets", () => {
  assert.equal(PANEL_V2_LAYOUT.length, 9);
  const kinds = new Set(PANEL_V2_LAYOUT.map((widget) => widget.kind));
  for (const kind of ["liveTokens", "liveAgents", "liveModels", "liveCommitPulse", "liveLeaderboard", "feed", "sponsorTicker"]) {
    assert.ok(kinds.has(kind));
  }
  assert.equal(PANEL_V2_LAYOUT.some((widget) => widget.kind === "clock" && widget.text === "event"), true);
  assert.equal(PANEL_V2_LAYOUT.some((widget) => widget.kind === "banner" && widget.text === "logo"), true);
  // Commits ride inside the feed, and the strip is logos only like the v1 panel.
  assert.equal(PANEL_V2_LAYOUT.some((widget) => widget.kind === "feed" && widget.feedSource === "all"), true);
  assert.equal(PANEL_V2_LAYOUT.some((widget) => widget.kind === "sponsorTicker" && widget.text === "logos"), true);
  for (const widget of PANEL_V2_LAYOUT) {
    const { x, y, w, h } = widget;
    assert.deepEqual(layoutTvBox(widget), { x, y, w, h });
  }
});
