import { describe, expect, test } from "bun:test";
import type { Session } from "../src/lib/api";
import { EXIT, explainError, UNREGISTERED_HINT } from "../src/lib/errors";
import type { Me } from "../src/lib/me";
import {
  closedEventMessage,
  describeGate,
  requireOnboarded,
} from "../src/lib/me";

const OCT_3_10_00_MADRID = Date.UTC(2026, 9, 3, 8, 0); // CEST = UTC+2
const OCT_5_18_00_MADRID = Date.UTC(2026, 9, 5, 16, 0);

const ready: Me = {
  _id: "u1" as Me["_id"],
  accepted: true,
  attendanceStatus: "attending",
  avatarUrl: undefined,
  canJudge: false,
  canRemoveAvatar: false,
  dietaryDetails: undefined,
  dietaryRestrictions: "",
  email: "ana@example.com",
  event: {
    endsAt: undefined,
    open: true,
    phase: "unscheduled",
    startsAt: undefined,
  },
  githubCanReadRepos: false,
  githubLinked: true,
  githubUsername: "ana",
  isRegistered: true,
  name: "Ana",
  notificationConsent: true,
  notificationConsentAt: undefined,
  onboardingComplete: true,
  phone: undefined,
  profileComplete: true,
  profileMissing: [],
  role: "user",
  sections: ["teams", "tracks", "perks", "cli"],
  signupId: undefined,
  suggestedTwitterHandle: undefined,
  travelOrigin: undefined,
  twitterHandle: undefined,
  userType: undefined,
};

const before: Me = {
  ...ready,
  event: {
    endsAt: OCT_5_18_00_MADRID,
    open: false,
    phase: "before",
    startsAt: OCT_3_10_00_MADRID,
  },
};

const after: Me = {
  ...before,
  event: { ...before.event, phase: "after" },
};

function sessionFor(me: Me): Session {
  return {
    authenticated: true,
    client: { query: async () => me },
  } as unknown as Session;
}

describe("describeGate outside the hackathon window", () => {
  test("unregistered accounts get the closed-signup hint", () => {
    const gate = describeGate({ ...after, isRegistered: false });
    expect(gate.state).toBe("unregistered");
    expect(gate.hint).toBe(UNREGISTERED_HINT);
    expect(gate.hint).not.toContain("/signup");
  });

  test("before the start: closed, with the opening date in Madrid time", () => {
    const gate = describeGate(before);
    expect(gate.state).toBe("closed");
    expect(gate.message).toBe(
      "The hackathon has not started yet. It opens on Sat 3 Oct, 10:00 (Madrid)."
    );
    expect(gate.hint).toContain("hackspain profile");
  });

  test("after the end: closed, with the closing date", () => {
    expect(describeGate(after).message).toBe(
      "The hackathon ended on Mon 5 Oct, 18:00 (Madrid)."
    );
    expect(
      closedEventMessage({
        endsAt: undefined,
        open: false,
        phase: "unscheduled",
        startsAt: undefined,
      })
    ).toBe("The hackathon is not running right now.");
  });

  test("onboarding gates still come first", () => {
    expect(describeGate({ ...before, onboardingComplete: false }).state).toBe(
      "onboarding"
    );
  });

  test("admins are never closed", () => {
    expect(
      describeGate({
        ...before,
        event: { ...before.event, open: true },
        role: "admin",
      }).state
    ).toBe("admin");
  });

  test("requireOnboarded fails fast with EVENT_CLOSED and exit 4", async () => {
    await expect(requireOnboarded(sessionFor(after))).rejects.toMatchObject({
      code: "EVENT_CLOSED",
      exitCode: EXIT.INELIGIBLE,
    });
    await expect(requireOnboarded(sessionFor(ready))).resolves.toBe(ready);
  });

  test("anytime commands opt into the closed window but not the other gates", async () => {
    await expect(
      requireOnboarded(sessionFor(after), { allowClosed: true })
    ).resolves.toBe(after);
    await expect(
      requireOnboarded(sessionFor({ ...after, accepted: false }), {
        allowClosed: true,
      })
    ).rejects.toMatchObject({ code: "NOT_ACCEPTED" });
  });

  test("local gate codes match the same server gate failures", async () => {
    const cases = [
      {
        code: "NOT_REGISTERED",
        me: { ...ready, isRegistered: false },
        serverMessage: "No hay inscripción a la hackathon con este email",
      },
      {
        code: "NOT_ACCEPTED",
        me: { ...ready, accepted: false },
        serverMessage: "Aún no te han aceptado",
      },
      {
        code: "NOT_ONBOARDED",
        me: { ...ready, onboardingComplete: false },
        serverMessage: "Confirma tus datos primero",
      },
    ];

    for (const { code, me, serverMessage } of cases) {
      const relayed = explainError(new Error(serverMessage));
      expect(relayed.code).toBe(code);
      await expect(requireOnboarded(sessionFor(me))).rejects.toMatchObject({
        code: relayed.code,
        exitCode: relayed.exitCode,
      });
    }
  });
});
