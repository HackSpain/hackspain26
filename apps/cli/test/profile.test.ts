import { describe, expect, test } from "bun:test";
import { profileJson, profileRows } from "../src/commands/profile";
import type { Me } from "../src/lib/me";
import { stripAnsi } from "../src/lib/style";

const base: Me = {
  _id: "u1" as Me["_id"],
  email: "ana@example.com",
  name: "Ana",
  role: "user",
  phone: "+34600111222",
  phoneConfirmed: true,
  notificationConsent: true,
  notificationConsentAt: undefined,
  attendanceStatus: "attending",
  dietaryRestrictions: "Vegetarian",
  dietaryDetails: undefined,
  travelOrigin: "Valencia",
  onboardingComplete: true,
  isRegistered: true,
  accepted: true,
  signupId: undefined,
  githubUsername: "ana",
  githubLinked: true,
};

function row(me: Me, label: string): string {
  return stripAnsi(profileRows(me).find(([k]) => k === label)?.[1] ?? "");
}

describe("profile", () => {
  test("rows read like the dashboard's profile page", () => {
    expect(row(base, "Name")).toBe("Ana");
    expect(row(base, "Phone")).toBe("+34600111222 · confirmed");
    expect(row(base, "GitHub")).toBe("ana · linked");
    expect(row(base, "Event notices")).toBe("on");
    expect(profileRows(base).map(([k]) => k)).not.toContain("Diet details");
  });

  test("missing pieces point at the command that fills them", () => {
    const me: Me = {
      ...base,
      phone: undefined,
      phoneConfirmed: false,
      name: undefined,
      dietaryRestrictions: undefined,
      dietaryDetails: "no nuts",
      notificationConsent: false,
      githubLinked: false,
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
      "phoneConfirmed",
      "notificationConsent",
      "githubUsername",
      "githubLinked",
    ]);
  });
});
