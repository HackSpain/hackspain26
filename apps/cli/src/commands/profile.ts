import type { Command } from "commander";
import type { Session } from "../lib/api";
import { api } from "../lib/api";
import type { CliContext } from "../lib/context";
import { contextFor } from "../lib/context";
import { CliError, usageError } from "../lib/errors";
import type { Me } from "../lib/me";
import type { Ui } from "../lib/output";
import { uiFor } from "../lib/output";
import { openProfile } from "../lib/participant";
import { formatPhone, validatePhone } from "../lib/phone";
import { confirmOrFlag, textOrFlag } from "../lib/prompts";
import { c, cmd, highlight } from "../lib/style";

/**
 * `hackspain profile`: what the dashboard's profile page edits (name, diet
 * and travel, phone, event notices, GitHub), so a hacker never has to leave
 * the terminal to keep organisers informed. Attendance is deliberately not
 * here: this tool is used at the venue.
 */
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
    ["Phone", me.phone ?? c.dim("not set · hackspain profile phone <number>")],
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
    notificationConsent: me.notificationConsent,
    githubUsername: me.githubUsername,
    githubLinked: me.githubLinked,
  };
}

async function showProfile(command: Command): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { me } = await openProfile(ctx);
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
  const { session, me } = await openProfile(ctx);
  ui.intro("profile · edit");
  const name = await textOrFlag(ctx, opts.name, {
    flag: "--name",
    initialValue: me.name ?? "",
    message: "Your name, as it should appear on badges and the board",
    validate: validateName,
  });
  const dietaryRestrictions = await textOrFlag(ctx, opts.diet, {
    flag: "--diet",
    initialValue: me.dietaryRestrictions ?? "",
    message: "Dietary restrictions (write None if you have none)",
    placeholder: "None, vegetarian, vegan, allergies…",
    validate: (v) => (v.trim() ? undefined : "Say None if there are none."),
  });
  const dietaryDetails = await textOrFlag(ctx, opts.dietDetails, {
    flag: "--diet-details",
    initialValue: me.dietaryDetails ?? "",
    message: "Anything else about your diet? (optional)",
    optional: true,
  });
  const travelOrigin = await textOrFlag(ctx, opts.from, {
    flag: "--from",
    initialValue: me.travelOrigin ?? "",
    message: "Where are you travelling from?",
    placeholder: "City or region",
    validate: (v) => (v.trim() ? undefined : "We need a city or region."),
  });
  await ui.spin(
    "Saving…",
    async () => {
      if (name.trim() !== (me.name ?? "")) {
        await session.client.mutation(api.users.setName, { name });
      }
      await session.client.mutation(api.users.updateEventDetails, {
        dietaryDetails: dietaryDetails.trim() || undefined,
        dietaryRestrictions: dietaryRestrictions.trim(),
        travelOrigin: travelOrigin.trim(),
      });
    },
    "Saved"
  );
  ui.result({
    dietaryDetails: dietaryDetails.trim() || undefined,
    dietaryRestrictions: dietaryRestrictions.trim(),
    name: name.trim(),
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
  const { session } = await openProfile(ctx);
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
      ? "Event notices on. Schedule changes and reminders reach you by email."
      : "Event notices off. You still get announcements in `hackspain watch`."
  );
}

/** Save the contact number; shared by `profile phone` and the post-login check. */
export async function savePhone(
  ctx: CliContext,
  ui: Ui,
  session: Session,
  me: Me,
  number: string | undefined
): Promise<string> {
  const phone = formatPhone(
    await textOrFlag(ctx, number, {
      flag: "<number>",
      initialValue: me.phone ?? "",
      message: "Your mobile number, with the country code",
      placeholder: "+34 600 111 222",
      validate: validatePhone,
    })
  );
  return await ui.spin(
    "Saving…",
    () => session.client.mutation(api.users.setPhone, { phone }),
    "Saved"
  );
}

async function setPhoneCommand(
  number: string | undefined,
  _opts: unknown,
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openProfile(ctx);
  ui.intro("profile · phone");
  const phone = await savePhone(ctx, ui, session, me, number);
  ui.result({ phone });
  ui.success(`${phone} saved. Organisers can reach you at the venue.`);
}

async function linkGithub(
  opts: { unlink?: boolean; yes?: boolean },
  command: Command
): Promise<void> {
  const ctx = contextFor(command);
  const ui = uiFor(ctx);
  const { session, me } = await openProfile(ctx);
  if (opts.unlink) {
    if (!me.githubLinked) {
      ui.info("No GitHub account is linked.");
      return;
    }
    const ok = await confirmOrFlag(ctx, opts.yes, {
      flag: "--yes",
      initialValue: false,
      message: `Unlink ${me.githubUsername ?? "your GitHub account"}?`,
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
      } catch (error) {
        if (String(error).includes("no está configurada")) {
          throw new CliError(
            "GitHub linking is not configured on this server.",
            {
              code: "NOT_CONFIGURED",
              hint: "Organisers need GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the deployment.",
            }
          );
        }
        throw error;
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
 * still missing (name, phone, GitHub). Every step can be skipped
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
    !current.phone && (current.accepted || current.role === "admin");
  // Photo and directory card are dashboard-only; the wizard there asks for them.
  const dashboardMissing = current.profileMissing.filter(
    (field) => field !== "name"
  );
  const missing = [
    !current.name && "your name",
    askPhone && "a contact phone",
    githubUrl && "your GitHub",
    dashboardMissing.length > 0 && "your dashboard profile",
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
    const phone = await textOrFlag(ctx, undefined, {
      flag: "--phone",
      initialValue: "",
      message: "Your mobile number, so organisers can reach you at the venue",
      optional: true,
      placeholder: "+34 600 111 222",
      validate: validatePhone,
    });
    if (phone.trim()) {
      const saved = await session.client.mutation(api.users.setPhone, {
        phone: formatPhone(phone),
      });
      current = { ...current, phone: saved };
      ui.success(`${saved} saved.`);
    }
  }
  if (githubUrl) {
    ui.note(
      `${githubUrl}\n\nAuthorise HackSpain there and you are done; it is how your pushes show up on the feed.`,
      "Link your GitHub in the browser"
    );
  }
  if (dashboardMissing.length > 0) {
    const pieces = dashboardMissing.map((field) =>
      field === "photo" ? "a photo" : "your participant card"
    );
    ui.note(
      `The dashboard still needs ${pieces.join(" and ")}. ${cmd("hackspain open")} takes you straight to those steps.`,
      "Finish on the dashboard"
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
      "Event notices by email (announcements in `watch` are always on)"
    )
    .action(setNotify);

  profile
    .command("phone [number]")
    .description("Your contact number for the venue")
    .action(setPhoneCommand);

  profile
    .command("github")
    .description("Link your GitHub account (or --unlink it)")
    .option("--unlink", "remove the link")
    .option("-y, --yes", "skip the confirmation when unlinking")
    .action(linkGithub);
}
