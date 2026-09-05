import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { formatWhen, uiFor } from "../lib/output";
import { type Milestone, openParticipant } from "../lib/participant";

const KINDS = ["firstCommit", "firstBuild", "firstDemo", "custom"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  firstCommit: "First commit",
  firstBuild: "First build",
  firstDemo: "First demo",
  custom: "Milestone",
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
    formatWhen(m.at),
    ...(withTeam ? [m.teamName] : []),
    KIND_LABEL[m.kind],
    m.label ?? "",
    m.byEmail ?? "",
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
        const id = await session.client.mutation(api.milestones.add, {
          kind,
          label: opts.label,
          at: parseAt(opts.at),
        });
        ui.result({ id, kind, label: opts.label ?? null });
        ui.success(
          `${KIND_LABEL[kind]}${opts.label ? `: ${opts.label}` : ""} recorded.`
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
      const list = opts.all
        ? await session.client.query(api.milestones.list, {})
        : await session.client.query(api.milestones.mine, {});
      ui.result(list);
      if (list.length === 0) {
        ui.info(
          opts.all ? "No milestones yet." : "No milestones for your team yet."
        );
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
