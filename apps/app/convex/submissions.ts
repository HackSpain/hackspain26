import { v } from "convex/values";
import {
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import {
  countGroups,
  DEFAULT_GENERAL_GROUP_COUNT,
  JUDGING_SETTINGS_KEY,
  pickBalancedGroup,
} from "./lib/judging";
import { submissionStatusValidator } from "./lib/validators";
import { buildUrls, urlOf, urlsValidator } from "./lib/urls";
import { submissionsAreOpen } from "./tracks";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import { scheduleStackScan } from "./stack";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const challengeSummary = v.object({
  _id: v.id("tracks"),
  label: v.string(),
  slug: v.string(),
});

const perkSummary = v.object({
  _id: v.id("perks"),
  company: v.string(),
  title: v.string(),
});

const submissionReturn = v.object({
  _id: v.id("submissions"),
  challengeIds: v.array(v.id("tracks")),
  challenges: v.array(challengeSummary),
  createdAt: v.number(),
  description: v.string(),
  name: v.string(),
  perkIds: v.array(v.id("perks")),
  perks: v.array(perkSummary),
  status: submissionStatusValidator,
  submittedAt: v.optional(v.number()),
  submittedBy: v.id("users"),
  teamId: v.optional(v.id("teams")),
  teamName: v.optional(v.string()),
  techStack: v.array(v.string()),
  updatedAt: v.number(),
  urls: urlsValidator,
});

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)];
}

async function hydrateSubmission(
  ctx: QueryCtx | MutationCtx,
  submission: Doc<"submissions">
) {
  const team = submission.teamId ? await ctx.db.get(submission.teamId) : null;
  const challenges = [];
  for (const trackId of submission.challengeIds) {
    const track = await ctx.db.get(trackId);
    if (track) {
      challenges.push({
        _id: track._id,
        label: track.label,
        slug: track.slug,
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
    challengeIds: submission.challengeIds,
    challenges,
    createdAt: submission.createdAt,
    description: submission.description,
    name: submission.name,
    perkIds: submission.perkIds,
    perks,
    status: submission.status,
    submittedAt: submission.submittedAt,
    submittedBy: submission.submittedBy,
    teamId: submission.teamId,
    teamName: team?.name,
    techStack: submission.techStack ?? [],
    updatedAt: submission.updatedAt,
    urls: submission.urls,
  };
}

async function resolveChallengeIds(
  ctx: MutationCtx,
  challengeIds: Id<"tracks">[],
  requireActive: boolean
): Promise<Id<"tracks">[]> {
  const unique = uniqueIds(challengeIds);
  for (const trackId of unique) {
    const track = await ctx.db.get(trackId);
    if (!track) {
      throw new Error("Reto no encontrado");
    }
    if (requireActive && !track.active) {
      throw new Error(`${track.label} no está abierto`);
    }
  }
  return unique;
}

async function resolvePerkIds(
  ctx: MutationCtx,
  perkIds: Id<"perks">[]
): Promise<Id<"perks">[]> {
  const unique = uniqueIds(perkIds);
  for (const perkId of unique) {
    const perk = await ctx.db.get(perkId);
    if (!perk) {
      throw new Error("Perk de partner no encontrado");
    }
  }
  return unique;
}

async function nextGeneralGroup(ctx: MutationCtx): Promise<number> {
  const [settings, submitted] = await Promise.all([
    ctx.db
      .query("judgingSettings")
      .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
      .unique(),
    ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect(),
  ]);
  const groupCount = settings?.generalGroupCount ?? DEFAULT_GENERAL_GROUP_COUNT;
  return pickBalancedGroup(countGroups(submitted, groupCount), groupCount);
}

function projectUrls(repoUrl?: string, demoUrl?: string, videoUrl?: string) {
  return buildUrls([
    { kind: "repo", url: repoUrl },
    { kind: "demo", url: demoUrl },
    { kind: "video", url: videoUrl },
  ]);
}

export const mine = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const submission = await findOwnedSubmission(ctx, ctx.user._id);
    if (!submission) {
      return null;
    }
    return await hydrateSubmission(ctx, submission);
  },
  returns: v.union(submissionReturn, v.null()),
});

