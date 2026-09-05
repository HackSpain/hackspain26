import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import { formatWhen, type Ui, uiFor } from "../lib/output";
import { openParticipant, type Submission } from "../lib/participant";

export function renderSubmission(ui: Ui, submission: Submission): void {
  ui.result(submission);
  const urlOf = (kind: "repo" | "demo") =>
    submission.urls.find((u) => u.kind === kind)?.url ?? "-";
  ui.table([
    ["Project", submission.name || "(untitled draft)"],
    [
      "Status",
      submission.status === "submitted"
        ? `submitted ${submission.submittedAt ? formatWhen(submission.submittedAt) : ""}`.trim()
        : "draft",
    ],
    ["Team", submission.teamName ?? "(no team)"],
    ["Tracks", submission.challenges.map((c) => c.label).join(", ") || "-"],
    ["Repo", urlOf("repo")],
    ["Demo", urlOf("demo")],
    [
      "Perks",
      submission.perks.map((p) => `${p.company}: ${p.title}`).join("; ") || "-",
    ],
    ["Updated", formatWhen(submission.updatedAt)],
  ]);
  if (submission.description) {
    ui.line(`\n${submission.description}`);
  }
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
      const submission = await session.client.query(api.submissions.mine, {});
      if (!submission) {
        throw new CliError("No project yet.", {
          code: "NO_PROJECT",
          hint: "Start one with `hackspain submit --draft` or `hackspain track register <slug>`.",
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
      const projects = await session.client.query(
        api.submissions.listPublic,
        {}
      );
      ui.result(projects);
      if (projects.length === 0) {
        ui.info("No projects yet.");
        return;
      }
      ui.table(
        projects.map((p) => [
          p.name,
          p.teamName ?? "-",
          p.challenges.map((c) => c.slug).join(", ") || "-",
          p.status,
          p.urls.find((u) => u.kind === "repo")?.url ?? "-",
        ]),
        ["Project", "Team", "Tracks", "Status", "Repo"]
      );
    });
}
