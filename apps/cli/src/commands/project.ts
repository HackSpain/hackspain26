import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import type { Ui } from "../lib/output";
import { formatAgo, formatWhen, uiFor } from "../lib/output";
import type { PublicSubmission, Submission } from "../lib/participant";
import { openParticipant } from "../lib/participant";
import { c, highlight, terminalSafe } from "../lib/style";

export function renderSubmission(ui: Ui, raw: Submission): void {
  ui.result(raw);
  const submission = terminalSafe(raw);
  const urlOf = (kind: "repo" | "demo" | "video") =>
    submission.urls.find((u) => u.kind === kind)?.url ?? c.dim("–");
  const status =
    submission.status === "submitted"
      ? c.green(
          `submitted${submission.submittedAt ? ` · ${formatWhen(submission.submittedAt)}` : ""}`
        )
      : `draft ${c.dim(`· saved ${formatAgo(submission.updatedAt)}`)}`;
  ui.kv([
    ["Project", highlight(submission.name || "(untitled draft)")],
    ["Status", status],
    ["Team", submission.teamName ?? c.dim("no team")],
    [
      "Tracks",
      submission.challenges.map((x) => x.label).join(", ") ||
        c.dim("none yet · hackspain track list"),
    ],
    ["Repo", urlOf("repo")],
    ["Demo", urlOf("demo")],
    ["Video", urlOf("video")],
    [
      "Perks",
      submission.perks.map((p) => `${p.company}: ${p.title}`).join("; ") ||
        c.dim("–"),
    ],
  ]);
  if (submission.description) {
    ui.line(`\n${c.italic(submission.description)}`);
  }
}

/** One row per project for `project list`, styled from terminal-safe copies. */
export function projectListRows(projects: PublicSubmission[]): string[][] {
  return terminalSafe(projects).map((p) => [
    p.name,
    c.dim(p.teamName ?? "–"),
    p.challenges.map((x) => x.slug).join(", ") || c.dim("–"),
    p.status === "submitted" ? c.green("submitted") : c.dim("draft"),
    c.dim(
      p.urls
        .find((u) => u.kind === "repo")
        ?.url.replace("https://github.com/", "") ?? "–"
    ),
  ]);
}

export function registerProject(program: Command): void {
  const project = program
    .command("project")
    .description("Projects: yours and everyone else's");

  project
    .command("show")
    .description("Your team's project as it stands")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const submission = await ui.spin(
        "Fetching your project…",
        () => session.client.query(api.submissions.mine, {}),
        "Your project"
      );
      if (!submission) {
        throw new CliError("No project yet, and that is fine this early.", {
          code: "NO_PROJECT",
          hint: "Start one with `hackspain track register <slug>`, then submit at app.hackspain.com/submit.",
        });
      }
      renderSubmission(ui, submission);
    });

  project
    .command("list")
    .description("Every project with a name: team, tracks, repo and status")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const projects = await ui.spin(
        "Fetching projects…",
        () => session.client.query(api.submissions.listPublic, {}),
        "Projects"
      );
      ui.result(projects);
      if (projects.length === 0) {
        ui.info("No projects yet. Yours could be the first on this list.");
        return;
      }
      ui.table(projectListRows(projects), [
        "Project",
        "Team",
        "Tracks",
        "Status",
        "Repo",
      ]);
    });
}
