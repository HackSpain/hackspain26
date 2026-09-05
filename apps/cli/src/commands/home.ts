import type { Command } from "commander";
import { api, openSession } from "../lib/api";
import { readCredentials } from "../lib/auth-store";
import { resolveAppUrl } from "../lib/config";
import { contextFor } from "../lib/context";
import { describeGate, fetchMe } from "../lib/me";
import { firstName, uiFor } from "../lib/output";
import { c, cmd, highlight } from "../lib/style";
import { VERSION } from "../version";

/**
 * `hackspain` with no command: a friendly overview of where you stand and
 * what to do next. Everything else is one command away.
 */
export function registerHome(program: Command): void {
  program.action(async (_opts: unknown, command: Command) => {
    const ctx = contextFor(command);
    const ui = uiFor(ctx);
    const { url } = resolveAppUrl(ctx.urlOverride);
    ui.intro(`HackSpain 2026 · Madrid ${c.dim(`v${VERSION}`)}`);

    const creds = readCredentials();
    if (!creds || creds.appUrl !== url) {
      ui.result({ loggedIn: false });
      ui.line(
        "Welcome, hacker. This is your terminal companion for the hackathon:\nteams, tracks, your project, organiser messages, and the live usage board."
      );
      ui.next([
        ["hackspain auth login", "sign in with the email you applied with"],
        ["hackspain --help", "see every command"],
      ]);
      ui.outro("See you at the venue ⚡");
      return;
    }

    const session = await openSession(ctx);
    const me = await ui.spin(
      "Checking in…",
      () => fetchMe(session),
      "Checked in"
    );
    if (!me) {
      ui.result({ loggedIn: false });
      ui.warn("Your session expired.");
      ui.next([["hackspain auth login", "sign in again"]]);
      return;
    }
    const gate = describeGate(me);
    const name = firstName(me.name, me.email);
    ui.line(`Hey ${highlight(name)} 👋`);

    if (gate.state !== "ready" && gate.state !== "admin") {
      ui.result({ loggedIn: true, gate });
      ui.warn(gate.message);
      if (gate.hint) {
        ui.line(c.dim(gate.hint));
      }
      ui.outro("Come back once that is sorted; the rest unlocks then.");
      return;
    }

    const [team, submission] = await ui.spin(
      "Loading your team and project…",
      () =>
        Promise.all([
          session.client.query(api.teams.mine, {}),
          session.client.query(api.submissions.mine, {}),
        ]),
      "Loaded"
    );

    ui.result({ loggedIn: true, gate, team, submission });
    ui.kv([
      [
        "Team",
        team
          ? `${team.name} ${c.dim(`· ${team.members.length} member${team.members.length === 1 ? "" : "s"}${team.isOwner ? " · you own it" : ""}`)}`
          : c.dim("none yet"),
      ],
      [
        "Project",
        submission
          ? `${submission.name || c.dim("(untitled draft)")} ${c.dim(`· ${submission.status === "submitted" ? "submitted" : "draft"} · ${submission.challenges.map((x) => x.label).join(", ") || "no track yet"}`)}`
          : c.dim("none yet"),
      ],
      ["Repo", team?.repoUrl ?? c.dim("not set")],
      ["Signed in", c.dim(me.email ?? creds.email)],
    ]);

    const steps: [string, string][] = [];
    if (team) {
      if (!team.repoUrl) {
        steps.push([
          "hackspain team repo <url>",
          "tell organisers where your code lives",
        ]);
      }
      if (!submission || submission.challenges.length === 0) {
        steps.push([
          "hackspain track list",
          "pick the tracks you are going for",
        ]);
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
    ui.next(steps);
    ui.outro(
      `Ship something great. ${c.dim(`${cmd("hackspain --help")} for everything else.`)}`
    );
  });
}
