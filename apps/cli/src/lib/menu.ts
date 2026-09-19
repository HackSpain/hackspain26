import { isCancel, text } from "@clack/prompts";
import type { Command } from "commander";
import { VERSION } from "../version";
import { api, openSession } from "./api";
import { readCredentials } from "./auth-store";
import { banner } from "./banner";
import { resolveAppUrl } from "./config";
import type { CliContext } from "./context";
import { explainError } from "./errors";
import type { Gate, GateState } from "./me";
import { describeGate, fetchMe } from "./me";
import { greetingFor, openingBoardRows, renderOpening } from "./opening";
import { isCommanderError } from "./run";
import { c, cmd } from "./style";
import { cardWidth, isPickCancel, pickInBox } from "./tui";

/**
 * The interactive menu behind bare `hackspain` on a TTY. Every entry maps to
 * an argv that is dispatched through a fresh Commander program, so the menu
 * and the subcommands always share one implementation. Sections that hold
 * state (team, tracks, profile) show it first via `preview` commands, then
 * offer the actions. Building the items is a pure function of the status
 * snapshot, which keeps it testable.
 */

export type MenuTeam = {
  name: string;
  isOwner: boolean;
  members: number;
  hasRepo: boolean;
  repoUrl?: string | null;
};

export type MenuProject = {
  name: string | null;
  submitted: boolean;
  tracks: number;
  track?: string | null;
};

export type MenuStatus = {
  loggedIn: boolean;
  gate?: GateState;
  /** Human line for a gated state (describeGate), shown instead of the board. */
  gateMessage?: string;
  email?: string;
  name?: string;
  team?: MenuTeam | null;
  project?: MenuProject | null;
};

export type MenuInput = {
  message: string;
  placeholder?: string;
  /** Split the answer on whitespace into several argv tokens. */
  split?: boolean;
};

export type MenuItem = {
  value: string;
  label: string;
  hint?: string;
  /** Leaf: command tokens to dispatch; the input answer is appended. */
  argv?: string[];
  input?: MenuInput;
  submenu?: MenuItem[];
  /** Commands run first, to show the current state before acting on it. */
  preview?: string[][];
  /** The command owns the screen (watch); do not return to the menu. */
  takeover?: boolean;
};

function isReady(status: MenuStatus): boolean {
  return status.gate === "ready" || status.gate === "admin";
}

const EXIT_ITEM: MenuItem = { value: "exit", label: "Exit" };

const UPDATE_ITEM: MenuItem = {
  value: "update",
  label: "Update the CLI",
  argv: ["update"],
};

const OPEN_ITEM: MenuItem = {
  value: "open",
  label: "Open the dashboard",
  hint: "in your browser, already signed in",
  argv: ["open"],
};

const BACK_VALUE = "__back";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function teamHint(team: MenuTeam): string {
  return `${team.name} · ${plural(team.members, "member")}${team.isOwner ? " · you own it" : ""}`;
}

function projectHint(project: MenuProject | null | undefined): string {
  if (!project) {
    return "nothing started yet";
  }
  if (project.submitted) {
    return `${project.name ?? "project"} · submitted`;
  }
  const track = project.track ?? "no track yet";
  return `${project.name ?? "untitled draft"} · draft · ${track}`;
}

function buildTeamMenu(team: MenuTeam): MenuItem[] {
  const items: MenuItem[] = [
    {
      value: "team-repo",
      label: team.hasRepo ? "Change the repo" : "Set the repo",
      hint: "we detect the stack from it",
      argv: ["team", "repo"],
      input: {
        message: "GitHub repo URL or org/name (comma-separate several)",
        placeholder: "org/repo",
      },
    },
    {
      value: "team-stack",
      label: "Detect the stack",
      argv: ["stack", "detect"],
    },
    { value: "team-list", label: "Browse all teams", argv: ["team", "list"] },
  ];
  if (team.isOwner) {
    items.push(
      {
        value: "team-transfer",
        label: "Transfer ownership",
        argv: ["team", "transfer"],
      },
      {
        value: "team-dissolve",
        label: "Dissolve the team",
        hint: "only when you are alone",
        argv: ["team", "dissolve"],
      }
    );
  } else {
    items.push({
      value: "team-leave",
      label: "Leave the team",
      argv: ["team", "leave"],
    });
  }
  return items;
}

