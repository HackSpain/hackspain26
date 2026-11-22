import { describe, expect, test } from "bun:test";
import { dashboardHome, route } from "./auth-route";
import type { AuthMe } from "./auth-route";
import { DELIVERIES_PATH, JUDGING_PATH } from "./sections";

function me(extra: Partial<AuthMe> = {}): AuthMe {
  return {
    accepted: true,
    admin: false,
    canJudge: false,
    event: { open: true },
    isRegistered: true,
    onboardingComplete: true,
    profileComplete: true,
    role: "user",
    sections: ["teams", "tracks", "perks"],
    ...extra,
  };
}

describe("dashboardHome", () => {
  test("judges score, sponsors read deliveries, everyone else stays on home", () => {
    expect(dashboardHome(me({ canJudge: true }))).toBe(JUDGING_PATH);
    expect(
      dashboardHome(me({ sections: ["judgingSponsors", "participantes"] }))
    ).toBe(DELIVERIES_PATH);
    expect(dashboardHome(me({ admin: true }))).toBe("/");
    expect(dashboardHome(me())).toBe("/");
  });
});

describe("route", () => {
  test("applicants stay in the accept queue even with a mentor role", () => {
    const applicant = me({
      accepted: false,
      isRegistered: true,
      sections: ["tracks", "participantes"],
    });
    expect(route(applicant, "/")).toBe("/pending");
    expect(route(applicant, "/people")).toBe("/pending");
    expect(route(applicant, "/login")).toBe("/pending");
  });

  test("unregistered and incomplete profiles go to their gates", () => {
    expect(route(me({ isRegistered: false, accepted: false }), "/")).toBe(
      "/unregistered"
    );
    expect(
      route(me({ onboardingComplete: false, profileComplete: false }), "/")
    ).toBe("/onboarding");
    expect(route(me({ profileComplete: false }), "/teams")).toBe("/onboarding");
  });

  test("judges and sponsors land on their dashboards after login", () => {
    expect(route(me({ canJudge: true }), "/login")).toBe(JUDGING_PATH);
    expect(route(me({ sections: ["judgingSponsors"] }), "/login")).toBe(
      DELIVERIES_PATH
    );
    expect(route(me(), "/login")).toBe("/");
  });

  test("admins skip admission and stay out of pending", () => {
    const admin = me({ admin: true, accepted: false, isRegistered: false });
    expect(route(admin, "/pending")).toBe("/");
    expect(route(admin, "/admin")).toBe(null);
    expect(route(admin, "/login")).toBe("/");
  });

  test("admins with an incomplete profile still onboard", () => {
    expect(route(me({ admin: true, profileComplete: false }), "/admin")).toBe(
      "/onboarding"
    );
  });

  test("closed window keeps the allowlist and bounces the rest home", () => {
    const closed = me({ event: { open: false } });
    const directory = me({
      event: { open: false },
      sections: ["participantes"],
    });
    expect(route(closed, "/profile")).toBe(null);
    expect(route(directory, "/people")).toBe(null);
    expect(route(closed, "/teams")).toBe("/");
    expect(route(me({ ...closed, canJudge: true }), "/tracks")).toBe(null);
  });

  test("hidden sections bounce home; admin is never a catalog flag", () => {
    expect(route(me({ sections: ["perks"] }), "/teams")).toBe("/");
    expect(route(me(), "/admin")).toBe("/");
  });
});
