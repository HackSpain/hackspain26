import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsumptionChart } from "./evolution-charts";
import { EventInsights } from "./event-insights";

test("real consumption shows its controls without invented event phases", () => {
  const markup = renderToStaticMarkup(
    <ConsumptionChart
      color="#35858a"
      samples={[]}
      timeline={{ startsAt: 0, bucketMinutes: 90 }}
    />
  );
  expect(markup).toContain("Tokens por hora");
  expect(markup).toContain("Vista de consumo");
  expect(markup).not.toContain("Arranque");
  expect(markup).not.toContain("Construcción");
  expect(markup).not.toContain("Preparar demo");
});

test("unconfigured evolution keeps the empty state even if samples arrive", () => {
  const markup = renderToStaticMarkup(
    <EventInsights
      samples={[
        {
          bucket: 0,
          cachedTokens: 0,
          commits: 0,
          harness: "codex",
          pullRequests: 0,
          sessions: 1,
          teamId: "team",
          tokens: 100,
        },
      ]}
      teams={[]}
      timeline={{ bucketMinutes: 30 }}
    />
  );
  expect(markup).toContain("Sin datos de actividad todavía.");
  expect(markup).not.toContain("simulados");
});
