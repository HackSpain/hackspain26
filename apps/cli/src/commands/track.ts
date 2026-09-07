import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { type Ui, uiFor } from "../lib/output";
import { openParticipant, type Participant } from "../lib/participant";
import { alreadySubmitted, planTracks, projectArgsFrom } from "../lib/project";

async function applyPlan(
  ui: Ui,
  participant: Participant,
  ops: { add?: string[]; remove?: string[] }
): Promise<void> {
  const { session } = participant;
  const [tracks, submission] = await Promise.all([
    session.client.query(api.tracks.list, {}),
    session.client.query(api.submissions.mine, {}),
  ]);
  if (submission?.status === "submitted") {
    throw alreadySubmitted();
  }
  const plan = planTracks(submission?.challengeIds ?? [], tracks, ops);
  if (plan.unknown.length > 0) {
    throw usageError(
      `Unknown track${plan.unknown.length > 1 ? "s" : ""}: ${plan.unknown.join(", ")}.`,
      `Run \`hackspain track list\`. Known: ${tracks.map((t) => t.slug).join(", ")}.`
    );
  }
  if (plan.added.length === 0 && plan.removed.length === 0) {
    ui.result({ changed: false, tracks: plan.next });
    ui.info("Nothing to change.");
    return;
  }
  await session.client.mutation(api.submissions.saveDraft, {
    ...projectArgsFrom(submission),
    challengeIds: plan.next,
  });
  const entered = tracks.filter((t) => plan.next.includes(t._id));
  ui.result({
    changed: true,
    added: plan.added.map((t) => t.slug),
    removed: plan.removed.map((t) => t.slug),
    tracks: entered.map((t) => t.slug),
  });
  for (const t of plan.added) {
    ui.success(`Registered for ${t.label}.`);
  }
  for (const t of plan.removed) {
    ui.success(`Unregistered from ${t.label}.`);
  }
  ui.info(
    entered.length
      ? `Now entered in: ${entered.map((t) => t.label).join(", ")}.`
      : "Not entered in any track."
  );
}

export function registerTrack(program: Command): void {
  const track = program
    .command("track")
    .description(
      "See the tracks (challenges) and choose which ones your project enters"
    );

  track
    .command("list")
    .description("Tracks you can enter, marking the ones your project is in")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const [tracks, settings, submission] = await Promise.all([
        session.client.query(api.tracks.list, {}),
        session.client.query(api.tracks.settings, {}),
        session.client.query(api.submissions.mine, {}),
      ]);
      const entered = new Set(submission?.challengeIds ?? []);
      ui.result({
        submissionsOpen: settings.submissionsOpen,
        tracks: tracks.map((t) => ({
          slug: t.slug,
          label: t.label,
          note: t.note,
          entered: entered.has(t._id),
        })),
      });
      ui.table(
        tracks.map((t) => [
          entered.has(t._id) ? "*" : "",
          t.slug,
          t.label,
          t.note,
        ]),
        ["", "Slug", "Track", "Note"]
      );
      ui.line("");
      ui.info(
        settings.submissionsOpen
          ? "Submissions are open. Register with `hackspain track register <slug>`."
          : "Submissions are not open yet. You can still register; `hackspain submit` unlocks later."
      );
    });

  track
    .command("register <slugs...>")
    .description("Enter your project in one or more tracks")
    .action(async (slugs: string[], _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      await applyPlan(uiFor(ctx), await openParticipant(ctx), { add: slugs });
    });

  track
    .command("unregister <slugs...>")
    .description("Withdraw your project from one or more tracks")
    .action(async (slugs: string[], _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      await applyPlan(uiFor(ctx), await openParticipant(ctx), {
        remove: slugs,
      });
    });

  track
    .command("move <from> <to>")
    .description("Swap one track for another")
    .action(
      async (from: string, to: string, _opts: unknown, command: Command) => {
        const ctx = contextFor(command);
        await applyPlan(uiFor(ctx), await openParticipant(ctx), {
          remove: [from],
          add: [to],
        });
      }
    );
}
