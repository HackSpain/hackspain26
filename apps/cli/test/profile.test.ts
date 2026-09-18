import { describe, expect, test } from "bun:test";
import {
  profileJson,
  profileNudge,
  profileRows,
} from "../src/commands/profile";
import type { Me } from "../src/lib/me";
import { stripAnsi } from "../src/lib/style";
import { normalizeX, validateX } from "../src/lib/x-handle";

const base: Me = {
  _id: "u1" as Me["_id"],
  accepted: true,
  attendanceStatus: "attending",
  avatarUrl: undefined,
  canJudge: false,
  canRemoveAvatar: false,
  dietaryDetails: undefined,
  dietaryRestrictions: "Vegetarian",
  email: "ana@example.com",
  event: {
    endsAt: undefined,
    open: true,
    phase: "unscheduled",
    startsAt: undefined,
  },
  githubCanReadRepos: true,
  githubLinked: true,
  githubUsername: "ana",
  isRegistered: true,
  name: "Ana",
  notificationConsent: true,
  notificationConsentAt: undefined,
  onboardingComplete: true,
  phone: "+34600111222",
  profileComplete: true,
  profileMissing: [],
  role: "user",
  sections: ["teams", "tracks", "perks", "participantes", "cli"],
  signupId: undefined,
  suggestedTwitterHandle: undefined,
  travelOrigin: "Valencia",
  twitterHandle: undefined,
  userType: undefined,
};

function row(me: Me, label: string): string {
  return stripAnsi(profileRows(me).find(([k]) => k === label)?.[1] ?? "");
}

describe("profile", () => {
  test("rows read like the dashboard's profile page", () => {
    expect(row(base, "Name")).toBe("Ana");
    expect(row(base, "Phone")).toBe("+34600111222");
    expect(row(base, "GitHub")).toBe("ana · linked");
    expect(row(base, "Event notices")).toBe("on");
    expect(profileRows(base).map(([k]) => k)).not.toContain("Diet details");
  });

  test("missing pieces point at the command that fills them", () => {
    const me: Me = {
      ...base,
      dietaryDetails: "no nuts",
      dietaryRestrictions: undefined,
      githubLinked: false,
      name: undefined,
      notificationConsent: false,
      phone: undefined,
    };
    expect(row(me, "Name")).toContain("hackspain profile edit");
    expect(row(me, "Phone")).toContain("hackspain profile phone");
    expect(row(me, "Diet")).toContain("hackspain profile edit");
    expect(row(me, "Diet details")).toBe("no nuts");
    expect(row(me, "Event notices")).toContain("off");
    expect(row(me, "GitHub")).toContain("not linked");
  });

  test("json output is the editable subset only", () => {
    expect(Object.keys(profileJson(base))).toEqual([
      "name",
      "email",
      "dietaryRestrictions",
      "dietaryDetails",
      "travelOrigin",
      "phone",
      "notificationConsent",
      "githubUsername",
      "githubLinked",
      "twitterHandle",
      "profileMissing",
    ]);
  });

  test("X handle: saved, suggested from the signup, or missing", () => {
    expect(row({ ...base, twitterHandle: "ana_dev" }, "X")).toBe("@ana_dev");
    expect(row({ ...base, suggestedTwitterHandle: "ana_dev" }, "X")).toContain(
      "not saved"
    );
    expect(row(base, "X")).toContain("hackspain profile x");
  });

  test("X handles follow the dashboard's rules", () => {
    expect(normalizeX("@Ana_Dev")).toBe("ana_dev");
    expect(normalizeX("https://x.com/ana_dev?s=21")).toBe("ana_dev");
    expect(validateX("ana_dev")).toBeUndefined();
    expect(validateX("ana-dev!")).toBeDefined();
    expect(validateX("a".repeat(16))).toBeDefined();
  });

  test("photo and card are dashboard steps, nudged while missing", () => {
    expect(row(base, "Photo")).toBe("done");
    expect(profileNudge(base)).toBeUndefined();
    const me: Me = {
      ...base,
      profileComplete: false,
      profileMissing: ["photo", "directory"],
    };
    expect(row(me, "Photo")).toContain("hackspain open onboarding");
    expect(row(me, "Participant card")).toContain("missing");
    expect(stripAnsi(profileNudge(me) ?? "")).toContain(
      "a photo and your participant card"
    );
  });
});
