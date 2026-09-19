import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import {
  attendanceValidator,
  claimStatusValidator,
  roleValidator,
  signupPublicValidator,
  submissionStatusValidator,
} from "./lib/validators";
import { countsAsAttending } from "./lib/attendance";
import { findSignupByEmail, findUserByEmail } from "./lib/auth";
import { parseEmailList } from "./lib/normalize";
import { urlsFromRecord, urlsValidator } from "./lib/urls";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import { userTypeSummaryValidator } from "./lib/userTypes";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { UrlEntry } from "./lib/urls";
import type { Role } from "./lib/validators";

async function teamForUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<{ name: string; status: string } | null> {
  const membership = await membershipForUser(ctx, userId);
  if (!membership) {
    return null;
  }
  const team = await ctx.db.get(membership.teamId);
  if (!team) {
    return null;
  }
  return { name: team.name, status: membership.status };
}

async function teamsByUserId(ctx: QueryCtx) {
  const [members, teams] = await Promise.all([
    ctx.db.query("teamMembers").collect(),
    ctx.db.query("teams").collect(),
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
  signupId: v.optional(v.id("signups")),
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
    hasAccount: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    /** Filter by assigned type; "none" keeps only users without one. */
    userType: v.optional(v.union(v.id("userTypes"), v.literal("none"))),
  },
  handler: async (ctx, args) => {
    const signups = await ctx.db.query("signups").collect();
    const users = await ctx.db.query("users").collect();
    const teamMap = await teamsByUserId(ctx);
    const types = await ctx.db.query("userTypes").collect();
    const typeLabels = new Map(types.map((type) => [type._id, type.label]));
    const typeLabelOf = (user: (typeof users)[number] | undefined) =>
      user?.userTypeId ? typeLabels.get(user.userTypeId) : undefined;
    const usersBySignup = new Map(
      users
        .filter((user) => user.signupId !== undefined)
        .map((user) => [user.signupId as string, user])
    );
    const usersByEmail = new Map(
      users
        .filter((user) => user.email)
        .map((user) => [user.email as string, user])
    );

    const rows = [];
    const seenUserIds = new Set<string>();

    for (const signup of signups) {
      const user =
        usersBySignup.get(signup._id) ?? usersByEmail.get(signup.email);
      if (user) {
        seenUserIds.add(user._id);
      }

      const team = user ? teamMap.get(user._id) : undefined;

      rows.push({
        signupId: signup._id,
        userId: user?._id,
        email: signup.email,
        name: user?.name ?? signup.fullName,
        role: user?.role,
        accepted: signup.accepted === true,
        phone: user?.phone,
        dietaryRestrictions: user?.dietaryRestrictions,
        travelOrigin: user?.travelOrigin,
        attendanceStatus: user?.attendanceStatus,
        onboardingComplete: user?.onboardingComplete,
        isRegistered: true,
        hasAccount: Boolean(user),
        teamName: team?.name,
        wantsAmbassador: signup.wantsAmbassador,
        createdAt: signup.createdAt,
        userTypeId: user?.userTypeId,
        userTypeLabel: typeLabelOf(user),
      });
    }

    for (const user of users) {
      if (seenUserIds.has(user._id)) {
        continue;
      }
      const team = teamMap.get(user._id);
      rows.push({
        userId: user._id,
        email: user.email ?? "unknown",
        name: user.name ?? "Unknown",
        role: user.role,
        accepted: false,
        phone: user.phone,
        dietaryRestrictions: user.dietaryRestrictions,
        travelOrigin: user.travelOrigin,
        attendanceStatus: user.attendanceStatus,
        onboardingComplete: user.onboardingComplete,
        isRegistered: false,
        hasAccount: true,
        teamName: team?.name,
        createdAt: user._creationTime,
        userTypeId: user.userTypeId,
        userTypeLabel: typeLabelOf(user),
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
        if (args.role && row.role !== args.role) {
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
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(lastPage, Math.max(1, Math.floor(args.page ?? 1)));
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
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
    signupId: v.optional(v.id("signups")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const signup = args.signupId ? await ctx.db.get(args.signupId) : null;
    let user = args.userId ? await ctx.db.get(args.userId) : null;
    if (!user && signup) {
      user =
        (await ctx.db
          .query("users")
          .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
          .unique()) ??
        (await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", signup.email))
          .unique());
    }
    if (!signup && !user) {
      return null;
    }

    const email = user?.email ?? signup?.email;
    const ambassador = email
      ? await ctx.db
          .query("ambassadorApplications")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique()
      : null;

    const team = user
      ? ((await teamForUser(ctx, user._id)) ?? undefined)
      : undefined;
    const userType = user?.userTypeId
      ? await ctx.db.get(user.userTypeId)
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
      signup: signup
        ? {
            _id: signup._id,
            email: signup.email,
            fullName: signup.fullName,
            urls: urlsFromRecord(signup),
            achievements: signup.achievements,
            freeTime: signup.freeTime,
            wantsAmbassador: signup.wantsAmbassador,
            ambassadorMotivation: signup.ambassadorMotivation,
            ambassadorStudyWhere: signup.ambassadorStudyWhere,
            accepted: signup.accepted === true,
            createdAt: signup.createdAt,
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
            dietaryRestrictions: user.dietaryRestrictions,
            dietaryDetails: user.dietaryDetails,
            travelOrigin: user.travelOrigin,
            attendanceStatus: user.attendanceStatus,
            onboardingComplete: user.onboardingComplete,
            adminNotes: user.adminNotes,
            userType: userType
              ? {
                  _id: userType._id,
                  description: userType.description,
                  isDefault: userType.isDefault,
                  label: userType.label,
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
    };
  },
  returns: v.union(
    v.object({
      signup: v.optional(
        v.object({
          _id: v.id("signups"),
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
          attendanceStatus: attendanceValidator,
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
    await ctx.db.patch(user._id, { role: args.role });
    return null;
  },
  returns: v.null(),
});

export const setUserType = adminMutation({
  args: { typeId: v.union(v.id("userTypes"), v.null()), userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    if (args.typeId) {
      const type = await ctx.db.get(args.typeId);
      if (!type) {
        throw new Error("Tipo no encontrado");
      }
      await ctx.db.patch(user._id, { userTypeId: type._id });
    } else {
      await ctx.db.patch(user._id, { userTypeId: undefined });
    }
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
): Promise<"added" | "updated" | "skipped"> {
  const existingUser = await findUserByEmail(ctx, email);
  const signup = await findSignupByEmail(ctx, email);
  const fullName = name ?? signup?.fullName ?? nameFromEmail(email);

  if (existingUser) {
    if (existingUser._id === actorId && role !== "admin") {
      throw new Error("No puedes quitarte el rol de admin a ti mismo");
    }
    if (signup && role === "user" && signup.accepted !== true) {
      await ctx.db.patch(signup._id, { accepted: true });
    }
    const patch: {
      name?: string;
      role?: Role;
      signupId?: Id<"signups">;
      userTypeId?: Id<"userTypes">;
    } = {};
    if (existingUser.role !== role) {
      patch.role = role;
    }
    if (userTypeId && existingUser.userTypeId !== userTypeId) {
      patch.userTypeId = userTypeId;
    }
    if (!existingUser.name) {
      patch.name = fullName;
    }
    if (signup && !existingUser.signupId) {
      patch.signupId = signup._id;
    }
    if (Object.keys(patch).length === 0) {
      return "skipped";
    }
    await ctx.db.patch(existingUser._id, patch);
    return existingUser.role === role &&
      (!userTypeId || existingUser.userTypeId === userTypeId)
      ? "skipped"
      : "updated";
  }

  let signupId = signup?._id;
  if (role === "user") {
    if (!signupId) {
      signupId = await ctx.db.insert("signups", {
        email,
        fullName,
        urls: [],
        wantsAmbassador: false,
        accepted: true,
        createdAt: Date.now(),
      });
    } else if (signup && signup.accepted !== true) {
      await ctx.db.patch(signup._id, { accepted: true });
    }
  }

  await ctx.db.insert("users", {
    email,
    name: fullName,
    role,
    signupId,
    userTypeId,
    notificationConsent: false,
    attendanceStatus: "attending",
    onboardingComplete: false,
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
    let skipped = 0;
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
      } else if (result === "updated") {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return {
      added,
      updated,
      skipped,
      invalid: parsed.invalid,
    };
  },
  returns: v.object({
    added: v.number(),
    updated: v.number(),
    skipped: v.number(),
    invalid: v.array(v.string()),
  }),
});

export const setAccepted = adminMutation({
  args: { accepted: v.boolean(), signupId: v.id("signups") },
  handler: async (ctx, args) => {
    const signup = await ctx.db.get(args.signupId);
    if (!signup) {
      throw new Error("Solicitud no encontrada");
    }
    await ctx.db.patch(signup._id, { accepted: args.accepted });
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
    await ctx.db.patch(user._id, { attendanceStatus: args.attendanceStatus });
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
