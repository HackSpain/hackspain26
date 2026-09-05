import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError, usageError } from "../lib/errors";
import type { Me } from "../lib/me";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { confirmOrFlag, pickOne, textOrFlag } from "../lib/prompts";
import { c, cmd, highlight } from "../lib/style";

/**
 * `hackspain profile`: the same five things the dashboard's profile page
 * edits (attendance, diet and travel, phone, event notices, GitHub), so a
 * hacker never has to leave the terminal to keep organisers informed.
 */
const E164 = /^\+[1-9]\d{6,14}$/;
const PHONE_CODE = /^\d{4,8}$/;

type Attendance = "attending" | "cancelled";

const PHONE_FAILURES: Record<string, string> = {
  no_challenge: "No code was requested. Run `hackspain profile phone` again.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many attempts. Request a new code.",
  incorrect: "That code is not right.",
};

function attendanceLabel(me: Me): string {
  switch (me.attendanceStatus) {
    case "attending":
      return c.gold("attending");
    case "cancelled":
      return c.red("not coming");
    default:
      return c.dim("undecided");
  }
}

function phoneLabel(me: Me): string {
  if (!me.phone) {
    return c.dim("not set · hackspain profile phone <number>");
  }
  return me.phoneConfirmed
    ? `${me.phone} ${c.dim("· confirmed")}`
    : `${me.phone} ${c.dim("· not confirmed")}`;
}

function githubLabel(me: Me): string {
  if (me.githubLinked && me.githubUsername) {
    return `${me.githubUsername} ${c.dim("· linked")}`;
  }
  if (me.githubUsername) {
    return `${me.githubUsername} ${c.dim("· from your signup, not linked · hackspain profile github")}`;
  }
  return c.dim("not linked · hackspain profile github");
}

export function profileRows(me: Me): [string, string][] {
  return [
    ["Name", me.name ?? c.dim("–")],
    ["Email", me.email ?? c.dim("–")],
    ["Attendance", attendanceLabel(me)],
    [
      "Diet",
      me.dietaryRestrictions ?? c.dim("not set · hackspain profile edit"),
    ],
    ...(me.dietaryDetails
      ? ([["Diet details", me.dietaryDetails]] as [string, string][])
      : []),
    [
      "Travelling from",
      me.travelOrigin ?? c.dim("not set · hackspain profile edit"),
    ],
    ["Phone", phoneLabel(me)],
    [
      "Event notices",
      me.notificationConsent
        ? "on"
        : c.dim("off · hackspain profile notify on"),
    ],
    ["GitHub", githubLabel(me)],
  ];
}

export function profileJson(me: Me) {
  return {
    name: me.name,
    email: me.email,
    attendanceStatus: me.attendanceStatus,
    dietaryRestrictions: me.dietaryRestrictions,
    dietaryDetails: me.dietaryDetails,
    travelOrigin: me.travelOrigin,
    phone: me.phone,
    phoneConfirmed: me.phoneConfirmed,
    notificationConsent: me.notificationConsent,
    githubUsername: me.githubUsername,
    githubLinked: me.githubLinked,
  };
}

async function showProfile(command: Command): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { me } = await openParticipant(ctx);
  ui.result(profileJson(me));
  ui.intro("profile");
  ui.kv(profileRows(me));
  ui.next([
    ["hackspain profile edit", "diet and where you travel from"],
    ["hackspain profile attendance", "tell us if plans change"],
    ["hackspain profile phone <number>", "so we can reach you at the venue"],
  ]);
}

type EditOptions = { diet?: string; dietDetails?: string; from?: string };