function buildTrackMenu(status: MenuStatus): MenuItem[] {
  const project = status.project ?? null;
  if (project?.submitted) {
    return [];
  }
  const items: MenuItem[] = [
    {
      value: "track-register",
      label: project?.track ? "Switch track" : "Enter a track",
      argv: ["track", "register"],
    },
  ];
  if (project?.track) {
    items.push({
      value: "track-unregister",
      label: "Leave the track",
      argv: ["track", "unregister"],
    });
  }
  return items;
}

function submitProjectItem(submitted: boolean): MenuItem {
  return {
    value: "submit",
    label: "Submit the project",
    hint: submitted
      ? "opens the dashboard"
      : "video, repo and product — opens the dashboard",
    argv: ["open", "submit"],
  };
}

function buildProjectMenu(status: MenuStatus): MenuItem[] {
  const submitted = Boolean(status.project?.submitted);
  return [
    submitProjectItem(submitted),
    {
      value: "project-list",
      label: "Everyone's projects",
      argv: ["project", "list"],
    },
  ];
}

function buildProfileMenu(): MenuItem[] {
  return [
    {
      value: "profile-edit",
      label: "Edit name, diet, travel",
      argv: ["profile", "edit"],
    },
    {
      value: "profile-phone",
      label: "Set my phone",
      argv: ["profile", "phone"],
    },
    {
      value: "profile-github",
      label: "Link GitHub",
      argv: ["profile", "github"],
    },
    {
      value: "profile-x",
      label: "Set my X handle",
      argv: ["profile", "x"],
    },
    {
      value: "profile-card",
      label: "Photo and participant card",
      hint: "opens the dashboard",
      argv: ["open", "profile"],
    },
    {
      value: "profile-notify",
      label: "Event notices",
      submenu: [
        {
          value: "notify-on",
          label: "Turn on",
          hint: "schedule changes and reminders",
          argv: ["profile", "notify", "on"],
        },
        {
          value: "notify-off",
          label: "Turn off",
          argv: ["profile", "notify", "off"],
        },
      ],
    },
  ];
}

function buildMilestoneMenu(): MenuItem[] {
  return [
    {
      value: "milestone-mine",
      label: "Our milestones",
      argv: ["milestone", "list"],
    },
    {
      value: "milestone-all",
      label: "Everyone's milestones",
      argv: ["milestone", "list", "--all"],
    },
    {
      value: "milestone-commit",
      label: "Log: first commit",
      argv: ["milestone", "add", "firstCommit"],
    },
    {
      value: "milestone-build",
      label: "Log: first build",
      argv: ["milestone", "add", "firstBuild"],
    },
    {
      value: "milestone-demo",
      label: "Log: first demo",
      argv: ["milestone", "add", "firstDemo"],
    },
    {
      value: "milestone-custom",
      label: "Log: something else",
      argv: ["milestone", "add", "custom", "--label"],
      input: { message: "What happened?" },
    },
  ];
}

function buildAccountMenu(): MenuItem[] {
  return [
    {
      value: "auth-status",
      label: "Session status",
      argv: ["auth", "status"],
    },
    { value: "auth-logout", label: "Log out", argv: ["auth", "logout"] },
    UPDATE_ITEM,
  ];
}

