import type { Infer } from "convex/values";
import type { widgetReturn } from "../tv";

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
] satisfies Omit<Infer<typeof widgetReturn>, "_id">[];
