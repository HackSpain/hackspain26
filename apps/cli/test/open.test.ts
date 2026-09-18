import { describe, expect, test } from "bun:test";
import { handoffUrl, normalizeDashboardPath } from "../src/commands/open";
import { CliError } from "../src/lib/errors";

describe("normalizeDashboardPath", () => {
  test("defaults to home and understands friendly names", () => {
    expect(normalizeDashboardPath()).toBe("/");
    expect(normalizeDashboardPath("  ")).toBe("/");
    expect(normalizeDashboardPath("feed")).toBe("/feed");
    expect(normalizeDashboardPath("Team")).toBe("/teams");
    expect(normalizeDashboardPath("perks")).toBe("/perks");
  });

  test("passes explicit dashboard paths through", () => {
    expect(normalizeDashboardPath("/admin/tracks?tab=2")).toBe(
      "/admin/tracks?tab=2"
    );
  });

  test("refuses anything that is not a same-origin path", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\x",
      "nope",
    ]) {
      expect(() => normalizeDashboardPath(bad)).toThrow(CliError);
    }
  });
});

describe("handoffUrl", () => {
  test("keeps the token out of the request and the page under next", () => {
    const url = new URL(handoffUrl("https://app.test", "t0k_en-1", "/feed"));
    expect(url.origin).toBe("https://app.test");
    expect(url.pathname).toBe("/cli-auth/handoff");
    expect(url.searchParams.has("hs-token")).toBe(false);
    expect(url.searchParams.get("next")).toBe("/feed");
    expect(new URLSearchParams(url.hash.slice(1)).get("hs-token")).toBe(
      "t0k_en-1"
    );
  });

  test("omits next for the home page", () => {
    const url = new URL(handoffUrl("http://localhost:3000", "abc", "/"));
    expect(url.searchParams.has("next")).toBe(false);
  });
});