async function editProfile(opts: EditOptions, command: Command): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openParticipant(ctx);
  ui.intro("profile · edit");
  const dietaryRestrictions = await textOrFlag(ctx, opts.diet, {
    flag: "--diet",
    message: "Dietary restrictions (write None if you have none)",
    placeholder: "None, vegetarian, vegan, allergies…",
    initialValue: me.dietaryRestrictions ?? "",
    validate: (v) => (v.trim() ? undefined : "Say None if there are none."),
  });
  const dietaryDetails = await textOrFlag(ctx, opts.dietDetails, {
    flag: "--diet-details",
    message: "Anything else about your diet? (optional)",
    initialValue: me.dietaryDetails ?? "",
    optional: true,
  });
  const travelOrigin = await textOrFlag(ctx, opts.from, {
    flag: "--from",
    message: "Where are you travelling from?",
    placeholder: "City or region",
    initialValue: me.travelOrigin ?? "",
    validate: (v) => (v.trim() ? undefined : "We need a city or region."),
  });
  await ui.spin(
    "Saving…",
    () =>
      session.client.mutation(api.users.updateEventDetails, {
        dietaryRestrictions: dietaryRestrictions.trim(),
        dietaryDetails: dietaryDetails.trim() || undefined,
        travelOrigin: travelOrigin.trim(),
      }),
    "Saved"
  );
  ui.result({
    dietaryRestrictions: dietaryRestrictions.trim(),
    dietaryDetails: dietaryDetails.trim() || undefined,
    travelOrigin: travelOrigin.trim(),
  });
  ui.success("Profile updated. Organisers see it straight away.");
}

async function setAttendance(
  status: string | undefined,
  opts: { yes?: boolean },
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openParticipant(ctx);
  if (
    status !== undefined &&
    status !== "attending" &&
    status !== "cancelled"
  ) {
    throw usageError(
      `Attendance must be "attending" or "cancelled", got "${status}".`
    );
  }
  const choice = await pickOne<Attendance>(
    ctx,
    status as Attendance | undefined,
    {
      flag: "<attending|cancelled>",
      message: "Are you coming to HackSpain?",
      choices: [
        { value: "attending", label: "Yes, I am attending" },
        { value: "cancelled", label: "No, I cannot make it" },
      ],
    }
  );
  if (choice === "cancelled" && me.attendanceStatus !== "cancelled") {
    const ok = await confirmOrFlag(ctx, opts.yes, {
      flag: "--yes",
      message:
        "Mark yourself as not coming? Your spot may be offered to someone on the waitlist.",
      initialValue: false,
    });
    if (!ok) {
      ui.info("Kept your attendance as it was.");
      return;
    }
  }
  await ui.spin(
    "Saving…",
    () =>
      session.client.mutation(api.users.setAttendance, {
        attendanceStatus: choice,
      }),
    "Saved"
  );
  ui.result({ attendanceStatus: choice });
  if (choice === "attending") {
    ui.celebrate("See you at HackSpain!");
  } else {
    ui.success(
      "Noted. If plans change, run `hackspain profile attendance attending`."
    );
  }
}

async function setNotify(
  value: string,
  _opts: unknown,
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  if (value !== "on" && value !== "off") {
    throw usageError(`Use "on" or "off", got "${value}".`);
  }
  const { session } = await openParticipant(ctx);
  const consent = value === "on";
  await ui.spin(
    "Saving…",
    () =>
      session.client.mutation(api.users.setNotificationConsent, { consent }),
    "Saved"
  );
  ui.result({ notificationConsent: consent });
  ui.success(
    consent
      ? "Event notices on. Schedule changes and reminders reach you by email and phone."
      : "Event notices off. You still get announcements in `hackspain watch`."
  );
}

