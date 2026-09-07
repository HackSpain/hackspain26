import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { claimStatusValidator, perkTypeValidator } from "./lib/validators";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

function perkFields(perk: Doc<"perks">) {
  return {
    _id: perk._id,
    active: perk.active,
    company: perk.company,
    description: perk.description,
    title: perk.title,
    type: perk.type,
    value: perk.value,
  };
}

async function claimWithCode(
  ctx: QueryCtx,
  claim: Doc<"perkClaims">,
  perk: Doc<"perks">
) {
  let code: string | undefined;
  if (claim.codeId) {
    const assigned = await ctx.db.get(claim.codeId);
    code = assigned?.code;
  }
  return {
    _id: claim._id,
    code,
    company: perk.company,
    createdAt: claim.createdAt,
    perkId: claim.perkId,
    status: claim.status,
    title: perk.title,
    type: claim.type,
  };
}

const perkReturn = v.object({
  _id: v.id("perks"),
  active: v.boolean(),
  availableCodes: v.optional(v.number()),
  company: v.string(),
  description: v.string(),
  title: v.string(),
  type: perkTypeValidator,
  value: v.string(),
});

const claimReturn = v.object({
  _id: v.id("perkClaims"),
  code: v.optional(v.string()),
  company: v.string(),
  createdAt: v.number(),
  perkId: v.id("perks"),
  status: claimStatusValidator,
  title: v.string(),
  type: perkTypeValidator,
});

export const listCatalog = onboardedQuery({
  args: {},
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
          q.eq("perkId", perk._id).eq("userId", ctx.user._id)
        )
        .unique();
      let availableCodes: number | undefined;
      if (perk.type === "code") {
        const unused = await ctx.db
          .query("perkCodes")
          .withIndex("by_perk_available", (q) =>
            q.eq("perkId", perk._id).eq("available", true)
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
  returns: v.array(
    v.object({
      perk: perkReturn,
      claim: v.union(claimReturn, v.null()),
    })
  ),
});

export const myClaims = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const claims = await ctx.db
      .query("perkClaims")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const rows = [];
    for (const claim of claims) {
      const perk = await ctx.db.get(claim.perkId);
      if (!perk) {
        continue;
      }
      rows.push(await claimWithCode(ctx, claim, perk));
    }
    return rows;
  },
  returns: v.array(claimReturn),
});

export const claim = onboardedMutation({
  args: { perkId: v.id("perks") },
  handler: async (ctx, args) => {
    const perk = await ctx.db.get(args.perkId);
    if (!perk || !perk.active) {
      throw new Error("Perk no encontrado");
    }
    const existing = await ctx.db
      .query("perkClaims")
      .withIndex("by_perk_and_user", (q) =>
        q.eq("perkId", perk._id).eq("userId", ctx.user._id)
      )
      .unique();
    if (existing) {
      throw new Error("Ya has reclamado este perk");
    }

    const now = Date.now();
    if (perk.type === "code") {
      const unused = await ctx.db
        .query("perkCodes")
        .withIndex("by_perk_available", (q) =>
          q.eq("perkId", perk._id).eq("available", true)
        )
        .first();
      if (!unused) {
        throw new Error("No quedan códigos para este perk");
      }
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
        createdAt: now,
        updatedAt: now,
      });
    }

    return await ctx.db.insert("perkClaims", {
      perkId: perk._id,
      userId: ctx.user._id,
      type: "email",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
  returns: v.id("perkClaims"),
});

export const adminList = adminQuery({
  args: {},
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
  returns: v.array(
    v.object({
      _id: v.id("perks"),
      company: v.string(),
      title: v.string(),
      value: v.string(),
      description: v.string(),
      type: perkTypeValidator,
      active: v.boolean(),
      codeCount: v.number(),
      availableCodes: v.number(),
      claimCount: v.number(),
    })
  ),
});

export const adminCreate = adminMutation({
  args: {
    codes: v.optional(v.array(v.string())),
    company: v.string(),
    description: v.string(),
    title: v.string(),
    type: perkTypeValidator,
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const company = args.company.trim();
    const title = args.title.trim();
    if (!company || !title) {
      throw new Error("La empresa y el título son obligatorios");
    }
    const now = Date.now();
    const perkId = await ctx.db.insert("perks", {
      company,
      title,
      value: args.value.trim(),
      description: args.description.trim(),
      type: args.type,
      active: true,
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
    if (args.type === "code") {
      const unique = new Set(
        (args.codes ?? [])
          .map((code) => code.trim())
          .filter((code) => code.length > 0)
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
  returns: v.id("perks"),
});

export const adminUpdate = adminMutation({
  args: {
    active: v.optional(v.boolean()),
    codesToAdd: v.optional(v.array(v.string())),
    company: v.optional(v.string()),
    description: v.optional(v.string()),
    perkId: v.id("perks"),
    title: v.optional(v.string()),
    value: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const perk = await ctx.db.get(args.perkId);
    if (!perk) {
      throw new Error("Perk no encontrado");
    }
    const patch: {
      company?: string;
      title?: string;
      value?: string;
      description?: string;
      active?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.company !== undefined) {
      const company = args.company.trim();
      if (!company) {
        throw new Error("La empresa no puede estar vacía");
      }
      patch.company = company;
    }
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) {
        throw new Error("El título no puede estar vacío");
      }
      patch.title = title;
    }
    if (args.value !== undefined) {
      patch.value = args.value.trim();
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }
    if (args.active !== undefined) {
      patch.active = args.active;
    }
    await ctx.db.patch(perk._id, patch);

    if (perk.type === "code" && args.codesToAdd) {
      const existing = await ctx.db
        .query("perkCodes")
        .withIndex("by_perk", (q) => q.eq("perkId", perk._id))
        .collect();
      const have = new Set(existing.map((row) => row.code));
      for (const raw of args.codesToAdd) {
        const code = raw.trim();
        if (!code || have.has(code)) {
          continue;
        }
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
  returns: v.null(),
});

export const adminApplications = adminQuery({
  args: {
    status: v.optional(claimStatusValidator),
  },
  handler: async (ctx, args) => {
    const status = args.status;
    const claims = status
      ? await ctx.db
          .query("perkClaims")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("perkClaims").collect();
    const emailClaims = claims.filter(
      (perkClaim) => perkClaim.type === "email"
    );
    const rows = [];
    for (const emailClaim of emailClaims) {
      const perk = await ctx.db.get(emailClaim.perkId);
      const user = await ctx.db.get(emailClaim.userId);
      if (!perk) {
        continue;
      }
      rows.push({
        _id: emailClaim._id,
        perkId: emailClaim.perkId,
        title: perk.title,
        company: perk.company,
        userId: emailClaim.userId,
        email: user?.email,
        name: user?.name,
        status: emailClaim.status,
        createdAt: emailClaim.createdAt,
      });
    }
    return rows.toSorted((a, b) => b.createdAt - a.createdAt);
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
      createdAt: v.number(),
    })
  ),
});

export const adminSetApplicationStatus = adminMutation({
  args: {
    claimId: v.id("perkClaims"),
    status: v.union(
      v.literal("pending"),
      v.literal("added"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.claimId);
    if (!application) {
      throw new Error("Solicitud no encontrada");
    }
    if (application.type !== "email") {
      throw new Error("Aquí solo se revisan solicitudes de perks por email");
    }
    await ctx.db.patch(application._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});
