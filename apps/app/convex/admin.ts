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
import { urlsFromRecord, urlsValidator } from "./lib/urls";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { UrlEntry } from "./lib/urls";

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
  },
  handler: async (ctx, args) => {
    const signups = await ctx.db.query("signups").collect();
    const users = await ctx.db.query("users").collect();
    const teamMap = await teamsByUserId(ctx);
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
            phoneConfirmed: user.phoneConfirmed,
            notificationConsent: user.notificationConsent,
            dietaryRestrictions: user.dietaryRestrictions,
            dietaryDetails: user.dietaryDetails,
            travelOrigin: user.travelOrigin,
            attendanceStatus: user.attendanceStatus,
            onboardingComplete: user.onboardingComplete,
            adminNotes: user.adminNotes,
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
          phoneConfirmed: v.boolean(),
          notificationConsent: v.boolean(),
          dietaryRestrictions: v.optional(v.string()),
          dietaryDetails: v.optional(v.string()),
          travelOrigin: v.optional(v.string()),
          attendanceStatus: attendanceValidator,
          onboardingComplete: v.boolean(),
          adminNotes: v.optional(v.string()),
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
