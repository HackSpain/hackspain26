import { v } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getSignupForUser } from "./lib/auth";
import {
  FINAL_EMAIL_LOGO_URL,
  FINAL_EMAIL_SUBJECT,
  finalEmailHtml,
  finalEmailText,
  firstNameFrom,
} from "./lib/finalEmail";
import { membershipForUser } from "./lib/team";
import { finalistStatusValidator } from "./lib/validators";

const RESEND_BATCH_LIMIT = 100;
const SEARCH_LIMIT = 20;

const personRefValidator = v.object({
  signupId: v.optional(v.id("signups")),
  userId: v.optional(v.id("users")),
});

function siteOrigin(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function newCancelToken(): string {
  return crypto.randomUUID();
}

function cancelUrlFor(token: string): string {
  const url = new URL("/final/cancelar", siteOrigin());
  url.searchParams.set("token", token);
  return url.toString();
}

async function existingFinalist(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users"> | undefined,
  signupId: Id<"signups"> | undefined
): Promise<Doc<"finalists"> | null> {
  if (userId) {
    const byUser = await ctx.db
      .query("finalists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (byUser) {
      return byUser;
    }
  }
  if (signupId) {
    const bySignup = await ctx.db
      .query("finalists")
      .withIndex("by_signup", (q) => q.eq("signupId", signupId))
      .first();
    if (bySignup) {
      return bySignup;
    }
  }
  return null;
}

async function resolvePerson(
  ctx: QueryCtx | MutationCtx,
  ref: { userId?: Id<"users">; signupId?: Id<"signups"> }
): Promise<{
  email: string;
  name: string;
  signupId?: Id<"signups">;
  userId?: Id<"users">;
} | null> {
  const user = ref.userId ? await ctx.db.get(ref.userId) : null;
  let signup = ref.signupId ? await ctx.db.get(ref.signupId) : null;
  if (!signup && user) {
    signup = await getSignupForUser(ctx, user);
  }
  if (!user && signup) {
    const bySignup = await ctx.db
      .query("users")
      .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
      .unique();
    const byEmail = bySignup
      ? null
      : await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", signup.email))
          .unique();
    const resolvedUser = bySignup ?? byEmail;
    if (resolvedUser) {
      return {
        email: resolvedUser.email ?? signup.email,
        name: resolvedUser.name ?? signup.fullName,
        signupId: signup._id,
        userId: resolvedUser._id,
      };
    }
  }
  const email = user?.email ?? signup?.email;
  const name = user?.name ?? signup?.fullName;
  if (!email || !name) {
    return null;
  }
  return {
    email,
    name,
    signupId: signup?._id,
    userId: user?._id,
  };
}

async function upsertIn(
  ctx: MutationCtx,
  person: {
    email: string;
    name: string;
    signupId?: Id<"signups">;
    userId?: Id<"users">;
  },
  addedBy: Id<"users">
): Promise<"added" | "restored" | "skipped"> {
  const existing = await existingFinalist(ctx, person.userId, person.signupId);
  if (existing?.status === "in") {
    return "skipped";
  }
  if (existing) {
    await ctx.db.patch(existing._id, {
      cancelToken: newCancelToken(),
      canceledAt: undefined,
      canceledBy: undefined,
      emailedAt: undefined,
      signupId: person.signupId ?? existing.signupId,
      status: "in",
      userId: person.userId ?? existing.userId,
    });
    return "restored";
  }
  await ctx.db.insert("finalists", {
    addedAt: Date.now(),
    addedBy,
    cancelToken: newCancelToken(),
    signupId: person.signupId,
    status: "in",
    userId: person.userId,
  });
  return "added";
}

async function hydrateFinalist(ctx: QueryCtx | MutationCtx, row: Doc<"finalists">) {
  const person = await resolvePerson(ctx, {
    signupId: row.signupId,
    userId: row.userId,
  });
  let teamName: string | undefined;
  if (row.userId) {
    const membership = await membershipForUser(ctx, row.userId);
    if (membership) {
      const team = await ctx.db.get(membership.teamId);
      teamName = team?.name;
    }
  }
  return {
    _id: row._id,
    addedAt: row.addedAt,
    canceledAt: row.canceledAt,
    email: person?.email ?? "",
    emailedAt: row.emailedAt,
    name: person?.name ?? "Sin nombre",
    signupId: row.signupId,
    status: row.status,
    teamName,
    userId: row.userId,
  };
}

const finalistRowValidator = v.object({
  _id: v.id("finalists"),
  addedAt: v.number(),
  canceledAt: v.optional(v.number()),
  email: v.string(),
  emailedAt: v.optional(v.number()),
  name: v.string(),
  signupId: v.optional(v.id("signups")),
  status: finalistStatusValidator,
  teamName: v.optional(v.string()),
  userId: v.optional(v.id("users")),
});

export const counts = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("finalists").collect();
    let inside = 0;
    let canceled = 0;
    let pendingEmail = 0;
    for (const row of rows) {
      if (row.status === "canceled") {
        canceled += 1;
      } else {
        inside += 1;
        if (row.emailedAt === undefined) {
          pendingEmail += 1;
        }
      }
    }
    return { canceled, inside, pendingEmail, total: rows.length };
  },
  returns: v.object({
    canceled: v.number(),
    inside: v.number(),
    pendingEmail: v.number(),
    total: v.number(),
  }),
});

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("finalists").collect();
    const items = [];
    for (const row of rows) {
      items.push(await hydrateFinalist(ctx, row));
    }
    return items.toSorted((a, b) => {
      if (a.status !== b.status) {
        return a.status === "in" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "es");
    });
  },
  returns: v.array(finalistRowValidator),
});