function buildReadyMenu(status: MenuStatus): MenuItem[] {
  const items: MenuItem[] = [];
  if (status.team) {
    items.push({
      value: "team",
      label: "My team",
      hint: teamHint(status.team),
      preview: [["team", "show"]],
      submenu: buildTeamMenu(status.team),
    });
  } else {
    items.push(
      {
        value: "team-join",
        label: "Join a team",
        hint: "shows the teams, then asks for the code",
        preview: [["team", "list"]],
        argv: ["team", "join"],
        input: { message: "Join code", placeholder: "ABCD1234" },
      },
      {
        value: "team-create",
        label: "Create a team",
        hint: "you become its owner",
        argv: ["team", "create"],
        input: { message: "Team name", placeholder: "Los Increíbles" },
      }
    );
  }
  const trackMenu = buildTrackMenu(status);
  items.push(
    {
      value: "tracks",
      label: "Track",
      hint: status.project?.track ?? "not in a track yet",
      preview: [["track", "list"]],
      submenu: trackMenu.length > 0 ? trackMenu : undefined,
    },
    {
      value: "project",
      label: "Project",
      hint: projectHint(status.project),
      preview: status.project ? [["project", "show"]] : undefined,
      submenu: buildProjectMenu(status),
    },
    submitProjectItem(Boolean(status.project?.submitted)),
    {
      value: "feed",
      label: "Feed",
      argv: ["feed"],
    },
    {
      value: "profile",
      label: "Profile",
      hint: status.email,
      preview: [["profile", "show"]],
      submenu: [...buildProfileMenu(), ...buildAccountMenu()],
    },
    { value: "perks", label: "Perks", argv: ["perk", "list"] },
    { value: "milestones", label: "Milestones", submenu: buildMilestoneMenu() },
    OPEN_ITEM,
    {
      value: "watch",
      label: "Start the watcher",
      hint: "takes over the terminal",
      argv: ["watch"],
      takeover: true,
    },
    EXIT_ITEM
  );
  return items;
}

/** Top-level menu for the current status. Pure; covered by unit tests. */
export function buildMainMenu(status: MenuStatus): MenuItem[] {
  if (!status.loggedIn) {
    return [
      {
        value: "login",
        label: "Log in",
        hint: "with the email you applied with",
        argv: ["auth", "login"],
      },
      UPDATE_ITEM,
      EXIT_ITEM,
    ];
  }
  if (status.gate === "closed") {
    // Outside the hackathon window the profile and perks still work; the
    // participant directory lives on the dashboard.
    return [
      {
        value: "profile",
        label: "My profile",
        hint: "available at any time",
        preview: [["profile", "show"]],
        submenu: buildProfileMenu(),
      },
      { value: "perks", label: "Perks", argv: ["perk", "list"] },
      {
        ...OPEN_ITEM,
        hint: "profile, perks and participant directory, already signed in",
      },
      {
        value: "account",
        label: "Account",
        hint: "session, log out, update",
        submenu: buildAccountMenu(),
      },
      EXIT_ITEM,
    ];
  }
  if (!isReady(status)) {
    return [
      {
        value: "auth-status",
        label: "Session status",
        hint: "what the server says about you",
        argv: ["auth", "status"],
      },
      {
        ...OPEN_ITEM,
        hint: "finish onboarding there, already signed in",
      },
      { value: "auth-logout", label: "Log out", argv: ["auth", "logout"] },
      UPDATE_ITEM,
      EXIT_ITEM,
    ];
  }
  return buildReadyMenu(status);
}

/** One-line summary for states without a full status block. */
export function statusLine(status: MenuStatus): string {
  if (!status.loggedIn) {
    return c.dim("Signed out.");
  }
  if (!isReady(status)) {
    return c.dim(
      `Signed in as ${status.email ?? "?"} · ${status.gateMessage ?? status.gate ?? "checking"}`
    );
  }
  const team = status.team ? teamHint(status.team) : "no team yet";
  return `${c.dim("You:")} ${team} ${c.dim("·")} ${projectHint(status.project)}`;
}

