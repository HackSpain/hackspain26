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
    w: 44,
    h: 11,
    z: 1,
    text: "HackSpain · En directo",
    fontSize: 1.5,
  },
  { kind: "clock", x: 48, y: 1, w: 50, h: 11, z: 1, text: "event", fontSize: 1.5 },
  { kind: "liveTokens", x: 2, y: 14, w: 62, h: 20, z: 1, text: "" },
  { kind: "liveLeaderboard", x: 2, y: 36, w: 30, h: 53, z: 1, text: "" },
  { kind: "liveAgents", x: 34, y: 36, w: 30, h: 53, z: 1, text: "" },
  {
    kind: "feed",
    x: 66,
    y: 14,
    w: 32,
    h: 75,
    z: 1,
    text: "",
    feedMode: "latest",
    feedSource: "all",
  },
  { kind: "sponsorTicker", x: 0, y: 91, w: 100, h: 9, z: 1, text: "logos" },
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
