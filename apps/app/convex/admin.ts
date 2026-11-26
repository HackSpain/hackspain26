import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import {
  attendanceValidator,
  claimStatusValidator,
  participationStatusValidator,
  roleValidator,
  signupPublicValidator,
  submissionStatusValidator,
} from "./lib/validators";
import { countsAsAttending } from "./lib/attendance";
import { findUserByEmail, isAdmin } from "./lib/auth";
import {
  currentEditionId,
  requireCurrentEdition,
  resolveEditionId,
} from "./lib/editions";
import {
  getCurrentParticipation,
  participationByEditionEmail,
  participationIsAccepted,
  participationIsRegistered,
} from "./lib/participations";
import { parseEmailList } from "./lib/normalize";
import { urlsValidator } from "./lib/urls";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import {
  typeOpenForApplications,
  typeRequiresConfirmed,
  userTypeSummaryValidator,
} from "./lib/userTypes";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { UrlEntry } from "./lib/urls";
import type { Role } from "./lib/validators";

async function teamForParticipant(
  ctx: QueryCtx,
  userId: Id<"users"> | undefined
): Promise<{
  _id: Id<"teams">;
  isOwner: boolean;
  name: string;
  status: string;
} | null> {
  const membership = userId
    ? await membershipForUser(ctx, userId, await currentEditionId(ctx))
    : null;
  if (!membership) {
    return null;
  }
  const team = await ctx.db.get(membership.teamId);
  if (!team) {
    return null;
  }
  return {
    _id: team._id,
    isOwner: Boolean(membership.userId && team.ownerId === membership.userId),
    name: team.name,
    status: membership.status,
  };
}

async function teamsByUserId(ctx: QueryCtx, editionId: Id<"editions">) {
  const [members, teams] = await Promise.all([
    ctx.db
      .query("teamMembers")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
    ctx.db
      .query("teams")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
  ]);
  const teamsById = new Map(teams.map((team) => [team._id, team]));
  const byUser = new Map<string, { name: string; status: string }>();
  for (const member of members) {
    if (!member.userId) {
      continue;
    }
    const existing = byUser.get(member.userId);
    if (existing?.status === "member") {
      continue;
    }
    if (existing && member.status !== "member") {
      continue;
    }
    const team = teamsById.get(member.teamId);
    if (!team) {
      continue;
    }
    byUser.set(member.userId, { name: team.name, status: member.status });
  }
  return byUser;
}

const participantSummary = v.object({
  accepted: v.boolean(),
  attendanceStatus: v.optional(attendanceValidator),
  createdAt: v.number(),
  dietaryRestrictions: v.optional(v.string()),
  email: v.string(),
  hasAccount: v.boolean(),
  isRegistered: v.boolean(),
  name: v.string(),
  onboardingComplete: v.optional(v.boolean()),
  phone: v.optional(v.string()),
  role: v.optional(roleValidator),
  signupId: v.optional(v.string()),
  status: participationStatusValidator,
  teamName: v.optional(v.string()),
  travelOrigin: v.optional(v.string()),
  userId: v.optional(v.id("users")),
  userTypeId: v.optional(v.id("userTypes")),
  userTypeLabel: v.optional(v.string()),
  wantsAmbassador: v.optional(v.boolean()),
});

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