/** Build a menu status from the objects the home command already fetched. */
export function menuStatusFrom(
  me: { email?: string | null; name?: string | null },
  gate: Gate,
  team: {
    name: string;
    isOwner: boolean;
    members: unknown[];
    repoUrl?: string | null;
  } | null,
  submission: {
    name?: string | null;
    status: string;
    challenges: { label?: string }[];
  } | null
): MenuStatus {
  const track =
    submission?.challenges.map((challenge) => challenge.label).join(", ") ||
    null;
  return {
    loggedIn: true,
    gate: gate.state,
    gateMessage: gate.message,
    email: me.email ?? undefined,
    name: me.name ?? undefined,
    team: team
      ? {
          name: team.name,
          isOwner: team.isOwner,
          members: team.members.length,
          hasRepo: Boolean(team.repoUrl),
          repoUrl: team.repoUrl ?? null,
        }
      : null,
    project: submission
      ? {
          name: submission.name || null,
          submitted: submission.status === "submitted",
          track,
          tracks: submission.challenges.length,
        }
      : null,
  };
}

/** Fresh status snapshot, used to refresh the menu after each action. */
export async function fetchMenuStatus(ctx: CliContext): Promise<MenuStatus> {
  const { url } = resolveAppUrl(ctx.urlOverride);
  const creds = readCredentials();
  if (!creds || creds.appUrl !== url) {
    return { loggedIn: false };
  }
  const session = await openSession(ctx);
  const me = await fetchMe(session);
  if (!me) {
    return { loggedIn: false };
  }
  const gate = describeGate(me);
  if (gate.state !== "ready" && gate.state !== "admin") {
    return {
      loggedIn: true,
      gate: gate.state,
      gateMessage: gate.message,
      email: me.email ?? creds.email,
      name: me.name ?? undefined,
    };
  }
  const [team, submission] = await Promise.all([
    session.client.query(api.teams.mine, {}),
    session.client.query(api.submissions.mine, {}),
  ]);
  return menuStatusFrom(
    { email: me.email ?? creds.email, name: me.name },
    gate,
    team,
    submission
  );
}

/** Wipe the terminal (stdout and stderr). */
function clearTerminal(): void {
  const wipe = "\x1b[2J\x1b[3J\x1b[H";
  if (process.stdout.isTTY) {
    process.stdout.write(wipe);
  }
  if (process.stderr.isTTY) {
    process.stderr.write(wipe);
  }
}

/** Clear screen and scrollback, then print the banner and a status block. */
function renderHome(status: MenuStatus): void {
  clearTerminal();
  const ready = status.loggedIn && isReady(status);
  let message: string | undefined;
  if (!(ready || status.loggedIn)) {
    message = "Signed out.";
  } else if (!ready) {
    message = `Signed in as ${status.email ?? "?"} · ${status.gateMessage ?? status.gate ?? "checking"}`;
  }
  console.log(`\n${banner()}\n`);
  console.log(
    renderOpening({
      version: VERSION,
      greeting: status.loggedIn
        ? greetingFor(status.name, status.email)
        : undefined,
      board: ready
        ? openingBoardRows({
            email: status.email,
            team: status.team,
            project: status.project
              ? {
                  name: status.project.name,
                  submitted: status.project.submitted,
                  tracks: status.project.tracks,
                  trackLabels: status.project.track
                    ? [status.project.track]
                    : [],
                }
              : undefined,
          })
        : undefined,
      message,
    })
  );
  console.log();
}

/** Let the user finish reading, then return to the menu. Never process.exit. */
function pressAnyKey(): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(
      `\n${c.gold("q")} ${c.dim("· Esc to go back to the menu…")}\n`
    );
    const stdin = process.stdin;
    const raw = Boolean(stdin.isTTY);
    if (raw) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.once("data", () => {
      if (raw) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      resolve();
    });
  });
}

type Level = { items: MenuItem[]; title: string };

/**
 * Walk the menu tree as watcher-style cards. Entering a submenu first runs
 * its preview commands (show before act). Submenus get a "back" entry. Esc
 * at the top level exits. ← Back / Esc from any submenu returns "home" so
 * the outer loop can wipe the screen and redraw the wordmark.
 */
