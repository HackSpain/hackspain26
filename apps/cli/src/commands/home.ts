import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readCredentials } from "../lib/auth-store";
import { banner } from "../lib/banner";
import { resolveAppUrl } from "../lib/config";
import type { CliContext } from "../lib/context";
import { contextFor } from "../lib/context";
import { explainError } from "../lib/errors";
import { describeGate, fetchMe, type Gate, type Me } from "../lib/me";
import { type MenuStatus, menuStatusFrom, runMenu } from "../lib/menu";
import {
  bootFor,
  formatStatusBoard,
  formatVersionLine,
  greetingFor,
  openingBoardRows,
} from "../lib/opening";
import { type Ui, uiFor } from "../lib/output";
import type { Submission, Team } from "../lib/participant";
import { c, cmd } from "../lib/style";
import { VERSION } from "../version";

/**
 * `hackspain` with no command: a friendly overview of where you stand. On an
 * interactive terminal it continues into a navigable menu; piped or --json
 * it prints the overview and exits, exactly as before.
 */

type Snapshot =
  | { kind: "loggedOut" }
  | { kind: "expired" }
  | { kind: "gated"; gate: Gate; email: string; name?: string | null }
  | {
      kind: "ready";
      me: Me;
      gate: Gate;
      team: Team | null;
      submission: Submission | null;
      email: string;
    };

async function loadSnapshot(ctx: CliContext, url: string): Promise<Snapshot> {
  const creds = readCredentials();
  if (!creds || creds.appUrl !== url) {
    return { kind: "loggedOut" };
  }
  const boot = bootFor(ctx);
  const session = await openSession(ctx);
  const me = await boot.step(
    "checking in…",
    "checked in",
    () => fetchMe(session),
    (user) => (user ? greetingFor(user.name, user.email) : undefined)
  );
  if (!me) {
    return { kind: "expired" };
  }
  const gate = describeGate(me);
  const email = me.email ?? creds.email;
  if (gate.state !== "ready" && gate.state !== "admin") {
    return { kind: "gated", gate, email, name: me.name };
  }
  const [team, submission] = await boot.step("loading…", "loaded", () =>
    Promise.all([
      session.client.query(api.teams.mine, {}),
      session.client.query(api.submissions.mine, {}),
    ])
  );
  return { kind: "ready", me, gate, team, submission, email };
}

function nextSteps(
  team: Team | null,
  submission: Submission | null
): [string, string][] {
  const steps: [string, string][] = [];
  if (team) {
    if (!team.repoUrl) {
      steps.push([
        "hackspain team repo <url>",
        "tell organisers where your code lives",
      ]);
    }
    if (!submission || submission.challenges.length === 0) {
      steps.push(["hackspain track list", "pick the tracks you are going for"]);
    }
    if (submission?.status !== "submitted") {
      steps.push(["hackspain submit --draft", "save your project as you go"]);
    }
    steps.push(["hackspain watch", "keep this running in a spare terminal"]);
  } else {
    steps.push(
      ["hackspain team create <name>", "start a team and get a join code"],
      ["hackspain team join <code>", "or join a friend's team"]
    );
  }
  return steps;
}

function renderReady(
  ui: Ui,
  snapshot: Extract<Snapshot, { kind: "ready" }>,
  menuMode: boolean
): void {
  const { gate, team, submission, email } = snapshot;
  ui.result({ loggedIn: true, gate, team, submission });
  if (!ui.json) {
    console.log("");
    console.log(
      formatStatusBoard(
        openingBoardRows({
          email,
          team: team
            ? {
                name: team.name,
                isOwner: team.isOwner,
                members: team.members.length,
                repoUrl: team.repoUrl,
              }
            : null,
          project: submission
            ? {
                name: submission.name || null,
                submitted: submission.status === "submitted",
                tracks: submission.challenges.length,
                trackLabels: submission.challenges.map((item) => item.label),
              }
            : null,
        })
      )
    );
    console.log();
  }
  if (menuMode) {
    return;
  }
  ui.next(nextSteps(team, submission));
  ui.outro(
    `Ship something great. ${c.dim(`${cmd("hackspain --help")} for everything else.`)}`
  );
}

function renderSnapshot(ui: Ui, snapshot: Snapshot, menuMode: boolean): void {
  switch (snapshot.kind) {
    case "loggedOut": {
      ui.result({ loggedIn: false });
      if (!ui.json) {
        console.log("  Welcome, hacker.");
        console.log(
          `  ${c.dim("Teams, tracks, your project, organiser messages, and the live usage board.")}`
        );
      }
      if (!menuMode) {
        ui.next([
          ["hackspain auth login", "sign in with the email you applied with"],
          ["hackspain --help", "see every command"],
        ]);
        ui.outro("See you at the venue ⚡");
      }
      return;
    }
    case "expired": {
      ui.result({ loggedIn: false });
      if (!ui.json) {
        console.log(`  ${c.orange("session expired")}`);
        console.log(
          `  ${c.dim("Sign in again to pick up where you left off.")}`
        );
      }
      if (!menuMode) {
        ui.next([["hackspain auth login", "sign in again"]]);
      }
      return;
    }
    case "gated": {
      ui.result({ loggedIn: true, gate: snapshot.gate });
      if (!ui.json) {
        console.log(`  ${c.orange(snapshot.gate.message)}`);
        if (snapshot.gate.hint) {
          console.log(`  ${c.dim(snapshot.gate.hint)}`);
        }
      }
      if (!menuMode) {
        ui.outro("Come back once that is sorted; the rest unlocks then.");
      }
      return;
    }
    case "ready": {
      renderReady(ui, snapshot, menuMode);
      return;
    }
    default:
      return;
  }
}

function menuStatusOf(snapshot: Snapshot): MenuStatus {
  switch (snapshot.kind) {
    case "gated":
      return {
        loggedIn: true,
        gate: snapshot.gate.state,
        email: snapshot.email,
        name: snapshot.name ?? undefined,
      };
    case "ready":
      return menuStatusFrom(
        { email: snapshot.email, name: snapshot.me.name },
        snapshot.gate,
        snapshot.team,
        snapshot.submission
      );
    default:
      return { loggedIn: false };
  }
}

export function registerHome(program: Command, rebuild?: () => Command): void {
  program.action(async (_opts: unknown, command: Command) => {
    const ctx = contextFor(command);
    const ui = uiFor(ctx);
    const { url } = resolveAppUrl(ctx.urlOverride);
    if (!ctx.json) {
      console.log(`\n${banner()}\n`);
      console.log(`${formatVersionLine(VERSION)}\n`);
    }

    const menuMode = Boolean(rebuild) && ctx.interactive;
    let snapshot: Snapshot;
    if (menuMode) {
      // The menu must come up even when the server is unreachable, so a
      // failed check-in degrades to the signed-out menu instead of aborting.
      try {
        snapshot = await loadSnapshot(ctx, url);
      } catch (err) {
        const explained = explainError(err);
        ui.warn(
          `${explained.message}${explained.hint ? `\n${c.dim(explained.hint)}` : ""}`
        );
        snapshot = { kind: "loggedOut" };
      }
    } else {
      snapshot = await loadSnapshot(ctx, url);
    }

    renderSnapshot(ui, snapshot, menuMode);
    if (menuMode && rebuild) {
      await runMenu({ ctx, rebuild, status: menuStatusOf(snapshot) });
    }
  });
}
