import { CliError } from "./errors";
import type { Submission, Track } from "./participant";

/** What `submissions.saveDraft` / `submit` take, derived from the current state. */
export type ProjectArgs = {
  name: string;
  description: string;
  repoUrl?: string;
  demoUrl?: string;
  challengeIds: Submission["challengeIds"];
  perkIds: Submission["perkIds"];
};

function urlOf(
  urls: Submission["urls"] | undefined,
  kind: "repo" | "demo"
): string | undefined {
  return urls?.find((entry) => entry.kind === kind)?.url;
}

export function projectArgsFrom(submission: Submission | null): ProjectArgs {
  return {
    name: submission?.name ?? "",
    description: submission?.description ?? "",
    repoUrl: urlOf(submission?.urls, "repo"),
    demoUrl: urlOf(submission?.urls, "demo"),
    challengeIds: submission?.challengeIds ?? [],
    perkIds: submission?.perkIds ?? [],
  };
}

export function alreadySubmitted(): CliError {
  return new CliError(
    "Your project is already submitted and can no longer change.",
    {
      code: "ALREADY_SUBMITTED",
      hint: "Ask an organiser if something needs correcting.",
    }
  );
}

export type TrackPlan = {
  next: Submission["challengeIds"];
  added: Track[];
  removed: Track[];
  unknown: string[];
};

/**
 * Compute the new challenge list for register/unregister/move. Slugs are
 * matched case-insensitively against the active tracks; unknown slugs are
 * reported rather than silently dropped.
 */
export function planTracks(
  current: Submission["challengeIds"],
  tracks: Track[],
  ops: { add?: string[]; remove?: string[] }
): TrackPlan {
  const bySlug = new Map(tracks.map((t) => [t.slug.toLowerCase(), t]));
  const unknown: string[] = [];
  const resolve = (slugs: string[] | undefined) =>
    (slugs ?? []).flatMap((slug) => {
      const track = bySlug.get(slug.trim().toLowerCase());
      if (!track) {
        unknown.push(slug);
        return [];
      }
      return [track];
    });

  const toRemove = resolve(ops.remove);
  const toAdd = resolve(ops.add);
  const set = new Set(current);
  const removed = toRemove.filter((t) => set.delete(t._id));
  const added = toAdd.filter((t) => {
    if (set.has(t._id)) {
      return false;
    }
    set.add(t._id);
    return true;
  });
  // Keep catalogue order so output is stable.
  const next = tracks.filter((t) => set.has(t._id)).map((t) => t._id);
  return { next, added, removed, unknown };
}
