import { describe, expect, test } from "bun:test";
import type { Doc } from "../_generated/dataModel";
import { effectiveSections, typeRequiresConfirmed } from "./userTypes";

function catalog(
  fields: Pick<Doc<"userTypes">, "sections"> &
    Partial<
      Pick<
        Doc<"userTypes">,
        "label" | "openForApplications" | "requiresConfirmed" | "slug"
      >
    >
): Doc<"userTypes"> {
  return {
    _creationTime: 0,
    _id: "k17userTypes" as Doc<"userTypes">["_id"],
    createdAt: 0,
    createdBy: "k17users" as Doc<"users">["_id"],
    isDefault: false,
    label: "Test",
    slug: "test",
    sortOrder: 0,
    updatedAt: 0,
    ...fields,
  };
}

describe("effectiveSections", () => {
  test("admins see every nav section and never cli", () => {
    expect(effectiveSections({ admin: true, role: "user" }, null)).toEqual([
      "teams",
      "tracks",
      "perks",
      "participantes",
      "judging",
      "judgingSponsors",
    ]);
    expect(effectiveSections({ role: "admin" }, null).includes("cli")).toBe(
      false
    );
  });

  test("checkboxes are the grant; slug and label do not force sections", () => {
    const sponsor = catalog({
      label: "Sponsor",
      slug: "sponsor",
      sections: ["judgingSponsors", "participantes"],
    });
    expect(effectiveSections({ role: "user" }, sponsor)).toEqual([
      "participantes",
      "judgingSponsors",
    ]);
    const namedJudge = catalog({
      label: "Jurado",
      slug: "jurado",
      sections: ["tracks"],
    });
    expect(effectiveSections({ role: "user" }, namedJudge)).toEqual(["tracks"]);
  });

  test("cli stays stored but is not a nav section", () => {
    const hacker = catalog({
      sections: ["teams", "tracks", "perks", "cli"],
    });
    expect(effectiveSections({ role: "user" }, hacker)).toEqual([
      "teams",
      "tracks",
      "perks",
    ]);
  });
});

describe("catalog flags", () => {
  test("requiresConfirmed is on unless explicitly false", () => {
    expect(typeRequiresConfirmed(null)).toBe(true);
    expect(typeRequiresConfirmed(catalog({ sections: [] }))).toBe(true);
    expect(
      typeRequiresConfirmed(catalog({ requiresConfirmed: false, sections: [] }))
    ).toBe(false);
    expect(
      typeRequiresConfirmed(catalog({ requiresConfirmed: true, sections: [] }))
    ).toBe(true);
  });
});
