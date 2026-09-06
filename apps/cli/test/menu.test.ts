import { describe, expect, test } from "bun:test";
import {
  buildMainMenu,
  isResumeKey,
  type MenuItem,
  type MenuStatus,
  statusLine,
} from "../src/lib/menu";
import { buildProgram } from "../src/lib/program";

const LOGGED_OUT: MenuStatus = { loggedIn: false };

const PENDING: MenuStatus = {
  loggedIn: true,
  gate: "pending",
  email: "ana@example.com",
};

const READY_NO_TEAM: MenuStatus = {
  loggedIn: true,
  gate: "ready",
  email: "ana@example.com",
  team: null,
  project: null,
};

const READY_OWNER: MenuStatus = {
  loggedIn: true,
  gate: "ready",
  email: "ana@example.com",
  team: { name: "Los Increíbles", isOwner: true, members: 3, hasRepo: false },
  project: { name: "Quijote", submitted: false, tracks: 2 },
};

const READY_MEMBER: MenuStatus = {
  ...READY_OWNER,
  team: { name: "Los Increíbles", isOwner: false, members: 3, hasRepo: true },
};

const READY_SUBMITTED: MenuStatus = {
  ...READY_OWNER,
  project: { name: "Quijote", submitted: true, tracks: 2 },
};

const ALL_STATUSES = [
  LOGGED_OUT,
  PENDING,
  READY_NO_TEAM,
  READY_OWNER,
  READY_MEMBER,
  READY_SUBMITTED,
];

function values(items: MenuItem[]): string[] {
  return items.map((item) => item.value);
}

function itemOf(items: MenuItem[], value: string): MenuItem {
  const item = items.find((entry) => entry.value === value);
  expect(item).toBeDefined();
  return item as MenuItem;
}

function submenuOf(items: MenuItem[], value: string): MenuItem[] {
  const item = itemOf(items, value);
  expect(item.submenu).toBeDefined();
  return item.submenu ?? [];
}

/** Every argv the menu can ever dispatch: leaf commands plus previews. */
function allArgvs(items: MenuItem[]): string[][] {
  return items.flatMap((item) => {
    const own = [...(item.argv ? [item.argv] : []), ...(item.preview ?? [])];
    return item.submenu ? [...own, ...allArgvs(item.submenu)] : own;
  });
}

function leaves(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => {
    if (item.submenu) {
      return leaves(item.submenu);
    }
    return item.argv ? [item] : [];
  });
}

