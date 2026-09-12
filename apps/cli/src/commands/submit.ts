import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError, usageError } from "../lib/errors";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { alreadySubmitted, projectArgsFrom } from "../lib/project";
import { confirmOrFlag, pickMany, textOrFlag } from "../lib/prompts";
import { c, highlight } from "../lib/style";
import { renderSubmission } from "./project";

const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
const HTTP_URL = /^https?:\/\/\S+$/;

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

type SubmitOptions = {
  draft?: boolean;
  name?: string;
  description?: string;
  repo?: string;
  demo?: string;
  video?: string;
  track: string[];
  perk: string[];
  yes?: boolean;
};

export function registerSubmit(program: Command): void {
  program
    .command("submit")
    .description("Submit your project (or save a draft with --draft)")
    .option("--draft", "save without submitting; everything stays editable")
    .option("--name <name>", "project name")
    .option("--description <text>", "what it does, at least 10 characters")
    .option("--repo <url>", "GitHub repository URL")
    .option("--demo <url>", "demo URL")
    .option("--video <url>", "YouTube, Loom, or MP4 URL for judges")
    .option(
      "--track <slug>",
      "track to enter (repeatable)",
      collect,
      [] as string[]
    )
    .option(
      "--perk <id>",
      "partner perk used (repeatable, id from `hackspain perk list`)",
      collect,
      [] as string[]
    )
    .option("-y, --yes", "skip the final confirmation")
    .action(async (opts: SubmitOptions, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const mode: "draft" | "submit" = opts.draft ? "draft" : "submit";
      ui.intro(mode === "draft" ? "submit · draft" : "submit");

      const [current, tracks, settings, perks, team] = await ui.spin(
        "Loading your project…",
        () =>
          Promise.all([
            session.client.query(api.submissions.mine, {}),
            session.client.query(api.tracks.list, {}),
            session.client.query(api.tracks.settings, {}),
            session.client.query(api.perks.listCatalog, {}),
            session.client.query(api.teams.mine, {}),
          ]),
        "Loaded"
      );
      if (current?.status === "submitted") {
        renderSubmission(ui, current);
        throw alreadySubmitted();
      }
      if (mode === "submit" && !settings.submissionsOpen) {
        throw new CliError("Submissions are not open yet.", {
          code: "SUBMISSIONS_CLOSED",
          hint: "Save your progress with `hackspain submit --draft` and come back when they open.",
        });
      }

      const existing = projectArgsFrom(current);

      const name = await textOrFlag(ctx, opts.name, {
        flag: "--name",
        initialValue: existing.name,
        message: "Project name",
        validate: (v) =>
          v.trim().length >= 2 ? undefined : "At least 2 characters",
      });
      const description = await textOrFlag(ctx, opts.description, {
        flag: "--description",
        initialValue: existing.description,
        message: "What does it do? (one or two sentences)",
        validate: (v) =>
          mode === "draft" || v.trim().length >= 10
            ? undefined
            : "At least 10 characters",
      });
      const repoUrl = await textOrFlag(ctx, opts.repo, {
        flag: "--repo",
        initialValue: existing.repoUrl ?? team?.repoUrl ?? "",
        message: "GitHub repository",
        optional: true,
        placeholder: "https://github.com/org/repo",
        validate: (v) =>
          GITHUB_URL.test(v.trim()) ? undefined : "https://github.com/org/repo",
      });
      const demoUrl = await textOrFlag(ctx, opts.demo, {
        flag: "--demo",
        initialValue: existing.demoUrl ?? "",
        message: "Demo URL (optional)",
        optional: true,
        validate: (v) =>
          HTTP_URL.test(v.trim()) ? undefined : "Must start with http(s)://",
      });
      const videoUrl = await textOrFlag(ctx, opts.video, {
        flag: "--video",
        initialValue: existing.videoUrl ?? "",
        message: "Video URL for judges (optional)",
        optional: true,
        validate: (v) =>
          HTTP_URL.test(v.trim()) ? undefined : "Must start with http(s)://",
      });

      const bySlug = new Map(tracks.map((t) => [t.slug, t]));
      const unknownTracks = opts.track.filter((s) => !bySlug.has(s));
      if (unknownTracks.length > 0) {
        throw usageError(
          `Unknown track: ${unknownTracks.join(", ")}.`,
          `Known: ${tracks.map((t) => t.slug).join(", ")}.`
        );
      }
      const trackSlugs = await pickMany(
        ctx,
        opts.track.length > 0 ? opts.track : undefined,
        {
          choices: tracks.map((t) => ({
            value: t.slug,
            label: t.label,
            hint: t.note,
          })),
          flag: "--track",
          initial: tracks
            .filter((t) => existing.challengeIds.includes(t._id))
            .map((t) => t.slug),
          message: "Tracks to enter",
          required: mode === "submit",
        }
      );
      const challengeIds = trackSlugs.flatMap((slug) => {
        const t = bySlug.get(slug);
        return t ? [t._id] : [];
      });
      if (mode === "submit" && challengeIds.length === 0) {
        throw usageError(
          "Pick at least one track.",
          "Pass --track <slug> or run interactively."
        );
      }

      const perkIdSet = new Set(perks.map((p) => p.perk._id as string));
      const unknownPerks = opts.perk.filter((id) => !perkIdSet.has(id));
      if (unknownPerks.length > 0) {
        throw usageError(
          `Unknown perk id: ${unknownPerks.join(", ")}.`,
          "Ids come from `hackspain perk list`."
        );
      }
      const perkIds = await pickMany(
        ctx,
        opts.perk.length > 0
          ? (opts.perk as typeof existing.perkIds)
          : undefined,
        {
          choices: perks.map((p) => ({
            value: p.perk._id,
            label: `${p.perk.company}: ${p.perk.title}`,
            hint: p.perk.value,
          })),
          flag: "--perk",
          initial: existing.perkIds,
          message: "Partner perks you used (optional)",
        }
      );

      const args = {
        challengeIds,
        demoUrl: demoUrl.trim() || undefined,
        description: description.trim(),
        name: name.trim(),
        perkIds,
        repoUrl: repoUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
      };

      if (mode === "submit") {
        ui.kv([
          ["Project", highlight(args.name)],
          [
            "Tracks",
            trackSlugs.map((s) => bySlug.get(s)?.label ?? s).join(", "),
          ],
          ["Repo", args.repoUrl ?? c.dim("–")],
          ["Demo", args.demoUrl ?? c.dim("–")],
          ["Video", args.videoUrl ?? c.dim("–")],
        ]);
        ui.warn(
          "Submitting is final. After this the project cannot be edited."
        );
        const ok = await confirmOrFlag(ctx, opts.yes, {
          flag: "--yes",
          initialValue: false,
          message: "Submit now?",
        });
        if (!ok) {
          await ui.spin(
            "Saving a draft instead…",
            () => session.client.mutation(api.submissions.saveDraft, args),
            "Draft saved"
          );
          ui.result({ savedDraft: true, submitted: false });
          ui.info(
            "Not submitted. Your draft is safe; run `hackspain submit` when ready."
          );
          return;
        }
      }

      await ui.spin(
        mode === "submit" ? "Submitting…" : "Saving draft…",
        () =>
          session.client.mutation(
            mode === "submit"
              ? api.submissions.submit
              : api.submissions.saveDraft,
            args
          ),
        mode === "submit" ? "Submitted" : "Draft saved"
      );
      if (args.repoUrl && team && !team.repoUrl) {
        try {
          await session.client.mutation(api.teams.setRepoUrl, {
            url: args.repoUrl,
          });
        } catch {
          // Repo on the team is a convenience for organisers; the submission is what counts.
        }
      }
      const saved = await session.client.query(api.submissions.mine, {});
      if (saved) {
        renderSubmission(ui, saved);
      }
      if (mode === "submit") {
        ui.celebrate(
          `${highlight(args.name)} is in. That is the hard part done.`
        );
        ui.next([
          ["hackspain project list", "see what everyone else shipped"],
          ["hackspain watch", "keep the usage board live until judging"],
        ]);
        ui.outro("Good luck at the demo ⚡");
      } else {
        ui.next([
          ["hackspain submit", "when you are ready to lock it in"],
          ["hackspain track list", "double-check the tracks you are entering"],
        ]);
        ui.outro("Draft saved. Keep building.");
      }
    });
}
