import type { Command } from "commander";
import { api, type Session } from "../lib/api";
import { type CliContext, contextFor } from "../lib/context";
import { CliError, usageError } from "../lib/errors";
import type { Me } from "../lib/me";
import { type Ui, uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { confirmOrFlag, textOrFlag } from "../lib/prompts";
import { c, cmd, highlight } from "../lib/style";

/**
 * `hackspain profile`: what the dashboard's profile page edits (name, diet
 * and travel, phone, event notices, GitHub), so a hacker never has to leave
 * the terminal to keep organisers informed. Attendance is deliberately not
 * here: this tool is used at the venue.
 */
const E164 = /^\+[1-9]\d{6,14}$/;
const PHONE_CODE = /^\d{4,8}$/;
const PHONE_NOISE = /[\s()-]/g;

const PHONE_FAILURES: Record<string, string> = {
  no_challenge: "No code was requested. Run `hackspain profile phone` again.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many attempts. Request a new code.",
  incorrect: "That code is not right.",
};

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
    ["Name", me.name ?? c.dim("not set · hackspain profile edit")],
    ["Email", me.email ?? c.dim("–")],
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
    ["hackspain profile phone <number>", "so we can reach you at the venue"],
  ]);
}

type EditOptions = {
  name?: string;
  diet?: string;
  dietDetails?: string;
  from?: string;
};

async function editProfile(opts: EditOptions, command: Command): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openParticipant(ctx);
  ui.intro("profile · edit");
  const name = await textOrFlag(ctx, opts.name, {
    flag: "--name",
    message: "Your name, as it should appear on badges and the board",
    initialValue: me.name ?? "",
    validate: validateName,
  });
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
    async () => {
      if (name.trim() !== (me.name ?? "")) {
        await session.client.mutation(api.users.setName, { name });
      }
      await session.client.mutation(api.users.updateEventDetails, {
        dietaryRestrictions: dietaryRestrictions.trim(),
        dietaryDetails: dietaryDetails.trim() || undefined,
        travelOrigin: travelOrigin.trim(),
      });
    },
    "Saved"
  );
  ui.result({
    name: name.trim(),
    dietaryRestrictions: dietaryRestrictions.trim(),
    dietaryDetails: dietaryDetails.trim() || undefined,
    travelOrigin: travelOrigin.trim(),
  });
  ui.success("Profile updated. Organisers see it straight away.");
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

/** The SMS challenge, shared by `profile phone` and the post-login check. */
export async function runPhoneConfirmation(
  ctx: CliContext,
  ui: Ui,
  session: Session,
  me: Me,
  number: string | undefined,
  code: string | undefined
): Promise<string> {
  const phone = (
    await textOrFlag(ctx, number, {
      flag: "<number>",
      message: "Your mobile number, international format",
      placeholder: "+34 600 111 222",
      initialValue: me.phone ?? "",
      validate: (v) =>
        E164.test(v.replace(PHONE_NOISE, ""))
          ? undefined
          : "Use the international format, like +34600111222.",
    })
  ).replace(PHONE_NOISE, "");
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
  const entered = await textOrFlag(ctx, code, {
    flag: "--code",
    message: `Enter the code we sent to ${phone}`,
    placeholder: "000000",
    validate: (v) => (PHONE_CODE.test(v.trim()) ? undefined : "Digits only."),
  });
  const verified = await ui.spin(
    "Checking…",
    () =>
      session.client.mutation(api.onboarding.verifyPhoneCode, {
        code: entered.trim(),
      }),
    "Checked"
  );
  if (!verified.ok) {
    throw new CliError(
      PHONE_FAILURES[verified.reason] ?? "Could not confirm the phone.",
      { code: "BAD_OTP" }
    );
  }
  return phone;
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
  const phone = await runPhoneConfirmation(
    ctx,
    ui,
    session,
    me,
    number,
    opts.code
  );
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
  const url = await startGithubLink(session, ui);
  ui.result({ url });
  ui.note(
    `${url}\n\nGitHub asks you to authorise HackSpain, then sends you back to the dashboard. Run ${cmd("hackspain profile")} afterwards to check.`,
    "Open this link in your browser"
  );
}

/** Authorise URL for the GitHub OAuth link; English error when the server lacks the app keys. */
export async function startGithubLink(
  session: Session,
  ui: Ui
): Promise<string> {
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
  return url;
}

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80
    ? undefined
    : "Between 2 and 80 characters.";
}

/**
 * Right after login: ask for whatever organisers need and the profile is
 * still missing (name, a confirmed phone, GitHub). Every step can be skipped
 * with Enter; nothing runs in --json or non-interactive mode.
 */
export async function completeProfile(
  ctx: CliContext,
  ui: Ui,
  session: Session,
  me: Me
): Promise<Me> {
  if (!ctx.interactive) {
    return me;
  }
  let current = me;
  // GitHub linking needs the OAuth app keys on the server; when they are
  // missing the step is left out rather than promised and then skipped.
  let githubUrl: string | undefined;
  if (!current.githubLinked) {
    try {
      githubUrl = (await session.client.mutation(api.github.startLink, {})).url;
    } catch {
      githubUrl = undefined;
    }
  }
  const askPhone =
    !current.phoneConfirmed && (current.accepted || current.role === "admin");
  const missing = [
    !current.name && "your name",
    askPhone && "a confirmed phone",
    githubUrl && "your GitHub",
  ].filter(Boolean) as string[];
  if (missing.length === 0) {
    return current;
  }
  ui.note(
    `Organisers still need ${missing.join(", ")}. Press Enter to skip any of these; ${cmd("hackspain profile")} has them all later.`,
    "One more minute"
  );
  if (!current.name) {
    const name = await textOrFlag(ctx, undefined, {
      flag: "--name",
      message: "Your name, as it should appear on badges and the board",
      optional: true,
      validate: validateName,
    });
    if (name.trim()) {
      await session.client.mutation(api.users.setName, { name });
      current = { ...current, name: name.trim() };
      ui.success(`Nice to meet you, ${highlight(name.trim())}.`);
    }
  }
  if (askPhone) {
    const wants = await confirmOrFlag(ctx, undefined, {
      flag: "--phone",
      message:
        "Confirm your mobile now? Organisers use it to reach you at the venue.",
      initialValue: true,
    });
    if (wants) {
      try {
        const phone = await runPhoneConfirmation(
          ctx,
          ui,
          session,
          current,
          undefined,
          undefined
        );
        current = { ...current, phone, phoneConfirmed: true };
        ui.success(`${phone} confirmed.`);
      } catch (err) {
        ui.warn(
          `${err instanceof Error ? err.message : String(err)} Try again later with ${cmd("hackspain profile phone")}.`
        );
      }
    }
  }
  if (githubUrl) {
    ui.note(
      `${githubUrl}\n\nAuthorise HackSpain there and you are done; it is how your pushes show up on the feed.`,
      "Link your GitHub in the browser"
    );
  }
  return current;
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
    .description("Name, diet and where you travel from")
    .option("--name <name>", "your name")
    .option("--diet <text>", "dietary restrictions, or None")
    .option("--diet-details <text>", "anything else about your diet")
    .option("--from <place>", "city or region you travel from")
    .action(editProfile);

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
