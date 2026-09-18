import type { Infer } from "convex/values";
import type { widgetReturn } from "../tv";

type LayoutWidget = Omit<Infer<typeof widgetReturn>, "_id">;

// Percentages on Leo's editable canvas, with gutters and a permanent demo label.
export const INSIGHTS_LAYOUT = [
  {
    kind: "banner",
    x: 2,
    y: 1,
    w: 78,
    h: 8,
    z: 1,
    text: "HackSpain · Dentro del hackathon",
    fontSize: 1.1,
  },
  { kind: "clock", x: 84, y: 1, w: 14, h: 8, z: 1, text: "", fontSize: 1.5 },
  { kind: "insightsStats", x: 2, y: 11, w: 96, h: 17, z: 1, text: "" },
  { kind: "insightsActivity", x: 2, y: 30, w: 96, h: 31, z: 1, text: "" },
  { kind: "insightsHarness", x: 2, y: 63, w: 47, h: 27, z: 1, text: "" },
  { kind: "insightsStacks", x: 51, y: 63, w: 47, h: 27, z: 1, text: "" },
  {
    kind: "banner",
    x: 2,
    y: 92,
    w: 96,
    h: 8,
    z: 1,
    text: "Vista demo · Equipos y métricas simulados · Madrid 2026",
    fontSize: 0.85,
  },
] satisfies LayoutWidget[];

export const PANEL_V2_LAYOUT = [
  {
    kind: "banner",
    x: 2,
    y: 1,
    w: 78,
    h: 10,
    z: 1,
    text: "HackSpain · En directo",
    fontSize: 1.5,
  },
  { kind: "clock", x: 84, y: 1, w: 14, h: 10, z: 1, text: "", fontSize: 1.5 },
  { kind: "liveTokens", x: 2, y: 13, w: 30, h: 22, z: 1, text: "" },
  { kind: "liveAgents", x: 34, y: 13, w: 32, h: 40, z: 1, text: "" },
  {
    kind: "feed",
    x: 68,
    y: 13,
    w: 30,
    h: 76,
    z: 1,
    text: "",
    feedMode: "latest",
    feedSource: "all",
  },
  { kind: "liveLeaderboard", x: 2, y: 37, w: 30, h: 52, z: 1, text: "" },
  { kind: "liveCommits", x: 34, y: 55, w: 32, h: 34, z: 1, text: "" },
  {
    kind: "ticker",
    x: 0,
    y: 91,
    w: 100,
    h: 9,
    z: 1,
    text: "HackSpain 2026 · Madrid · 42 equipos hackeando",
    fontSize: 1.1,
  },
] satisfies LayoutWidget[];

export const TV_LAYOUT_PRESETS = {
  insights: INSIGHTS_LAYOUT,
  panelv2: PANEL_V2_LAYOUT,
} as const;

export type TvLayoutPreset = keyof typeof TV_LAYOUT_PRESETS;

export function tvPresetWidgets(preset: TvLayoutPreset) {
  return TV_LAYOUT_PRESETS[preset].map((widget, index) => ({
    ...widget,
    _id: `${preset}-${index}`,
  }));
}
