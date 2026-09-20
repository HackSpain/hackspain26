import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { TvInsights } from "@/app/api/tv/insights/load";

/** Unlinked, not secret: the repo is public. Both serve event-wide counts only. */
export const CLOSING_KEY = "8342edd24312bc1db780b448ef1a0de0178b7a25";
export const CLOSING_PATH = `/cierre-hackspain-2026-${CLOSING_KEY}`;
export const CLOSING_API_PATH = `/api/cierre/${CLOSING_KEY}`;

export type ClosingData = {
  insights: TvInsights;
  totals: FunctionReturnType<typeof api.closing.stats>;
  generatedAt: number;
};