async function navigate(
  root: MenuItem[],
  title: string,
  runPreview: (argvs: string[][]) => Promise<void>
): Promise<MenuItem | "exit" | "home" | null> {
  const stack: Level[] = [{ items: root, title }];
  for (;;) {
    const level = stack.at(-1);
    if (!level) {
      return null;
    }
    const items: MenuItem[] =
      stack.length > 1
        ? [...level.items, { value: BACK_VALUE, label: "← Back" }]
        : level.items;
    const choice = await pickInBox({
      items: items.map((item) => ({
        hint: item.hint,
        label: item.label,
        value: item.value,
      })),
      title: level.title,
      width: cardWidth(),
    });
    if (isPickCancel(choice) || choice === BACK_VALUE) {
      if (stack.length === 1) {
        return null;
      }
      return "home";
    }
    const item = items.find((entry) => entry.value === choice);
    if (!item) {
      return null;
    }
    if (item.value === EXIT_ITEM.value) {
      return "exit";
    }
    if (item.submenu) {
      if (item.preview) {
        await runPreview(item.preview);
      }
      stack.push({ items: item.submenu, title: item.label });
      continue;
    }
    return item;
  }
}

const SPACES = /\s+/;

/** Turn a leaf into argv, asking for the missing input when the item needs one. */
async function resolveArgv(item: MenuItem): Promise<string[] | null> {
  if (!item.argv) {
    return null;
  }
  if (!item.input) {
    return [...item.argv];
  }
  const answer = await text({
    message: item.input.message,
    placeholder: item.input.placeholder,
    validate: (value) =>
      value?.trim() ? undefined : "Required — press Esc to go back.",
  });
  if (isCancel(answer)) {
    return null;
  }
  const trimmed = String(answer).trim();
  const extra = item.input.split ? trimmed.split(SPACES) : [trimmed];
  return [...item.argv, ...extra];
}

/**
 * Run one menu selection through a fresh Commander program so option state
 * never leaks between actions and the menu shares every code path with the
 * plain subcommands.
 */
async function dispatch(
  rebuild: () => Command,
  ctx: CliContext,
  argv: string[]
): Promise<void> {
  const program = rebuild();
  program.exitOverride();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  const full = ctx.urlOverride ? ["--url", ctx.urlOverride, ...argv] : argv;
  await program.parseAsync(full, { from: "user" });
}

async function refreshStatus(
  ctx: CliContext,
  previous: MenuStatus
): Promise<MenuStatus> {
  try {
    return await fetchMenuStatus(ctx);
  } catch {
    return previous;
  }
}

/**
 * The loop: pick, run, let the outcome sink in, then come back to a freshly
 * cleared home. Errors from an action are explained like `runCli` does but
 * keep the menu alive; screen-owning actions (watch) hand over and never
 * return here.
 */
export async function runMenu(options: {
  ctx: CliContext;
  rebuild: () => Command;
  status: MenuStatus;
}): Promise<void> {
  const { ctx, rebuild } = options;
  let status = options.status;

  const runArgv = async (argv: string[]): Promise<void> => {
    try {
      await dispatch(rebuild, ctx, argv);
    } catch (error) {
      if (!isCommanderError(error)) {
        const explained = explainError(error);
        const hint = explained.hint ? `\n${c.dim(explained.hint)}` : "";
        console.error(`  ${c.red("✗")}  ${explained.message}${hint}`);
      }
    }
  };
  const runPreview = async (argvs: string[][]): Promise<void> => {
    for (const argv of argvs) {
      await runArgv(argv);
    }
  };

  for (;;) {
    const picked = await navigate(buildMainMenu(status), "menu", runPreview);
    if (picked === "home") {
      renderHome(status);
      continue;
    }
    if (picked === null || picked === "exit") {
      console.log(
        `\n  See you at the venue ⚡ ${c.dim(`${cmd("hackspain --help")} lists every command.`)}\n`
      );
      return;
    }
    if (picked.preview) {
      await runPreview(picked.preview);
    }
    const argv = await resolveArgv(picked);
    if (!argv) {
      renderHome(status);
      continue;
    }
    await runArgv(argv);
    if (picked.takeover) {
      return;
    }
    status = await refreshStatus(ctx, status);
    await pressAnyKey();
    renderHome(status);
  }
}