const projectArgs = {
  challengeIds: v.array(v.id("tracks")),
  demoUrl: v.optional(v.string()),
  description: v.string(),
  name: v.string(),
  perkIds: v.array(v.id("perks")),
  repoUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
};

async function upsertProject(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: {
    name: string;
    description: string;
    repoUrl?: string;
    demoUrl?: string;
    videoUrl?: string;
    challengeIds: Id<"tracks">[];
    perkIds: Id<"perks">[];
  },
  mode: "draft" | "submit"
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
    mode === "submit"
  );
  const perkIds = await resolvePerkIds(ctx, args.perkIds);

  if (mode === "submit") {
    if (!(await submissionsAreOpen(ctx))) {
      throw new Error("El envío de proyectos aún no está abierto");
    }
    if (name.length < 2) {
      throw new Error("El nombre del proyecto es obligatorio");
    }
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
    challengeIds,
    description,
    name,
    perkIds,
    status: (mode === "submit" ? "submitted" : "draft") as
      | "draft"
      | "submitted",
    submittedBy: ctx.user._id,
    teamId: membership?.teamId,
    updatedAt: now,
    urls: projectUrls(
      args.repoUrl,
      args.demoUrl,
      args.videoUrl ?? urlOf(existing?.urls, "video"),
    ),
    ...(mode === "submit"
      ? {
          submittedAt: now,
          generalGroup:
            existing?.generalGroup ?? (await nextGeneralGroup(ctx)),
        }
      : {}),
  };

  const submissionId = existing
    ? (await ctx.db.patch(existing._id, fields), existing._id)
    : await ctx.db.insert("submissions", {
        ...fields,
        createdAt: now,
      });
  const repoUrl = args.repoUrl ?? urlOf(fields.urls, "repo");
  if (repoUrl) {
    await scheduleStackScan(ctx, {
      force: mode === "submit",
      repoUrls: [repoUrl],
      submissionId,
      teamId: membership?.teamId,
      userId: ctx.user._id,
    });
  }
  return submissionId;
}

export const saveDraft = onboardedMutation({
  args: projectArgs,
  handler: async (ctx, args) => await upsertProject(ctx, args, "draft"),
  returns: v.id("submissions"),
});

export const submit = onboardedMutation({
  args: projectArgs,
  handler: async (ctx, args) => await upsertProject(ctx, args, "submit"),
  returns: v.id("submissions"),
});

const publicSubmissionReturn = v.object({
  _id: v.id("submissions"),
  challenges: v.array(challengeSummary),
  description: v.string(),
  name: v.string(),
  status: submissionStatusValidator,
  submittedAt: v.optional(v.number()),
  teamId: v.optional(v.id("teams")),
  teamName: v.optional(v.string()),
  updatedAt: v.number(),
  urls: urlsValidator,
});

export const listPublic = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = [];
    for (const submission of submissions) {
      if (submission.status === "draft" && !submission.name.trim()) {
        continue;
      }
      const hydrated = await hydrateSubmission(ctx, submission);
      rows.push({
        _id: hydrated._id,
        teamId: hydrated.teamId,
        teamName: hydrated.teamName,
        name: hydrated.name,
        description:
          hydrated.status === "submitted" ? hydrated.description : "",
        urls: hydrated.urls,
        challenges: hydrated.challenges,
        status: hydrated.status,
        updatedAt: hydrated.updatedAt,
        submittedAt: hydrated.submittedAt,
      });
    }
    return rows.toSorted((a, b) => {
      if (a.status !== b.status) {
        return a.status === "submitted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "es");
    });
  },
  returns: v.array(publicSubmissionReturn),
});

export const adminList = adminQuery({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = await Promise.all(
      submissions.map((row) => hydrateSubmission(ctx, row))
    );
    return rows.toSorted((a, b) => b.updatedAt - a.updatedAt);
  },
  returns: v.array(submissionReturn),
});
