import { sumSamples } from "./mock-data";
import type { Sample, Totals } from "./mock-data";

export const PHASES = [
  { color: "#35858a", end: 120, id: "start", name: "Arranque", start: 0 },
  { color: "#1e3958", end: 540, id: "build", name: "Construcción", start: 120 },
  { color: "#d96b2a", end: 720, id: "demo", name: "Preparar demo", start: 540 },
] as const;

// Fictional pricing for the mock. This is not a provider's price schedule.
export function usageUsd(
  totals: Pick<Totals, "tokens" | "cachedTokens">
): number {
  return (
    ((totals.tokens - totals.cachedTokens) * 4 + totals.cachedTokens * 0.5) /
    1_000_000
  );
}

export function phaseRows(samples: Sample[]) {
  return PHASES.map((phase) => {
    const rows = samples.filter(
      (sample) =>
        sample.bucket * 30 >= phase.start && sample.bucket * 30 < phase.end
    );
    const totals = sumSamples(rows);
    return {
      ...phase,
      ...totals,
      cost: usageUsd(totals),
      hourlyTokens: totals.tokens / ((phase.end - phase.start) / 60),
    };
  });
}
