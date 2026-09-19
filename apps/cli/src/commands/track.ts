import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import type { Ui } from "../lib/output";
import { uiFor } from "../lib/output";
import type { Participant } from "../lib/participant";
import { openParticipant } from "../lib/participant";
import { alreadySubmitted, planTracks, projectArgsFrom } from "../lib/project";
import { pickOne } from "../lib/prompts";
import { c, highlight } from "../lib/style";

function occupancy(count: number, limit: number): string {
  return `${count}/${limit}`;
}

async function applyPlan(
  ui: Ui,
  participant: Participant,
  ops: { add?: string[]; remove?: string[] }
): Promise<void> {
  const { session } = participant;
  const [tracks, submission] = await ui.spin(
    "Loading tracks…",
    () =>
      Promise.all([
        session.client.query(api.tracks.list, {}),
        session.client.query(api.submissions.mine, {}),
      ]),
    "Tracks loaded"
  );
  if (submission?.status === "submitted") {
    throw alreadySubmitted();
  }
  const plan = planTracks(submission?.challengeIds ?? [], tracks, ops);
  if (plan.unknown.length > 0) {
    throw usageError(
      `Unknown track: ${plan.unknown[0]}.`,
      `Run \`hackspain track list\`. Known: ${tracks.map((t) => t.slug).join(", ")}.`
    );
  }
  const full = plan.added.filter((t) => t.teamCount >= t.teamLimit);
  if (full.length > 0) {
    const t = full[0];
    throw usageError(
      `${t?.label} is full (${t?.teamLimit} teams).`,
      "Run `hackspain track list` to see which tracks still have room."
    );
  }
  if (plan.added.length === 0 && plan.removed.length === 0) {
    ui.result({ changed: false, tracks: plan.next });
    ui.info("Already set up that way. Nothing to change.");
    return;
  }
  await ui.spin(
    "Saving…",
    () =>
      session.client.mutation(api.submissions.saveDraft, {
        ...projectArgsFrom(submission),
        challengeIds: plan.next,
      }),
    "Saved"
  );
  const entered = tracks.filter((t) => plan.next.includes(t._id));
  ui.result({
    added: plan.added.map((t) => t.slug),
    changed: true,
    removed: plan.removed.map((t) => t.slug),
    tracks: entered.map((t) => t.slug),
  });
  for (const t of plan.added) {
    ui.celebrate(`You are in for ${highlight(t.label)}.`);
  }
  for (const t of plan.removed) {
    ui.success(`Out of ${t.label}.`);
  }
  ui.line(
    entered.length
      ? `${c.dim("Entering:")} ${entered.map((t) => t.label).join(", ")}`
      : c.dim("Not entering any track right now.")
  );
  if (entered.length > 0) {
    ui.next([["app.hackspain.com/submit", "submit from the dashboard"]]);
  }
}

export function registerTrack(program: Command): void {
  const track = program
    .command("track")
    .description("See the tracks and choose where your project enters");

  track
    .command("list")
    .description("Tracks you can enter, marking the ones your project is in")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const [tracks, settings, submission] = await ui.spin(
        "Loading tracks…",
        () =>
          Promise.all([
            session.client.query(api.tracks.list, {}),
            session.client.query(api.tracks.settings, {}),
            session.client.query(api.submissions.mine, {}),
          ]),
        "Tracks"
      );
      const currentIds = new Set(submission?.challengeIds);
      ui.result({
        submissionsOpen: settings.submissionsOpen,
        tracks: tracks.map((t) => ({
          entered: currentIds.has(t._id),
          full: t.teamCount >= t.teamLimit,
          label: t.label,
          note: t.note,
          slug: t.slug,
          teamCount: t.teamCount,
          teamLimit: t.teamLimit,
        })),
      });
      ui.table(
        tracks.map((t) => [
          currentIds.has(t._id) ? c.gold("●") : c.dim("○"),
          currentIds.has(t._id) ? highlight(t.slug) : t.slug,
          t.label,
          t.teamCount >= t.teamLimit
            ? c.gold(`${occupancy(t.teamCount, t.teamLimit)} full`)
            : occupancy(t.teamCount, t.teamLimit),
          c.dim(t.note),
        ]),
        ["", "Slug", "Track", "Teams", "Note"]
      );
      ui.line(
        currentIds.size > 0
          ? `${c.gold("●")} ${c.dim("= you are entering this track")}`
          : c.dim("You are not entering any track yet.")
      );
      ui.next([
        ["hackspain track register [slug]", "enter a track"],
        ["hackspain track unregister [slug]", "leave a track"],
        [
          "app.hackspain.com/submit",
          settings.submissionsOpen
            ? "submissions are open on the dashboard"
            : "opens later on the dashboard",
        ],
      ]);
    });

  track
    .command("register [slugs...]")
    .description("Enter a track; THEKER can be combined with one other")
    .action(async (slugs: string[], _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const participant = await openParticipant(ctx);
      const { session } = participant;
      const [tracks, submission] = await ui.spin(
        "Loading tracks…",
        () =>
          Promise.all([
            session.client.query(api.tracks.list, {}),
            session.client.query(api.submissions.mine, {}),
          ]),
        "Tracks loaded"
      );
      const currentId = submission?.challengeIds[0];
      const chosen = await pickOne(ctx, slugs[0], {
        choices: tracks.map((t) => ({
          hint: occupancy(t.teamCount, t.teamLimit),
          label: t.label,
          value: t.slug,
        })),
        flag: "<slug>",
        initialValue: tracks.find((t) => t._id === currentId)?.slug,
        message: "Which track?",
      });
      if (!chosen) {
        throw usageError(
          "Pick a track.",
          "Pass the slug or run interactively."
        );
      }
      await applyPlan(ui, participant, { add: [chosen] });
    });

  track
    .command("unregister [slugs...]")
    .description("Leave one of the tracks your project is in")
    .action(async (slugs: string[], _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const participant = await openParticipant(ctx);
      const { session } = participant;
      const [tracks, submission] = await ui.spin(
        "Loading tracks…",
        () =>
          Promise.all([
            session.client.query(api.tracks.list, {}),
            session.client.query(api.submissions.mine, {}),
          ]),
        "Tracks loaded"
      );
      const current = tracks.find((t) => t._id === submission?.challengeIds[0]);
      const slug = slugs[0] ?? current?.slug;
      if (!slug) {
        ui.result({ changed: false, tracks: [] });
        ui.info("Not in a track.");
        return;
      }
      await applyPlan(ui, participant, { remove: [slug] });
    });
}