export const listParticipants = adminQuery({
  args: {
    accepted: v.optional(v.boolean()),
    attendance: v.optional(attendanceValidator),
    editionId: v.optional(v.id("editions")),
    hasAccount: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    status: v.optional(participationStatusValidator),
    /** Filter by assigned type; "none" keeps only users without one. */
    userType: v.optional(v.union(v.id("userTypes"), v.literal("none"))),
  },
  handler: async (ctx, args) => {
    const editionId = await resolveEditionId(ctx, args.editionId);
    const status = args.status;
    const participations = status
      ? await ctx.db
          .query("participations")
          .withIndex("by_edition_status", (q) =>
            q.eq("editionId", editionId).eq("status", status)
          )
          .collect()
      : await ctx.db
          .query("participations")
          .withIndex("by_edition", (q) => q.eq("editionId", editionId))
          .collect();
    const teamMap = await teamsByUserId(ctx, editionId);
    const types = await ctx.db.query("userTypes").collect();
    const typeLabels = new Map(types.map((type) => [type._id, type.label]));

    const rows = [];

    for (const participation of participations) {
      const team = participation.userId
        ? teamMap.get(participation.userId)
        : undefined;
      rows.push({
        accepted: participationIsAccepted(participation.status),
        attendanceStatus: participation.attendanceStatus,
        createdAt: participation.createdAt,
        dietaryRestrictions: participation.dietaryRestrictions,
        email: participation.email,
        hasAccount: Boolean(participation.userId),
        isRegistered: participationIsRegistered(participation.status),
        name: participation.fullName ?? participation.email,
        onboardingComplete: participation.onboardingComplete,
        signupId: participation._id,
        status: participation.status,
        teamName: team?.name,
        travelOrigin: participation.travelOrigin,
        userId: participation.userId,
        userTypeId: participation.roleId,
        userTypeLabel: typeLabels.get(participation.roleId),
        wantsAmbassador: participation.wantsAmbassador,
      });
    }

    const needle = args.search?.trim().toLowerCase() ?? "";
    const filtered = rows
      .filter((row) => {
        if (args.attendance === "attending") {
          if (
            row.attendanceStatus === null ||
            row.attendanceStatus === undefined ||
            !countsAsAttending(row.attendanceStatus)
          ) {
            return false;
          }
        } else if (
          args.attendance &&
          row.attendanceStatus !== args.attendance
        ) {
          return false;
        }
        if (args.accepted !== undefined && row.accepted !== args.accepted) {
          return false;
        }
        if (args.userType === "none" && row.userTypeId !== undefined) {
          return false;
        }
        if (
          args.userType &&
          args.userType !== "none" &&
          row.userTypeId !== args.userType
        ) {
          return false;
        }
        if (
          args.hasAccount !== undefined &&
          row.hasAccount !== args.hasAccount
        ) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return (
          row.email.toLowerCase().includes(needle) ||
          row.name.toLowerCase().includes(needle) ||
          (row.teamName?.toLowerCase().includes(needle) ?? false)
        );
      })
      .toSorted((a, b) => b.createdAt - a.createdAt);

    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(args.pageSize ?? DEFAULT_PAGE_SIZE))
    );

    async function attachUser(row: (typeof filtered)[number]) {
      const user = row.userId
        ? await ctx.db.get(row.userId)
        : await findUserByEmail(ctx, row.email);
      return {
        ...row,
        hasAccount: Boolean(user),
        name: user?.name ?? row.name,
        phone: user?.phone,
        role: user?.role,
        userId: user?._id ?? row.userId,
      };
    }

    if (args.role) {
      const withRole = [];
      for (const row of filtered) {
        const attached = await attachUser(row);
        if (attached.role === args.role) {
          withRole.push(attached);
        }
      }
      const total = withRole.length;
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(lastPage, Math.max(1, Math.floor(args.page ?? 1)));
      const start = (page - 1) * pageSize;
      return {
        items: withRole.slice(start, start + pageSize),
        page,
        pageSize,
        total,
      };
    }

    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(lastPage, Math.max(1, Math.floor(args.page ?? 1)));
    const start = (page - 1) * pageSize;
    const items = await Promise.all(
      filtered.slice(start, start + pageSize).map((row) => attachUser(row))
    );

    return {
      items,
      total,
      page,
      pageSize,
    };
  },
  returns: v.object({
    items: v.array(participantSummary),
    total: v.number(),
    page: v.number(),
    pageSize: v.number(),
  }),
});

