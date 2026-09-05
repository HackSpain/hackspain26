import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { formatWhen, uiFor } from "../lib/output";
import { type Milestone, openParticipant } from "../lib/participant";
import { c, highlight } from "../lib/style";

const KINDS = ["firstCommit", "firstBuild", "firstDemo", "custom"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  firstCommit: "First commit",
  firstBuild: "First build",
  firstDemo: "First demo",
  custom: "Milestone",
};

const KIND_CHEER: Record<Kind, string> = {
  firstCommit: "the repo is no longer empty.",
  firstBuild: "it builds. Everything after this is polish.",
  firstDemo: "you have something to show.",
  custom: "logged.",
};

function parseKind(raw: string): Kind {
  const normalized = raw.replace(/[-_\s]/g, "").toLowerCase();
  const kind = KINDS.find((k) => k.toLowerCase() === normalized);
  if (!kind) {
    throw usageError(
      `Unknown milestone "${raw}".`,
      `Use one of: ${KINDS.join(", ")}.`
    );
  }
  return kind;
}

function parseAt(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return;
  }
  const at = Date.parse(raw);
  if (Number.isNaN(at)) {
    throw usageError(
      `Cannot parse --at "${raw}".`,
      "Use an ISO date like 2026-09-19T14:30:00+02:00."
    );
  }
  return at;
}

function rows(list: Milestone[], withTeam: boolean): string[][] {
  return list.map((m) => [
    c.dim(formatWhen(m.at)),
    ...(withTeam ? [m.teamName] : []),
    highlight(KIND_LABEL[m.kind]),
    m.label ?? "",
    c.dim(m.byEmail ?? ""),
  ]);
}

export function registerMilestone(program: Command): void {
  const milestone = program
    .command("milestone")
    .description("Record team milestones for the live insights");

  milestone
    .command("add <kind>")
    .description(`Record a milestone: ${KINDS.join(" | ")}`)
    .option("-l, --label <text>", "what happened (required for custom)")
    .option("--at <iso>", "when it happened (default: now)")
    .action(
      async (
        rawKind: string,
        opts: { label?: string; at?: string },
        command: Command
      ) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const { session } = await openParticipant(ctx);
        const kind = parseKind(rawKind);
        const id = await ui.spin(
          "Recording…",
          () =>
            session.client.mutation(api.milestones.add, {
              kind,
              label: opts.label,
              at: parseAt(opts.at),
            }),
          "Recorded"
        );
        ui.result({ id, kind, label: opts.label ?? null });
        ui.celebrate(
          kind === "custom"
            ? `${highlight(opts.label ?? KIND_LABEL.custom)} logged.`
            : `${highlight(KIND_LABEL[kind])}: ${KIND_CHEER[kind]}`
        );
      }
    );

  milestone
    .command("list")
    .description("Your team's milestones (or everyone's with --all)")
    .option("-a, --all", "all teams")
    .action(async (opts: { all?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const list = await ui.spin(
        "Fetching milestones…",
        () =>
          opts.all
            ? session.client.query(api.milestones.list, {})
            : session.client.query(api.milestones.mine, {}),
        "Milestones"
      );
      ui.result(list);
      if (list.length === 0) {
        ui.info(
          opts.all
            ? "No milestones from anyone yet."
            : "No milestones for your team yet."
        );
        ui.next([
          [
            "hackspain milestone add firstCommit",
            "log the first one when it happens",
          ],
        ]);
        return;
      }
      ui.table(
        rows(list, Boolean(opts.all)),
        opts.all
          ? ["When", "Team", "Milestone", "Label", "By"]
          : ["When", "Milestone", "Label", "By"]
      );
    });
}
