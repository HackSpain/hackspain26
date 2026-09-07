import { describe, expect, test } from "bun:test";
import { formatMember, parseMember } from "../src/lib/members";

describe("parseMember", () => {
  test("explicit types", () => {
    expect(parseMember("github:octocat")).toEqual({
      identifierType: "github",
      identifier: "octocat",
    });
    expect(parseMember("EMAIL: a@b.c ")).toEqual({
      identifierType: "email",
      identifier: "a@b.c",
    });
    expect(parseMember("twitter:@h")).toEqual({
      identifierType: "twitter",
      identifier: "@h",
    });
  });

  test("bare values are inferred", () => {
    expect(parseMember("a@b.c").identifierType).toBe("email");
    expect(parseMember("@handle").identifierType).toBe("twitter");
    expect(parseMember("octocat").identifierType).toBe("github");
  });

  test("rejects unknown types and empty values", () => {
    expect(() => parseMember("slack:foo")).toThrow("Unknown member type");
    expect(() => parseMember("github:")).toThrow("Missing identifier");
    expect(() => parseMember("  ")).toThrow("Empty");
  });

  test("formats back", () => {
    expect(formatMember({ identifierType: "github", identifier: "o" })).toBe(
      "github:o"
    );
    expect(formatMember({ identifierType: "email", identifier: "a@b.c" })).toBe(
      "a@b.c"
    );
  });
});
