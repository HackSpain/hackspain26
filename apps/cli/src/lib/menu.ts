import { isCancel, log, outro, select, text } from "@clack/prompts";
import type { Command } from "commander";
import { VERSION } from "../version";
import { api, openSession } from "./api";
import { readCredentials } from "./auth-store";
import { banner } from "./banner";
import { resolveAppUrl } from "./config";
import type { CliContext } from "./context";
import { explainError } from "./errors";
import { describeGate, fetchMe, type Gate, type GateState } from "./me";
import { greetingFor, openingBoardRows, renderOpening } from "./opening";
import { isCommanderError } from "./run";
import { c, cmd } from "./style";

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
};

export type MenuStatus = {
  loggedIn: boolean;
  gate?: GateState;
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
  return `${project.name ?? "untitled draft"} · draft · ${plural(project.tracks, "track")}`;
}

function buildTeamMenu(team: MenuTeam): MenuItem[] {
  const items: MenuItem[] = [
    {
      value: "team-repo",
      label: team.hasRepo ? "Change the repo" : "Set the repo",
      hint: "pushes and PRs land on the feed",
      argv: ["team", "repo"],
      input: {
        message: "GitHub repository URL",
        placeholder: "https://github.com/org/repo",
      },
    },
    {
      value: "team-stack",
      label: "Declare the stack",
      argv: ["stack", "set"],
      input: {
        message: "Technologies, separated by spaces",
        placeholder: "nextjs convex claude-code",
        split: true,
      },
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

function buildProjectMenu(status: MenuStatus): MenuItem[] {
  const project = status.project ?? null;
  const submitted = Boolean(project?.submitted);
  const items: MenuItem[] = [];
  if (!submitted) {
    items.push({
      value: "track-register",
      label: "Enter a track",
      hint: "slug from the list above",
      argv: ["track", "register"],
      input: {
        message: "Track slug(s), separated by spaces",
        placeholder: "ai-agents",
        split: true,
      },
    });
    if ((project?.tracks ?? 0) > 0) {
      items.push({
        value: "track-unregister",
        label: "Leave a track",
        argv: ["track", "unregister"],
        input: { message: "Track slug(s) to leave", split: true },
      });
    }
    items.push(
      {
        value: "submit-draft",
        label: "Save a draft",
        hint: "everything stays editable",
        argv: ["submit", "--draft"],
      },
      {
        value: "submit",
        label: "Submit the project",
        hint: "final — asks before locking it in",
        argv: ["submit"],
      }
    );
  }
  items.push({
    value: "project-list",
    label: "Everyone's projects",
    argv: ["project", "list"],
  });
  return items;
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
      label: "Confirm my phone",
      argv: ["profile", "phone"],
    },
    {
      value: "profile-github",
      label: "Link GitHub",
      argv: ["profile", "github"],
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
  items.push(
    {
      value: "tracks",
      label: "Tracks & project",
      hint: projectHint(status.project),
      preview: [
        ["track", "list"],
        ...(status.project ? [["project", "show"]] : []),
      ],
      submenu: buildProjectMenu(status),
    },
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
  if (!isReady(status)) {
    return [
      {
        value: "auth-status",
        label: "Session status",
        hint: "what the server says about you",
        argv: ["auth", "status"],
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
      `Signed in as ${status.email ?? "?"} · ${status.gate ?? "checking"}`
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
    challenges: unknown[];
  } | null
): MenuStatus {
  return {
    loggedIn: true,
    gate: gate.state,
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

/** Wipe the terminal (stdout and stderr — clack may have used either). */
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
    message = `Signed in as ${status.email ?? "?"} · ${status.gate ?? "checking"}`;
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
            project: status.project,
          })
        : undefined,
      message,
    })
  );
  console.log();
}

/** After a menu action, every key (q, Esc, Ctrl+C, anything) resumes the menu. */
export function isResumeKey(_data: Uint8Array): boolean {
  return true;
}

/** Let the user finish reading, then return to the menu. Never process.exit. */
function pressAnyKey(): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(`\n${c.dim("q · Esc to go back to the menu…")}\n`);
    const stdin = process.stdin;
    const raw = Boolean(stdin.isTTY);
    if (raw) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.once("data", (data: Buffer) => {
      if (raw) {
        stdin.setRawMode(false);
      }
      stdin.pause();
      if (isResumeKey(data)) {
        resolve();
      }
    });
  });
}

type Level = { items: MenuItem[]; title: string };

/**
 * Walk the menu tree with clack selects. Entering a submenu first runs its
 * preview commands (show before act). Submenus get a "back" entry. Esc at
 * the top level exits. ← Back / Esc from any submenu returns "home" so the
 * outer loop can wipe the screen and redraw the wordmark — calling select()
 * again in this same frame would leave clack's previous prompt stacked.
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
    const choice = await select<string>({
      message: level.title,
      options: items.map((item) => ({
        value: item.value,
        label: item.label,
        hint: item.hint,
      })),
    });
    if (isCancel(choice) || choice === BACK_VALUE) {
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
    } catch (err) {
      if (!isCommanderError(err)) {
        const explained = explainError(err);
        const hint = explained.hint ? `\n${c.dim(explained.hint)}` : "";
        log.error(`${c.red(explained.message)}${hint}`);
      }
    }
  };
  const runPreview = async (argvs: string[][]): Promise<void> => {
    for (const argv of argvs) {
      await runArgv(argv);
    }
  };

  for (;;) {
    const picked = await navigate(
      buildMainMenu(status),
      "What do you want to do?",
      runPreview
    );
    if (picked === "home") {
      renderHome(status);
      continue;
    }
    if (picked === null || picked === "exit") {
      outro(
        `See you at the venue ⚡ ${c.dim(`${cmd("hackspain --help")} lists every command.`)}`
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