export const getParticipant = adminQuery({
  args: {
    signupId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const participation = args.signupId
      ? await ctx.db.get(args.signupId as Id<"participations">)
      : null;
    let user = args.userId ? await ctx.db.get(args.userId) : null;
    if (!user && participation?.userId) {
      user = await ctx.db.get(participation.userId);
    }
    if (!user && participation?.email) {
      user = await findUserByEmail(ctx, participation.email);
    }
    const resolved =
      participation ?? (user ? await getCurrentParticipation(ctx, user) : null);
    if (!resolved && !user) {
      return null;
    }
    const pass = user
      ? await ctx.db
          .query("eventPasses")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique()
      : null;

    const email = user?.email ?? resolved?.email;
    const ambassador = email
      ? await ctx.db
          .query("ambassadorApplications")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique()
      : null;

    const team = (await teamForParticipant(ctx, user?._id)) ?? undefined;
    const userType = resolved?.roleId
      ? await ctx.db.get(resolved.roleId)
      : null;

    const claims = [];
    let submission:
      | {
          _id: Id<"submissions">;
          name: string;
          description: string;
          urls: UrlEntry[];
          status: "draft" | "submitted";
          challengeLabels: string[];
          perkLabels: string[];
        }
      | undefined;
    if (user) {
      const rows = await ctx.db
        .query("perkClaims")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const claim of rows) {
        const perk = await ctx.db.get(claim.perkId);
        if (!perk) {
          continue;
        }
        let code: string | undefined;
        if (claim.codeId) {
          const assigned = await ctx.db.get(claim.codeId);
          code = assigned?.code;
        }
        claims.push({
          _id: claim._id,
          title: perk.title,
          company: perk.company,
          type: claim.type,
          status: claim.status,
          code,
        });
      }

      const owned = await findOwnedSubmission(ctx, user._id);
      if (owned) {
        const challengeLabels = [];
        for (const trackId of owned.challengeIds) {
          const track = await ctx.db.get(trackId);
          if (track) {
            challengeLabels.push(track.label);
          }
        }
        const perkLabels = [];
        for (const perkId of owned.perkIds) {
          const perk = await ctx.db.get(perkId);
          if (perk) {
            const label = [perk.company, perk.title]
              .map((part) => part.trim())
              .filter((part) => part.length > 0)
              .join(" · ");
            perkLabels.push(label || "Perk sin nombre");
          }
        }
        submission = {
          _id: owned._id,
          name: owned.name,
          description: owned.description,
          urls: owned.urls,
          status: owned.status,
          challengeLabels,
          perkLabels,
        };
      }
    }

    return {
      signup: resolved
        ? {
            _id: resolved._id,
            email: resolved.email,
            fullName: resolved.fullName ?? user?.name ?? resolved.email,
            urls: resolved.urls ?? [],
            achievements: resolved.achievements,
            freeTime: resolved.freeTime,
            wantsAmbassador: resolved.wantsAmbassador === true,
            ambassadorMotivation: resolved.ambassadorMotivation,
            ambassadorStudyWhere: resolved.ambassadorStudyWhere,
            accepted: participationIsAccepted(resolved.status),
            createdAt: resolved.createdAt,
          }
        : undefined,
      user: user
        ? {
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            notificationConsent: user.notificationConsent,
            dietaryRestrictions: resolved?.dietaryRestrictions,
            dietaryDetails: resolved?.dietaryDetails,
            travelOrigin: resolved?.travelOrigin,
            attendanceStatus: resolved?.attendanceStatus,
            onboardingComplete: resolved?.onboardingComplete === true,
            adminNotes: user.adminNotes,
            userType: userType
              ? {
                  _id: userType._id,
                  description: userType.description,
                  isDefault: userType.isDefault,
                  label: userType.label,
                  openForApplications: typeOpenForApplications(userType),
                  requiresConfirmed: typeRequiresConfirmed(userType),
                  sections: userType.sections,
                  slug: userType.slug,
                  sortOrder: userType.sortOrder,
                }
              : undefined,
          }
        : undefined,
      ambassador: ambassador
        ? {
            institution: ambassador.institution,
            cityRegion: ambassador.cityRegion,
            motivation: ambassador.motivation,
            outreachPlan: ambassador.outreachPlan,
          }
        : undefined,
      team,
      claims,
      submission,
      pass: pass
        ? {
            _id: pass._id,
            checkedInAt: pass.checkedInAt,
            status: pass.status,
          }
        : undefined,
    };
  },
  returns: v.union(
    v.object({
      signup: v.optional(
        v.object({
          _id: v.string(),
          ...signupPublicValidator.fields,
          ambassadorMotivation: v.optional(v.string()),
          ambassadorStudyWhere: v.optional(v.string()),
          accepted: v.boolean(),
          createdAt: v.number(),
        })
      ),
      user: v.optional(
        v.object({
          _id: v.id("users"),
          email: v.optional(v.string()),
          name: v.optional(v.string()),
          role: roleValidator,
          phone: v.optional(v.string()),
          notificationConsent: v.boolean(),
          dietaryRestrictions: v.optional(v.string()),
          dietaryDetails: v.optional(v.string()),
          travelOrigin: v.optional(v.string()),
          attendanceStatus: v.optional(attendanceValidator),
          onboardingComplete: v.boolean(),
          adminNotes: v.optional(v.string()),
          userType: v.optional(userTypeSummaryValidator),
        })
      ),
      ambassador: v.optional(
        v.object({
          institution: v.string(),
          cityRegion: v.string(),
          motivation: v.string(),
          outreachPlan: v.string(),
        })
      ),
      team: v.optional(
        v.object({
          _id: v.id("teams"),
          isOwner: v.boolean(),
          name: v.string(),
          status: v.string(),
        })
      ),
      claims: v.array(
        v.object({
          _id: v.id("perkClaims"),
          title: v.string(),
          company: v.string(),
          type: v.union(v.literal("email"), v.literal("code")),
          status: claimStatusValidator,
          code: v.optional(v.string()),
        })
      ),
      submission: v.optional(
        v.object({
          _id: v.id("submissions"),
          name: v.string(),
          description: v.string(),
          urls: urlsValidator,
          status: submissionStatusValidator,
          challengeLabels: v.array(v.string()),
          perkLabels: v.array(v.string()),
        })
      ),
      pass: v.optional(
        v.object({
          _id: v.id("eventPasses"),
          checkedInAt: v.optional(v.number()),
          status: v.union(v.literal("active"), v.literal("revoked")),
        })
      ),
    }),
    v.null()
  ),
});

