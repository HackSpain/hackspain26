import type { FunctionArgs } from "convex/server";
import type { api } from "./api";
import { CliError } from "./errors";
import type { Submission, Track } from "./participant";

/** What `submissions.saveDraft` / `submit` take, derived from the current state. */
export type ProjectArgs = FunctionArgs<typeof api.submissions.saveDraft>;

function urlOf(
  urls: Submission["urls"] | undefined,
  kind: "repo" | "demo" | "video"
): string | undefined {
  return urls?.find((entry) => entry.kind === kind)?.url;
}

export function projectArgsFrom(submission: Submission | null): ProjectArgs {
  return {
    challengeIds: submission?.challengeIds ?? [],
    demoUrl: urlOf(submission?.urls, "demo"),
    description: submission?.description ?? "",
    name: submission?.name ?? "",
    perkIds: submission?.perkIds ?? [],
    repoUrl: urlOf(submission?.urls, "repo"),
    videoUrl: urlOf(submission?.urls, "video"),
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

function resolveFirst(
  slugs: string[] | undefined,
  tracks: Track[]
): { track: Track | null; unknown: string[] } {
  const slug = slugs?.[0];
  if (!slug) {
    return { track: null, unknown: [] };
  }
  const track =
    tracks.find((t) => t.slug.toLowerCase() === slug.trim().toLowerCase()) ??
    null;
  return { track, unknown: track ? [] : [slug] };
}

/**
 * One track per team. Register takes the first slug and replaces whatever
 * was there; unregister clears it.
 */
export function planTracks(
  current: Submission["challengeIds"],
  tracks: Track[],
  ops: { add?: string[]; remove?: string[] }
): TrackPlan {
  const held = tracks.filter((t) => current.includes(t._id));
  if (ops.add?.length) {
    const { track, unknown } = resolveFirst(ops.add, tracks);
    if (!track) {
      return { added: [], next: current.slice(0, 1), removed: [], unknown };
    }
    const added = current[0] === track._id ? [] : [track];
    return {
      added,
      next: [track._id],
      removed: held.filter((t) => t._id !== track._id),
      unknown,
    };
  }
  if (ops.remove?.length) {
    const { track, unknown } = resolveFirst(ops.remove, tracks);
    if (!track) {
      return { added: [], next: current.slice(0, 1), removed: [], unknown };
    }
    const wasIn = current.includes(track._id);
    return {
      added: [],
      next: wasIn ? [] : current.slice(0, 1),
      removed: wasIn ? held.filter((t) => t._id === track._id) : [],
      unknown,
    };
  }
  return { added: [], next: current.slice(0, 1), removed: [], unknown: [] };
}
