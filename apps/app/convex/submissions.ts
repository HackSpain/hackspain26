import { v } from "convex/values";
import {
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { submissionStatusValidator } from "./lib/validators";
import { buildUrls, urlsValidator } from "./lib/urls";
import { submissionsAreOpen } from "./tracks";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const challengeSummary = v.object({
  _id: v.id("tracks"),
  slug: v.string(),
  label: v.string(),
});

const perkSummary = v.object({
  _id: v.id("perks"),
  company: v.string(),
  title: v.string(),
});

const submissionReturn = v.object({
  _id: v.id("submissions"),
  teamId: v.optional(v.id("teams")),
  teamName: v.optional(v.string()),
  submittedBy: v.id("users"),
  name: v.string(),
  description: v.string(),
  urls: urlsValidator,
  challengeIds: v.array(v.id("tracks")),
  perkIds: v.array(v.id("perks")),
  challenges: v.array(challengeSummary),
  perks: v.array(perkSummary),
  status: submissionStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  submittedAt: v.optional(v.number()),
});

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)];
}

async function hydrateSubmission(
  ctx: QueryCtx | MutationCtx,
  submission: Doc<"submissions">,
) {
  const team = submission.teamId ? await ctx.db.get(submission.teamId) : null;
  const challenges = [];
  for (const trackId of submission.challengeIds) {
    const track = await ctx.db.get(trackId);
    if (track) {
      challenges.push({
        _id: track._id,
        slug: track.slug,
        label: track.label,
      });
    }
  }
  const perks = [];
  for (const perkId of submission.perkIds) {
    const perk = await ctx.db.get(perkId);
    if (perk) {
      perks.push({
        _id: perk._id,
        company: perk.company,
        title: perk.title,
      });
    }
  }
  return {
    _id: submission._id,
    teamId: submission.teamId,
    teamName: team?.name,
    submittedBy: submission.submittedBy,
    name: submission.name,
    description: submission.description,
    urls: submission.urls,
    challengeIds: submission.challengeIds,
    perkIds: submission.perkIds,
    challenges,
    perks,
    status: submission.status,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    submittedAt: submission.submittedAt,
  };
}

async function resolveChallengeIds(
  ctx: MutationCtx,
  challengeIds: Id<"tracks">[],
  requireActive: boolean,
): Promise<Id<"tracks">[]> {
  const unique = uniqueIds(challengeIds);
  for (const trackId of unique) {
    const track = await ctx.db.get(trackId);
    if (!track) throw new Error("Reto no encontrado");
    if (requireActive && !track.active) {
      throw new Error(`${track.label} no está abierto`);
    }
  }
  return unique;
}

async function resolvePerkIds(
  ctx: MutationCtx,
  perkIds: Id<"perks">[],
): Promise<Id<"perks">[]> {
  const unique = uniqueIds(perkIds);
  for (const perkId of unique) {
    const perk = await ctx.db.get(perkId);
    if (!perk) throw new Error("Perk de partner no encontrado");
  }
  return unique;
}

function projectUrls(repoUrl?: string, demoUrl?: string) {
  return buildUrls([
    { kind: "repo", url: repoUrl },
    { kind: "demo", url: demoUrl },
  ]);
}

export const mine = onboardedQuery({
  args: {},
  returns: v.union(submissionReturn, v.null()),
  handler: async (ctx) => {
    const submission = await findOwnedSubmission(ctx, ctx.user._id);
    if (!submission) return null;
    return await hydrateSubmission(ctx, submission);
  },
});

const projectArgs = {
  name: v.string(),
  description: v.string(),
  repoUrl: v.optional(v.string()),
  demoUrl: v.optional(v.string()),
  challengeIds: v.array(v.id("tracks")),
  perkIds: v.array(v.id("perks")),
};

async function upsertProject(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: {
    name: string;
    description: string;
    repoUrl?: string;
    demoUrl?: string;
    challengeIds: Id<"tracks">[];
    perkIds: Id<"perks">[];
  },
  mode: "draft" | "submit",
) {
  const existing = await findOwnedSubmission(ctx, ctx.user._id);
  if (existing && existing.status === "submitted") {
    throw new Error("Este proyecto ya está enviado");
  }

  const name = args.name.trim();
  const description = args.description.trim();
  const challengeIds = await resolveChallengeIds(
    ctx,
    args.challengeIds,
    mode === "submit",
  );
  const perkIds = await resolvePerkIds(ctx, args.perkIds);

  if (mode === "submit") {
    if (!(await submissionsAreOpen(ctx))) {
      throw new Error("El envío de proyectos aún no está abierto");
    }
    if (name.length < 2) throw new Error("El nombre del proyecto es obligatorio");
    if (description.length < 10) {
      throw new Error("Añade una descripción breve del proyecto");
    }
    if (challengeIds.length === 0) {
      throw new Error("Elige al menos un reto");
    }
  }

  const membership = await membershipForUser(ctx, ctx.user._id);
  const now = Date.now();
  const fields = {
    teamId: membership?.teamId,
    submittedBy: ctx.user._id,
    name,
    description,
    urls: projectUrls(args.repoUrl, args.demoUrl),
    challengeIds,
    perkIds,
    status: (mode === "submit" ? "submitted" : "draft") as "draft" | "submitted",
    updatedAt: now,
    ...(mode === "submit" ? { submittedAt: now } : {}),
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return await ctx.db.insert("submissions", {
    ...fields,
    createdAt: now,
  });
}

export const saveDraft = onboardedMutation({
  args: projectArgs,
  returns: v.id("submissions"),
  handler: async (ctx, args) => await upsertProject(ctx, args, "draft"),
});

export const submit = onboardedMutation({
  args: projectArgs,
  returns: v.id("submissions"),
  handler: async (ctx, args) => await upsertProject(ctx, args, "submit"),
});

const publicSubmissionReturn = v.object({
  _id: v.id("submissions"),
  teamId: v.optional(v.id("teams")),
  teamName: v.optional(v.string()),
  name: v.string(),
  description: v.string(),
  urls: urlsValidator,
  challenges: v.array(challengeSummary),
  status: submissionStatusValidator,
  updatedAt: v.number(),
  submittedAt: v.optional(v.number()),
});

export const listPublic = onboardedQuery({
  args: {},
  returns: v.array(publicSubmissionReturn),
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = [];
    for (const submission of submissions) {
      if (submission.status === "draft" && !submission.name.trim()) continue;
      const hydrated = await hydrateSubmission(ctx, submission);
      rows.push({
        _id: hydrated._id,
        teamId: hydrated.teamId,
        teamName: hydrated.teamName,
        name: hydrated.name,
        description: hydrated.status === "submitted" ? hydrated.description : "",
        urls: hydrated.urls,
        challenges: hydrated.challenges,
        status: hydrated.status,
        updatedAt: hydrated.updatedAt,
        submittedAt: hydrated.submittedAt,
      });
    }
    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });
  },
});

export const adminList = adminQuery({
  args: {},
  returns: v.array(submissionReturn),
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = await Promise.all(
      submissions.map((row) => hydrateSubmission(ctx, row)),
    );
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