export const setRole = adminMutation({
  args: { role: roleValidator, userId: v.id("users") },
  handler: async (ctx, args) => {
    if (args.role === "judge") {
      throw new Error("Los jueces se definen con un tipo de usuario");
    }
    if (args.userId === ctx.user._id && args.role !== "admin") {
      throw new Error("No puedes quitarte el rol de admin a ti mismo");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    await ctx.db.patch(user._id, {
      admin: args.role === "admin",
      role: args.role,
    });
    return null;
  },
  returns: v.null(),
});

export const setUserType = adminMutation({
  args: { typeId: v.id("userTypes"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    const participation = await getCurrentParticipation(ctx, user);
    if (!participation) {
      throw new Error("No hay participación en la edición en curso");
    }
    const type = await ctx.db.get(args.typeId);
    if (!type) {
      throw new Error("Tipo no encontrado");
    }
    await ctx.db.patch(participation._id, { roleId: type._id });
    return null;
  },
  returns: v.null(),
});

const MAX_ADD_PEOPLE = 50;

const addPeopleRoleValidator = v.union(v.literal("user"), v.literal("admin"));

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replaceAll(/[._+-]+/g, " ").trim() || email;
}

async function upsertPerson(
  ctx: MutationCtx,
  email: string,
  role: "user" | "admin",
  userTypeId: Id<"userTypes"> | undefined,
  name: string | undefined,
  actorId: Id<"users">
): Promise<"added" | "updated"> {
  const editionId = await currentEditionId(ctx);
  const existingUser = await findUserByEmail(ctx, email);
  const existingPart = await participationByEditionEmail(ctx, editionId, email);
  const fullName =
    name ??
    existingPart?.fullName ??
    existingUser?.name ??
    nameFromEmail(email);
  const roleId =
    userTypeId ??
    existingPart?.roleId ??
    (
      await ctx.db
        .query("userTypes")
        .withIndex("by_slug", (q) => q.eq("slug", "hacker"))
        .unique()
    )?._id;
  if (!roleId) {
    throw new Error("Tipo no encontrado");
  }

  if (existingUser) {
    if (existingUser._id === actorId && role !== "admin") {
      throw new Error("No puedes quitarte el rol de admin a ti mismo");
    }
    const patch: {
      admin?: boolean;
      name?: string;
      role?: Role;
    } = {};
    if (existingUser.role !== role) {
      patch.role = role;
    }
    if (isAdmin(existingUser) !== (role === "admin")) {
      patch.admin = role === "admin";
    }
    if (!existingUser.name) {
      patch.name = fullName;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existingUser._id, patch);
    }
    if (existingPart) {
      await ctx.db.patch(existingPart._id, {
        fullName,
        roleId,
        status: participationIsAccepted(existingPart.status)
          ? existingPart.status
          : "accepted",
        userId: existingUser._id,
      });
      return "updated";
    }
    await ctx.db.insert("participations", {
      attendanceStatus: "attending",
      createdAt: Date.now(),
      editionId,
      email,
      fullName,
      onboardingComplete: false,
      roleId,
      status: "accepted",
      userId: existingUser._id,
    });
    return "added";
  }

  const userId = await ctx.db.insert("users", {
    admin: role === "admin",
    email,
    name: fullName,
    notificationConsent: false,
    role,
  });
  await ctx.db.insert("participations", {
    attendanceStatus: "attending",
    createdAt: Date.now(),
    editionId,
    email,
    fullName,
    onboardingComplete: false,
    roleId,
    status: "accepted",
    userId,
  });
  return "added";
}

