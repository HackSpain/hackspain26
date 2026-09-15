import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { fail } from "./lib/errors";
import {
  isHttpUrl,
  normalizeInputs,
  validateAnswers,
  type PerkInput,
} from "./lib/perkInputs";
import { membershipForUser } from "./lib/team";
import {
  claimStatusValidator,
  perkAnswerValidator,
  perkInputValidator,
  perkTypeValidator,
} from "./lib/validators";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

function perkFields(perk: Doc<"perks">) {
  return {
    _id: perk._id,
    company: perk.company,
    title: perk.title,
    value: perk.value,
    description: perk.description,
    type: perk.type,
    sponsorUrl: perk.sponsorUrl,
    inputs: perk.inputs ?? [],
    active: perk.active,
  };
}

async function claimWithCode(
  ctx: QueryCtx,
  claim: Doc<"perkClaims">,
  perk: Doc<"perks">,
) {
  let code: string | undefined;
  if (claim.codeId) {
    const assigned = await ctx.db.get(claim.codeId);
    code = assigned?.code;
  }
  return {
    _id: claim._id,
    perkId: claim.perkId,
    title: perk.title,
    company: perk.company,
    type: claim.type,
    status: claim.status,
    code,
    answers: claim.answers ?? [],
    createdAt: claim.createdAt,
  };
}

function cleanSponsorUrl(raw: string): string | undefined {
  const url = raw.trim();
  if (!url) return undefined;
  if (!isHttpUrl(url)) throw new Error("La URL del sponsor debe empezar por http:// o https://");
  return url;
}

function cleanInputs(raw: PerkInput[]): PerkInput[] {
  const result = normalizeInputs(raw);
  if (!result.ok) throw new Error(result.message);
  return result.inputs;
}

const perkReturn = v.object({
  _id: v.id("perks"),
  company: v.string(),
  title: v.string(),
  value: v.string(),
  description: v.string(),
  type: perkTypeValidator,
  sponsorUrl: v.optional(v.string()),
  inputs: v.array(perkInputValidator),
  active: v.boolean(),
  availableCodes: v.optional(v.number()),
});

const claimReturn = v.object({
  _id: v.id("perkClaims"),
  perkId: v.id("perks"),
  title: v.string(),
  company: v.string(),
  type: perkTypeValidator,
  status: claimStatusValidator,
  code: v.optional(v.string()),
  answers: v.array(perkAnswerValidator),
  createdAt: v.number(),
});

export const listCatalog = onboardedQuery({
  args: {},
  returns: v.array(
    v.object({
      perk: perkReturn,
      claim: v.union(claimReturn, v.null()),
    }),
  ),
  handler: async (ctx) => {
    const perks = await ctx.db
      .query("perks")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const result = [];
    for (const perk of perks) {
      const claim = await ctx.db
        .query("perkClaims")
        .withIndex("by_perk_and_user", (q) =>
          q.eq("perkId", perk._id).eq("userId", ctx.user._id),
        )
        .unique();
      let availableCodes: number | undefined;
      if (perk.type === "code") {
        const unused = await ctx.db
          .query("perkCodes")
          .withIndex("by_perk_available", (q) =>
            q.eq("perkId", perk._id).eq("available", true),
          )
          .collect();
        availableCodes = unused.length;
      }
      result.push({
        perk: { ...perkFields(perk), availableCodes },
        claim: claim ? await claimWithCode(ctx, claim, perk) : null,
      });
    }
    return result;
  },
});

export const myClaims = onboardedQuery({
  args: {},
  returns: v.array(claimReturn),
  handler: async (ctx) => {
    const claims = await ctx.db
      .query("perkClaims")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const rows = [];
    for (const claim of claims) {
      const perk = await ctx.db.get(claim.perkId);
      if (!perk) continue;
      rows.push(await claimWithCode(ctx, claim, perk));
    }
    return rows;
  },
});

