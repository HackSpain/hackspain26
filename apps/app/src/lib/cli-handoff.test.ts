import { describe, expect, test } from "bun:test";
import {
  cliAuthReturnTo,
  safeCliAuthReturnTo,
  safeNextPath,
} from "./cli-handoff";

describe("safeNextPath", () => {
  test("keeps same-origin dashboard paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/feed")).toBe("/feed");
    expect(safeNextPath("/admin/tracks?tab=2#x")).toBe("/admin/tracks?tab=2#x");
  });

  test("falls back to home for anything that could leave the origin", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("feed")).toBe("/");
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("//evil.example/")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/");
  });
});

describe("cliAuthReturnTo", () => {
  test("keeps the hs-code fragment the CLI puts in the link", () => {
    const returnTo = cliAuthReturnTo({
      pathname: "/cli-auth",
      search: "",
      hash: "#hs-code=abc123",
    });
    expect(returnTo).toBe("/cli-auth#hs-code=abc123");
    // The fragment stays a fragment: no `code` query parameter is produced,
    // since Convex Auth middleware would consume one.
    const url = new URL(returnTo ?? "", "https://app.example");
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.hash).toBe("#hs-code=abc123");
  });

  test("keeps the legacy query form from older CLI versions", () => {
    expect(
      cliAuthReturnTo({
        pathname: "/cli-auth",
        search: "?hs-code=abc123",
        hash: "",
      }),
    ).toBe("/cli-auth?hs-code=abc123");
  });

  test("keeps query and fragment together", () => {
    expect(
      cliAuthReturnTo({
        pathname: "/cli-auth",
        search: "?next=%2Ffeed",
        hash: "#hs-code=abc123",
      }),
    ).toBe("/cli-auth?next=%2Ffeed#hs-code=abc123");
  });

  test("accepts a bare /cli-auth visit", () => {
    expect(
      cliAuthReturnTo({ pathname: "/cli-auth", search: "", hash: "" }),
    ).toBe("/cli-auth");
  });

  test("returns nothing for any other page, fragment or not", () => {
    expect(
      cliAuthReturnTo({ pathname: "/feed", search: "", hash: "#hs-code=x" }),
    ).toBeNull();
    expect(
      cliAuthReturnTo({
        pathname: "/cli-auth/handoff",
        search: "",
        hash: "#hs-token=x",
      }),
    ).toBeNull();
    expect(
      cliAuthReturnTo({ pathname: "/", search: "?hs-code=x", hash: "" }),
    ).toBeNull();
  });
});

describe("safeCliAuthReturnTo", () => {
  test("accepts the approval card with or without query or fragment", () => {
    expect(safeCliAuthReturnTo("/cli-auth")).toBe("/cli-auth");
    expect(safeCliAuthReturnTo("/cli-auth?hs-code=abc")).toBe(
      "/cli-auth?hs-code=abc",
    );
    expect(safeCliAuthReturnTo("/cli-auth#hs-code=abc")).toBe(
      "/cli-auth#hs-code=abc",
    );
    expect(safeCliAuthReturnTo("/cli-auth?next=%2Ffeed#hs-code=abc")).toBe(
      "/cli-auth?next=%2Ffeed#hs-code=abc",
    );
  });

  test("rejects everything outside the allowlist", () => {
    expect(safeCliAuthReturnTo(null)).toBeNull();
    expect(safeCliAuthReturnTo("")).toBeNull();
    expect(safeCliAuthReturnTo("/")).toBeNull();
    expect(safeCliAuthReturnTo("/feed")).toBeNull();
    expect(safeCliAuthReturnTo("/cli-authx")).toBeNull();
    expect(safeCliAuthReturnTo("/cli-auth/handoff#hs-token=abc")).toBeNull();
    expect(safeCliAuthReturnTo("/cli-auth/../admin")).toBeNull();
    expect(safeCliAuthReturnTo("cli-auth#hs-code=abc")).toBeNull();
    expect(safeCliAuthReturnTo("https://evil.example/cli-auth")).toBeNull();
    expect(safeCliAuthReturnTo("//evil.example/cli-auth")).toBeNull();
    expect(safeCliAuthReturnTo("/cli-auth\\@evil.example")).toBeNull();
    expect(safeCliAuthReturnTo(" /cli-auth")).toBeNull();
  });
});