export const addPeople = adminMutation({
  args: {
    emails: v.array(v.string()),
    name: v.optional(v.string()),
    role: addPeopleRoleValidator,
    userTypeId: v.optional(v.id("userTypes")),
  },
  handler: async (ctx, args) => {
    await requireCurrentEdition(ctx);
    const parsed = parseEmailList(args.emails);
    if (parsed.emails.length === 0) {
      throw new Error("Añade al menos un email válido");
    }
    if (parsed.emails.length > MAX_ADD_PEOPLE) {
      throw new Error(`Como máximo ${MAX_ADD_PEOPLE} emails de una vez`);
    }
    if (args.userTypeId) {
      const type = await ctx.db.get(args.userTypeId);
      if (!type) {
        throw new Error("Tipo no encontrado");
      }
    }

    const name = args.name?.trim().replaceAll(/\s+/g, " ") || undefined;
    const singleName = parsed.emails.length === 1 ? name : undefined;

    let added = 0;
    let updated = 0;
    for (const email of parsed.emails) {
      const result = await upsertPerson(
        ctx,
        email,
        args.role,
        args.userTypeId,
        singleName,
        ctx.user._id
      );
      if (result === "added") {
        added += 1;
      } else {
        updated += 1;
      }
    }

    return {
      added,
      updated,
      invalid: parsed.invalid,
    };
  },
  returns: v.object({
    added: v.number(),
    updated: v.number(),
    invalid: v.array(v.string()),
  }),
});