export const searchPeople = adminQuery({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const needle = args.search.trim().toLowerCase();
    if (needle.length < 2) {
      return [];
    }
    const [signups, users, finalists] = await Promise.all([
      ctx.db.query("signups").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("finalists").collect(),
    ]);
    const inUserIds = new Set(
      finalists
        .filter((row) => row.status === "in" && row.userId)
        .map((row) => row.userId as Id<"users">)
    );
    const inSignupIds = new Set(
      finalists
        .filter((row) => row.status === "in" && row.signupId)
        .map((row) => row.signupId as Id<"signups">)
    );

    const seen = new Set<string>();
    const matches: {
      email: string;
      name: string;
      signupId?: Id<"signups">;
      teamName?: string;
      userId?: Id<"users">;
    }[] = [];

    const usersBySignup = new Map(
      users
        .filter((user) => user.signupId !== undefined)
        .map((user) => [user.signupId as Id<"signups">, user])
    );
    const usersByEmail = new Map(
      users
        .filter((user) => user.email)
        .map((user) => [user.email as string, user])
    );

    const consider = async (input: {
      email: string;
      name: string;
      signupId?: Id<"signups">;
      userId?: Id<"users">;
    }) => {
      const key = input.userId ?? input.signupId ?? input.email;
      if (seen.has(key)) {
        return;
      }
      if (input.userId && inUserIds.has(input.userId)) {
        return;
      }
      if (input.signupId && inSignupIds.has(input.signupId)) {
        return;
      }
      const haystack = `${input.name} ${input.email}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return;
      }
      seen.add(key);
      let teamName: string | undefined;
      if (input.userId) {
        const membership = await membershipForUser(ctx, input.userId);
        if (membership) {
          const team = await ctx.db.get(membership.teamId);
          teamName = team?.name;
        }
      }
      matches.push({ ...input, teamName });
    };

    for (const signup of signups) {
      const user =
        usersBySignup.get(signup._id) ?? usersByEmail.get(signup.email);
      await consider({
        email: signup.email,
        name: user?.name ?? signup.fullName,
        signupId: signup._id,
        userId: user?._id,
      });
      if (matches.length >= SEARCH_LIMIT) {
        break;
      }
    }
    if (matches.length < SEARCH_LIMIT) {
      for (const user of users) {
        if (!user.email) {
          continue;
        }
        await consider({
          email: user.email,
          name: user.name ?? user.email,
          signupId: user.signupId,
          userId: user._id,
        });
        if (matches.length >= SEARCH_LIMIT) {
          break;
        }
      }
    }
    return matches.slice(0, SEARCH_LIMIT);
  },
  returns: v.array(
    v.object({
      email: v.string(),
      name: v.string(),
      signupId: v.optional(v.id("signups")),
      teamName: v.optional(v.string()),
      userId: v.optional(v.id("users")),
    })
  ),
});

export const listTeams = adminQuery({
  args: {},
  handler: async (ctx) => {
    const [teams, members, finalists] = await Promise.all([
      ctx.db.query("teams").collect(),
      ctx.db.query("teamMembers").collect(),
      ctx.db.query("finalists").collect(),
    ]);
    const inUserIds = new Set(
      finalists
        .filter((row) => row.status === "in" && row.userId)
        .map((row) => row.userId as Id<"users">)
    );
    const inSignupIds = new Set(
      finalists
        .filter((row) => row.status === "in" && row.signupId)
        .map((row) => row.signupId as Id<"signups">)
    );
    const membersByTeam = new Map<Id<"teams">, Doc<"teamMembers">[]>();
    for (const member of members) {
      const teamMembers = membersByTeam.get(member.teamId) ?? [];
      teamMembers.push(member);
      membersByTeam.set(member.teamId, teamMembers);
    }
    const result = [];
    for (const team of teams) {
      const teamMembers = membersByTeam.get(team._id) ?? [];
      let alreadyIn = 0;
      let addable = 0;
      for (const member of teamMembers) {
        if (member.status !== "member") {
          continue;
        }
        const hasIdentity = member.userId !== undefined || member.signupId !== undefined;
        if (!hasIdentity) {
          continue;
        }
        const isIn =
          (member.userId !== undefined && inUserIds.has(member.userId)) ||
          (member.signupId !== undefined && inSignupIds.has(member.signupId));
        if (isIn) {
          alreadyIn += 1;
        } else {
          addable += 1;
        }
      }
      result.push({
        _id: team._id,
        addable,
        alreadyIn,
        memberCount: teamMembers.filter((member) => member.status === "member")
          .length,
        name: team.name,
      });
    }
    return result.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      addable: v.number(),
      alreadyIn: v.number(),
      memberCount: v.number(),
      name: v.string(),
    })
  ),
});

export const addPeople = adminMutation({
  args: { people: v.array(personRefValidator) },
  handler: async (ctx, args) => {
    if (args.people.length === 0) {
      throw new Error("Selecciona a alguien");
    }
    let added = 0;
    let restored = 0;
    let skipped = 0;
    for (const ref of args.people) {
      if (!ref.userId && !ref.signupId) {
        skipped += 1;
        continue;
      }
      const person = await resolvePerson(ctx, ref);
      if (!person) {
        skipped += 1;
        continue;
      }
      const result = await upsertIn(ctx, person, ctx.user._id);
      if (result === "added") {
        added += 1;
      } else if (result === "restored") {
        restored += 1;
      } else {
        skipped += 1;
      }
    }
    if (added === 0 && restored === 0) {
      throw new Error("Nadie nuevo para añadir");
    }
    return { added, restored, skipped };
  },
  returns: v.object({
    added: v.number(),
    restored: v.number(),
    skipped: v.number(),
  }),
});

export const addTeam = adminMutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    let added = 0;
    let restored = 0;
    let skipped = 0;
    for (const member of members) {
      if (member.status !== "member") {
        skipped += 1;
        continue;
      }
      const person = await resolvePerson(ctx, {
        signupId: member.signupId,
        userId: member.userId,
      });
      if (!person) {
        skipped += 1;
        continue;
      }
      const result = await upsertIn(ctx, person, ctx.user._id);
      if (result === "added") {
        added += 1;
      } else if (result === "restored") {
        restored += 1;
      } else {
        skipped += 1;
      }
    }
    if (added === 0 && restored === 0) {
      throw new Error("Nadie nuevo en ese equipo");
    }
    return { added, restored, skipped };
  },
  returns: v.object({
    added: v.number(),
    restored: v.number(),
    skipped: v.number(),
  }),
});

export const setStatus = adminMutation({
  args: {
    id: v.id("finalists"),
    status: finalistStatusValidator,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new Error("No está en la final");
    }
    if (args.status === "canceled") {
      if (row.status === "canceled") {
        return null;
      }
      await ctx.db.patch(row._id, {
        canceledAt: Date.now(),
        canceledBy: "admin",
        status: "canceled",
      });
      return null;
    }
    await ctx.db.patch(row._id, {
      cancelToken: newCancelToken(),
      canceledAt: undefined,
      canceledBy: undefined,
      emailedAt: undefined,
      status: "in",
    });
    return null;
  },
  returns: v.null(),
});

export const sendEmails = adminMutation({
  args: { ids: v.array(v.id("finalists")) },
  handler: async (ctx, args) => {
    if (args.ids.length === 0) {
      throw new Error("Selecciona a quién enviar");
    }
    const items: {
      cancelUrl: string;
      email: string;
      finalistId: Id<"finalists">;
      firstName: string;
    }[] = [];
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row || row.status !== "in") {
        continue;
      }
      const person = await resolvePerson(ctx, {
        signupId: row.signupId,
        userId: row.userId,
      });
      if (!person?.email) {
        continue;
      }
      items.push({
        cancelUrl: cancelUrlFor(row.cancelToken),
        email: person.email,
        finalistId: row._id,
        firstName: firstNameFrom(person.name),
      });
    }
    if (items.length === 0) {
      throw new Error("Nadie seleccionado con email y plaza activa");
    }
    await ctx.scheduler.runAfter(0, internal.finalists.deliver, { items });
    return items.length;
  },
  returns: v.number(),
});

export const deliver = internalAction({
  args: {
    items: v.array(
      v.object({
        cancelUrl: v.string(),
        email: v.string(),
        finalistId: v.id("finalists"),
        firstName: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new Error(
        "AUTH_RESEND_KEY is not set on the Convex deployment; cannot send email"
      );
    }
    const resend = new ResendAPI(apiKey);
    const from = process.env.AUTH_EMAIL ?? "HackSpain <onboarding@resend.dev>";
    const sent: Id<"finalists">[] = [];
    const failures: { email: string; error: string }[] = [];

    for (let i = 0; i < args.items.length; i += RESEND_BATCH_LIMIT) {
      const chunk = args.items.slice(i, i + RESEND_BATCH_LIMIT);
      try {
        const { error } = await resend.batch.send(
          chunk.map((item) => {
            const content = {
              cancelUrl: item.cancelUrl,
              firstName: item.firstName,
              logoUrl: FINAL_EMAIL_LOGO_URL,
            };
            return {
              from,
              html: finalEmailHtml(content),
              subject: FINAL_EMAIL_SUBJECT,
              text: finalEmailText(content),
              to: [item.email],
            };
          })
        );
        if (error) {
          for (const item of chunk) {
            failures.push({ email: item.email, error: error.message });
          }
        } else {
          for (const item of chunk) {
            sent.push(item.finalistId);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        for (const item of chunk) {
          failures.push({ email: item.email, error: message });
        }
      }
    }

    await ctx.runMutation(internal.finalists.markEmailed, { ids: sent });
    if (failures.length > 0) {
      console.error("finalists.deliver failures", failures);
    }
    return null;
  },
  returns: v.null(),
});

export const markEmailed = internalMutation({
  args: { ids: v.array(v.id("finalists")) },
  handler: async (ctx, args) => {
    const emailedAt = Date.now();
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row || row.status !== "in") {
        continue;
      }
      await ctx.db.patch(id, { emailedAt });
    }
    return null;
  },
  returns: v.null(),
});

const publicLookupValidator = v.union(
  v.object({
    firstName: v.string(),
    status: finalistStatusValidator,
  }),
  v.null()
);

export const lookup = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token) {
      return null;
    }
    const row = await ctx.db
      .query("finalists")
      .withIndex("by_token", (q) => q.eq("cancelToken", token))
      .unique();
    if (!row) {
      return null;
    }
    const person = await resolvePerson(ctx, {
      signupId: row.signupId,
      userId: row.userId,
    });
    return {
      firstName: firstNameFrom(person?.name ?? ""),
      status: row.status,
    };
  },
  returns: publicLookupValidator,
});

export const cancel = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token) {
      return "invalid" as const;
    }
    const row = await ctx.db
      .query("finalists")
      .withIndex("by_token", (q) => q.eq("cancelToken", token))
      .unique();
    if (!row) {
      return "invalid" as const;
    }
    if (row.status === "canceled") {
      return "already" as const;
    }
    await ctx.db.patch(row._id, {
      canceledAt: Date.now(),
      canceledBy: "self",
      status: "canceled",
    });
    return "canceled" as const;
  },
  returns: v.union(
    v.literal("canceled"),
    v.literal("already"),
    v.literal("invalid")
  ),
});