describe("buildMainMenu", () => {
  test("logged out: leads with log in, hides everything that needs auth", () => {
    const items = buildMainMenu(LOGGED_OUT);
    expect(values(items)).toEqual(["login", "update", "exit"]);
    expect(items[0]?.argv).toEqual(["auth", "login"]);
  });

  test("logged in but gated: only account actions, no participant features", () => {
    const items = buildMainMenu(PENDING);
    expect(values(items)).toEqual([
      "auth-status",
      "auth-logout",
      "update",
      "exit",
    ]);
  });

  test("ready without a team: join and create come first, exit last", () => {
    const items = buildMainMenu(READY_NO_TEAM);
    expect(values(items).slice(0, 2)).toEqual(["team-join", "team-create"]);
    expect(values(items)).not.toContain("team");
    expect(values(items).at(-1)).toBe("exit");
  });

  test("joining previews the team list before asking for the code", () => {
    const join = itemOf(buildMainMenu(READY_NO_TEAM), "team-join");
    expect(join.preview).toEqual([["team", "list"]]);
    expect(join.input).toBeDefined();
  });

  test("my team shows the team first, then the actions", () => {
    const team = itemOf(buildMainMenu(READY_OWNER), "team");
    expect(team.preview).toEqual([["team", "show"]]);
    const subValues = values(team.submenu ?? []);
    expect(subValues).toContain("team-transfer");
    expect(subValues).toContain("team-dissolve");
    expect(subValues).not.toContain("team-leave");
  });

  test("team member sees leave but no owner-only actions", () => {
    const subValues = values(submenuOf(buildMainMenu(READY_MEMBER), "team"));
    expect(subValues).toContain("team-leave");
    expect(subValues).not.toContain("team-transfer");
    expect(subValues).not.toContain("team-dissolve");
  });

  test("profile shows the profile first, then edit and account actions", () => {
    const profile = itemOf(buildMainMenu(READY_OWNER), "profile");
    expect(profile.preview).toEqual([["profile", "show"]]);
    expect(profile.hint).toBe("ana@example.com");
    const subValues = values(profile.submenu ?? []);
    expect(subValues).toEqual([
      "profile-edit",
      "profile-phone",
      "profile-github",
      "profile-notify",
      "auth-status",
      "auth-logout",
      "update",
    ]);
    const notify = submenuOf(profile.submenu ?? [], "profile-notify");
    expect(values(notify)).toEqual(["notify-on", "notify-off"]);
  });

  test("feed reads immediately; no nested read/post picker", () => {
    const feed = itemOf(buildMainMenu(READY_OWNER), "feed");
    expect(feed.argv).toEqual(["feed"]);
    expect(feed.submenu).toBeUndefined();
    expect(feed.takeover).toBeUndefined();
  });

  test("ready main menu labels: Profile only, no Account sibling", () => {
    const labels = buildMainMenu(READY_NO_TEAM).map((item) => item.label);
    expect(labels).toEqual([
      "Join a team",
      "Create a team",
      "Tracks & project",
      "Feed",
      "Profile",
      "Perks",
      "Milestones",
      "Start the watcher",
      "Exit",
    ]);
    expect(labels).not.toContain("Account");
    expect(labels).not.toContain("Read the feed");
    for (const status of [READY_OWNER, READY_MEMBER, READY_SUBMITTED]) {
      const ready = buildMainMenu(status).map((item) => item.label);
      expect(ready).toContain("Profile");
      expect(ready).not.toContain("Account");
    }
  });

  test("account is not a sibling of profile", () => {
    expect(values(buildMainMenu(READY_OWNER))).not.toContain("account");
    expect(values(buildMainMenu(READY_NO_TEAM))).not.toContain("account");
  });

  test("q, Esc and Ctrl+C after an action resume the menu", () => {
    expect(isResumeKey(Uint8Array.of(113))).toBe(true);
    expect(isResumeKey(Uint8Array.of(27))).toBe(true);
    expect(isResumeKey(Uint8Array.of(3))).toBe(true);
  });

  test("tracks show the state first: track list plus the project when it exists", () => {
    const withProject = itemOf(buildMainMenu(READY_OWNER), "tracks");
    expect(withProject.preview).toEqual([
      ["track", "list"],
      ["project", "show"],
    ]);
    const withoutProject = itemOf(buildMainMenu(READY_NO_TEAM), "tracks");
    expect(withoutProject.preview).toEqual([["track", "list"]]);
  });

  test("draft project: can register, unregister, draft and submit", () => {
    const subValues = values(submenuOf(buildMainMenu(READY_OWNER), "tracks"));
    expect(subValues).toEqual([
      "track-register",
      "track-unregister",
      "submit-draft",
      "submit",
      "project-list",
    ]);
  });

  test("submitted project: editing actions disappear, viewing stays", () => {
    const subValues = values(
      submenuOf(buildMainMenu(READY_SUBMITTED), "tracks")
    );
    expect(subValues).toEqual(["project-list"]);
  });

  test("top level stays tight: no static hint on perks or feed", () => {
    const items = buildMainMenu(READY_OWNER);
    expect(itemOf(items, "perks").hint).toBeUndefined();
    expect(itemOf(items, "feed").hint).toBeUndefined();
    expect(itemOf(items, "team").hint).toContain("Los Increíbles");
    expect(itemOf(items, "profile").hint).toBe("ana@example.com");
  });

  test("the watcher is the only action that takes over the screen", () => {
    const takeovers = leaves(buildMainMenu(READY_OWNER)).filter(
      (item) => item.takeover
    );
    expect(takeovers.map((item) => item.argv?.[0])).toEqual(["watch"]);
  });

  test("values are unique within every level", () => {
    const check = (items: MenuItem[]): void => {
      const seen = values(items);
      expect(new Set(seen).size).toBe(seen.length);
      for (const item of items) {
        if (item.submenu) {
          check(item.submenu);
        }
      }
    };
    for (const status of ALL_STATUSES) {
      check(buildMainMenu(status));
    }
  });

  test("every menu action and preview maps to a registered command", () => {
    const program = buildProgram();
    for (const status of ALL_STATUSES) {
      for (const argv of allArgvs(buildMainMenu(status))) {
        const [first, second] = argv;
        const top = program.commands.find(
          (command) => command.name() === first
        );
        expect(top).toBeDefined();
        if (
          second &&
          !second.startsWith("-") &&
          (top?.commands.length ?? 0) > 0
        ) {
          const names = top?.commands.map((command) => command.name()) ?? [];
          expect(names).toContain(second);
        }
      }
    }
  });
});

describe("statusLine", () => {
  test("signed out", () => {
    expect(statusLine(LOGGED_OUT)).toContain("Signed out");
  });

  test("gated shows the email and the gate", () => {
    const line = statusLine(PENDING);
    expect(line).toContain("ana@example.com");
    expect(line).toContain("pending");
  });

  test("ready shows team and project state", () => {
    const line = statusLine(READY_OWNER);
    expect(line).toContain("Los Increíbles");
    expect(line).toContain("draft");
    expect(statusLine(READY_NO_TEAM)).toContain("no team yet");
  });
});