export const setAccepted = adminMutation({
  args: { accepted: v.boolean(), signupId: v.string() },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(
      args.signupId as Id<"participations">
    );
    if (!participation) {
      throw new Error("Solicitud no encontrada");
    }
    const alreadyHadPlace =
      participation.status === "accepted" ||
      participation.status === "confirmed";
    let status: typeof participation.status = "applied";
    if (args.accepted) {
      status =
        participation.status === "confirmed"
          ? participation.status
          : "accepted";
    }
    const managementToken =
      participation.managementToken ?? crypto.randomUUID();
    await ctx.db.patch(participation._id, {
      managementToken,
      status,
    });
    if (args.accepted && !alreadyHadPlace) {
      await ctx.scheduler.runAfter(0, internal.landing.sendAcceptEmail, {
        participationId: participation._id,
      });
    }
    return null;
  },
  returns: v.null(),
});

export const setAttendance = adminMutation({
  args: { attendanceStatus: attendanceValidator, userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    const participation = await getCurrentParticipation(ctx, user);
    if (!participation) {
      throw new Error("No hay participación en la edición en curso");
    }
    await ctx.db.patch(participation._id, {
      attendanceStatus: args.attendanceStatus,
      ...(args.attendanceStatus === "cancelled"
        ? { status: "cancelled" as const }
        : {}),
    });
    return null;
  },
  returns: v.null(),
});

export const setNotes = adminMutation({
  args: { notes: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    await ctx.db.patch(user._id, { adminNotes: args.notes.trim() });
    return null;
  },
  returns: v.null(),
});

const bulkStatusValidator = v.union(
  v.literal("accepted"),
  v.literal("waitlist"),
  v.literal("rejected")
);

export const bulkSetStatus = adminMutation({
  args: {
    signupIds: v.array(v.string()),
    status: bulkStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireCurrentEdition(ctx);
    if (args.signupIds.length === 0) {
      throw new Error("Selecciona al menos una persona");
    }
    if (args.signupIds.length > MAX_ADD_PEOPLE) {
      throw new Error(`Como máximo ${MAX_ADD_PEOPLE} personas de una vez`);
    }
    let updated = 0;
    for (const signupId of args.signupIds) {
      const participation = await ctx.db.get(signupId as Id<"participations">);
      if (!participation) {
        continue;
      }
      const alreadyHadPlace =
        participation.status === "accepted" ||
        participation.status === "confirmed";
      const status =
        args.status === "accepted" && participation.status === "confirmed"
          ? participation.status
          : args.status;
      const managementToken =
        participation.managementToken ?? crypto.randomUUID();
      await ctx.db.patch(participation._id, { managementToken, status });
      if (args.status === "accepted" && !alreadyHadPlace) {
        await ctx.scheduler.runAfter(0, internal.landing.sendAcceptEmail, {
          participationId: participation._id,
        });
      }
      updated += 1;
    }
    return { updated };
  },
  returns: v.object({ updated: v.number() }),
});

export const bulkSetRole = adminMutation({
  args: {
    roleId: v.id("userTypes"),
    signupIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCurrentEdition(ctx);
    if (args.signupIds.length === 0) {
      throw new Error("Selecciona al menos una persona");
    }
    if (args.signupIds.length > MAX_ADD_PEOPLE) {
      throw new Error(`Como máximo ${MAX_ADD_PEOPLE} personas de una vez`);
    }
    const type = await ctx.db.get(args.roleId);
    if (!type) {
      throw new Error("Tipo no encontrado");
    }
    let updated = 0;
    for (const signupId of args.signupIds) {
      const participation = await ctx.db.get(signupId as Id<"participations">);
      if (!participation) {
        continue;
      }
      await ctx.db.patch(participation._id, { roleId: type._id });
      updated += 1;
    }
    return { updated };
  },
  returns: v.object({ updated: v.number() }),
});