export const claim = onboardedMutation({
  args: {
    perkId: v.id("perks"),
    answers: v.optional(v.array(perkAnswerValidator)),
  },
  returns: v.id("perkClaims"),
  handler: async (ctx, args) => {
    const perk = await ctx.db.get(args.perkId);
    if (!perk || !perk.active) throw new Error("Perk no encontrado");
    const existing = await ctx.db
      .query("perkClaims")
      .withIndex("by_perk_and_user", (q) =>
        q.eq("perkId", perk._id).eq("userId", ctx.user._id),
      )
      .unique();
    if (existing) throw new Error("Ya has reclamado este perk");

    const checked = validateAnswers(perk.inputs ?? [], args.answers);
    if (!checked.ok) fail("VALIDATION", checked.message);
    const answers = checked.answers.length > 0 ? checked.answers : undefined;

    const now = Date.now();
    if (perk.type === "code") {
      const unused = await ctx.db
        .query("perkCodes")
        .withIndex("by_perk_available", (q) =>
          q.eq("perkId", perk._id).eq("available", true),
        )
        .first();
      if (!unused) throw new Error("No quedan códigos para este perk");
      await ctx.db.patch(unused._id, {
        available: false,
        assignedTo: ctx.user._id,
        assignedAt: now,
      });
      return await ctx.db.insert("perkClaims", {
        perkId: perk._id,
        userId: ctx.user._id,
        type: "code",
        status: "assigned",
        codeId: unused._id,
        answers,
        createdAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.insert("perkClaims", {
      perkId: perk._id,
      userId: ctx.user._id,
      type: "email",
      status: "pending",
      answers,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminList = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("perks"),
      company: v.string(),
      title: v.string(),
      value: v.string(),
      description: v.string(),
      type: perkTypeValidator,
      sponsorUrl: v.optional(v.string()),
      inputs: v.array(perkInputValidator),
      active: v.boolean(),
      codeCount: v.number(),
      availableCodes: v.number(),
      claimCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const perks = await ctx.db.query("perks").collect();
    const rows = [];
    for (const perk of perks) {
      const codes = await ctx.db
        .query("perkCodes")
        .withIndex("by_perk", (q) => q.eq("perkId", perk._id))
        .collect();
      const claims = await ctx.db
        .query("perkClaims")
        .withIndex("by_perk", (q) => q.eq("perkId", perk._id))
        .collect();
      rows.push({
        ...perkFields(perk),
        codeCount: codes.length,
        availableCodes: codes.filter((code) => code.available).length,
        claimCount: claims.length,
      });
    }
    return rows;
  },
});

export const adminCreate = adminMutation({
  args: {
    company: v.string(),
    title: v.string(),
    value: v.string(),
    description: v.string(),
    type: perkTypeValidator,
    sponsorUrl: v.optional(v.string()),
    inputs: v.optional(v.array(perkInputValidator)),
    codes: v.optional(v.array(v.string())),
  },
  returns: v.id("perks"),
  handler: async (ctx, args) => {
    const company = args.company.trim();
    const title = args.title.trim();
    if (!company || !title) {
      throw new Error("La empresa y el título son obligatorios");
    }
    const sponsorUrl = cleanSponsorUrl(args.sponsorUrl ?? "");
    const inputs = cleanInputs(args.inputs ?? []);
    const now = Date.now();
    const perkId = await ctx.db.insert("perks", {
      company,
      title,
      value: args.value.trim(),
      description: args.description.trim(),
      type: args.type,
      sponsorUrl,
      inputs: inputs.length > 0 ? inputs : undefined,
      active: true,
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
    if (args.type === "code") {
      const unique = new Set(
        (args.codes ?? [])
          .map((code) => code.trim())
          .filter((code) => code.length > 0),
      );
      for (const code of unique) {
        await ctx.db.insert("perkCodes", {
          perkId,
          code,
          available: true,
        });
      }
    }
    return perkId;
  },
});

export const adminUpdate = adminMutation({
  args: {
    perkId: v.id("perks"),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    value: v.optional(v.string()),
    description: v.optional(v.string()),
    /** Empty string clears the link. */
    sponsorUrl: v.optional(v.string()),
    inputs: v.optional(v.array(perkInputValidator)),
    active: v.optional(v.boolean()),
    codesToAdd: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const perk = await ctx.db.get(args.perkId);
    if (!perk) throw new Error("Perk no encontrado");
    const patch: Partial<Doc<"perks">> = { updatedAt: Date.now() };
    if (args.company !== undefined) {
      const company = args.company.trim();
      if (!company) throw new Error("La empresa no puede estar vacía");
      patch.company = company;
    }
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("El título no puede estar vacío");
      patch.title = title;
    }
    if (args.value !== undefined) patch.value = args.value.trim();
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.sponsorUrl !== undefined) patch.sponsorUrl = cleanSponsorUrl(args.sponsorUrl);
    if (args.inputs !== undefined) {
      const inputs = cleanInputs(args.inputs);
      patch.inputs = inputs.length > 0 ? inputs : undefined;
    }
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(perk._id, patch);

    if (perk.type === "code" && args.codesToAdd) {
      const existing = await ctx.db
        .query("perkCodes")
        .withIndex("by_perk", (q) => q.eq("perkId", perk._id))
        .collect();
      const have = new Set(existing.map((row) => row.code));
      for (const raw of args.codesToAdd) {
        const code = raw.trim();
        if (!code || have.has(code)) continue;
        await ctx.db.insert("perkCodes", {
          perkId: perk._id,
          code,
          available: true,
        });
        have.add(code);
      }
    }
    return null;
  },
});

async function teamNameFor(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const membership = await membershipForUser(ctx, userId);
  if (!membership) return undefined;
  const team = await ctx.db.get(membership.teamId);
  return team?.name;
}

/** Every participant who claimed or applied for one perk, with their answers. */
export const adminRequests = adminQuery({
  args: { perkId: v.id("perks") },
  returns: v.array(
    v.object({
      _id: v.id("perkClaims"),
      userId: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      teamName: v.optional(v.string()),
      answers: v.array(perkAnswerValidator),
      status: claimStatusValidator,
      code: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query("perkClaims")
      .withIndex("by_perk", (q) => q.eq("perkId", args.perkId))
      .collect();
    const rows = [];
    for (const claim of claims) {
      const user = await ctx.db.get(claim.userId);
      let code: string | undefined;
      if (claim.codeId) {
        const assigned = await ctx.db.get(claim.codeId);
        code = assigned?.code;
      }
      rows.push({
        _id: claim._id,
        userId: claim.userId,
        name: user?.name,
        email: user?.email,
        teamName: await teamNameFor(ctx, claim.userId),
        answers: claim.answers ?? [],
        status: claim.status,
        code,
        createdAt: claim.createdAt,
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminApplications = adminQuery({
  args: {
    status: v.optional(claimStatusValidator),
  },
  returns: v.array(
    v.object({
      _id: v.id("perkClaims"),
      perkId: v.id("perks"),
      title: v.string(),
      company: v.string(),
      userId: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      status: claimStatusValidator,
      answers: v.array(v.object({ label: v.string(), value: v.string() })),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const claims = args.status
      ? await ctx.db
          .query("perkClaims")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("perkClaims").collect();
    const emailClaims = claims.filter((claim) => claim.type === "email");
    const rows = [];
    for (const claim of emailClaims) {
      const perk = await ctx.db.get(claim.perkId);
      const user = await ctx.db.get(claim.userId);
      if (!perk) continue;
      const labels = new Map((perk.inputs ?? []).map((input) => [input.key, input.label]));
      rows.push({
        _id: claim._id,
        perkId: claim.perkId,
        title: perk.title,
        company: perk.company,
        userId: claim.userId,
        email: user?.email,
        name: user?.name,
        status: claim.status,
        answers: (claim.answers ?? []).map((answer) => ({
          label: labels.get(answer.key) ?? answer.key,
          value: answer.value,
        })),
        createdAt: claim.createdAt,
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminSetApplicationStatus = adminMutation({
  args: {
    claimId: v.id("perkClaims"),
    status: v.union(v.literal("pending"), v.literal("added"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Solicitud no encontrada");
    if (claim.type !== "email") {
      throw new Error("Aquí solo se revisan solicitudes de perks por email");
    }
    await ctx.db.patch(claim._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});