async function confirmPhone(
  number: string | undefined,
  opts: { code?: string },
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openParticipant(ctx);
  ui.intro("profile · phone");
  const phone = (
    await textOrFlag(ctx, number, {
      flag: "<number>",
      message: "Your mobile number, international format",
      placeholder: "+34 600 111 222",
      initialValue: me.phone ?? "",
      validate: (v) =>
        E164.test(v.replace(/[\s()-]/g, ""))
          ? undefined
          : "Use the international format, like +34600111222.",
    })
  ).replace(/[\s()-]/g, "");
  const requested = await ui.spin(
    "Sending a code…",
    () => session.client.mutation(api.onboarding.requestPhoneCode, { phone }),
    "Code sent"
  );
  if (requested.delivery === "stub") {
    ui.warn(
      `SMS is not configured on this server; the code is ${highlight(requested.debugCode ?? "?")}.`
    );
  }
  const code = await textOrFlag(ctx, opts.code, {
    flag: "--code",
    message: `Enter the code we sent to ${phone}`,
    placeholder: "000000",
    validate: (v) => (PHONE_CODE.test(v.trim()) ? undefined : "Digits only."),
  });
  const verified = await ui.spin(
    "Checking…",
    () =>
      session.client.mutation(api.onboarding.verifyPhoneCode, {
        code: code.trim(),
      }),
    "Checked"
  );
  if (!verified.ok) {
    throw new CliError(
      PHONE_FAILURES[verified.reason] ?? "Could not confirm the phone.",
      {
        code: "BAD_OTP",
      }
    );
  }
  ui.result({ phone, phoneConfirmed: true });
  ui.celebrate(`${phone} confirmed. Organisers can reach you at the venue.`);
}

async function linkGithub(
  opts: { unlink?: boolean; yes?: boolean },
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openParticipant(ctx);
  if (opts.unlink) {
    if (!me.githubLinked) {
      ui.info("No GitHub account is linked.");
      return;
    }
    const ok = await confirmOrFlag(ctx, opts.yes, {
      flag: "--yes",
      message: `Unlink ${me.githubUsername ?? "your GitHub account"}?`,
      initialValue: false,
    });
    if (!ok) {
      ui.info("Kept it linked.");
      return;
    }
    await ui.spin(
      "Unlinking…",
      () => session.client.mutation(api.github.unlink, {}),
      "Unlinked"
    );
    ui.result({ githubLinked: false });
    ui.success("GitHub unlinked.");
    return;
  }
  if (me.githubLinked) {
    ui.result({ githubLinked: true, githubUsername: me.githubUsername });
    ui.info(
      `Already linked as ${highlight(me.githubUsername ?? "?")}. Use ${cmd("--unlink")} to change it.`
    );
    return;
  }
  const { url } = await ui.spin(
    "Preparing the GitHub link…",
    async () => {
      try {
        return await session.client.mutation(api.github.startLink, {});
      } catch (err) {
        if (String(err).includes("no está configurada")) {
          throw new CliError(
            "GitHub linking is not configured on this server.",
            {
              code: "NOT_CONFIGURED",
              hint: "Organisers need GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the deployment.",
            }
          );
        }
        throw err;
      }
    },
    "Ready"
  );
  ui.result({ url });
  ui.note(
    `${url}\n\nGitHub asks you to authorise HackSpain, then sends you back to the dashboard. Run ${cmd("hackspain profile")} afterwards to check.`,
    "Open this link in your browser"
  );
}

export function registerProfile(program: Command): void {
  const profile = program
    .command("profile")
    .description("See and update your participant profile")
    .action(async (_opts: unknown, command: Command) => {
      await showProfile(command);
    });

  profile
    .command("show")
    .description("Your profile as organisers see it")
    .action(async (_opts: unknown, command: Command) => {
      await showProfile(command);
    });

  profile
    .command("edit")
    .description("Diet and where you travel from")
    .option("--diet <text>", "dietary restrictions, or None")
    .option("--diet-details <text>", "anything else about your diet")
    .option("--from <place>", "city or region you travel from")
    .action(editProfile);

  profile
    .command("attendance [status]")
    .description("Tell us if you are coming: attending | cancelled")
    .option("-y, --yes", "skip the confirmation when cancelling")
    .action(setAttendance);

  profile
    .command("notify <on|off>")
    .description(
      "Event notices by email and phone (announcements in `watch` are always on)"
    )
    .action(setNotify);

  profile
    .command("phone [number]")
    .description("Confirm your mobile number with an SMS code")
    .option("--code <digits>", "the code, for scripts")
    .action(confirmPhone);

  profile
    .command("github")
    .description("Link your GitHub account (or --unlink it)")
    .option("--unlink", "remove the link")
    .option("-y, --yes", "skip the confirmation when unlinking")
    .action(linkGithub);
}
