import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getSignupForUser } from "./lib/auth";
import { adminMutation, adminQuery } from "./lib/customFunctions";

export const tvZoneValidator = v.union(
  v.literal("banner"),
  v.literal("left"),
  v.literal("right"),
  v.literal("ticker"),
);

const messageReturn = v.object({
  _id: v.id("tvMessages"),
  text: v.string(),
  zone: tvZoneValidator,
  order: v.number(),
});

function byZoneOrder(a: Doc<"tvMessages">, b: Doc<"tvMessages">) {
  return a.zone === b.zone ? a.order - b.order : a.zone.localeCompare(b.zone);
}

/**
 * Public feed for the /tv screen. No auth: it only returns admin-authored
 * display copy, never participant data.
 */
export const list = query({
  args: {},
  returns: v.array(messageReturn),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tvMessages").collect();
    return rows
      .filter((row) => row.active)
      .sort(byZoneOrder)
      .map((row) => ({
        _id: row._id,
        text: row.text,
        zone: row.zone,
        order: row.order,
      }));
  },
});

export const adminList = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("tvMessages"),
      text: v.string(),
      zone: tvZoneValidator,
      order: v.number(),
      active: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tvMessages").collect();
    return rows.sort(byZoneOrder).map((row) => ({
      _id: row._id,
      text: row.text,
      zone: row.zone,
      order: row.order,
      active: row.active,
      createdAt: row.createdAt,
    }));
  },
});

export const adminCreate = adminMutation({
  args: { text: v.string(), zone: tvZoneValidator },
  returns: v.id("tvMessages"),
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) throw new Error("El mensaje no puede estar vacío");
    const last = await ctx.db
      .query("tvMessages")
      .withIndex("by_zone", (q) => q.eq("zone", args.zone))
      .order("desc")
      .first();
    const now = Date.now();
    return await ctx.db.insert("tvMessages", {
      text,
      zone: args.zone,
      order: (last?.order ?? -1) + 1,
      active: true,
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminUpdate = adminMutation({
  args: {
    messageId: v.id("tvMessages"),
    text: v.optional(v.string()),
    zone: v.optional(tvZoneValidator),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Mensaje no encontrado");
    const patch: {
      text?: string;
      zone?: Doc<"tvMessages">["zone"];
      order?: number;
      active?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.text !== undefined) {
      const text = args.text.trim();
      if (!text) throw new Error("El mensaje no puede estar vacío");
      patch.text = text;
    }
    if (args.zone !== undefined && args.zone !== message.zone) {
      const last = await ctx.db
        .query("tvMessages")
        .withIndex("by_zone", (q) => q.eq("zone", args.zone!))
        .order("desc")
        .first();
      patch.zone = args.zone;
      patch.order = (last?.order ?? -1) + 1;
    }
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(message._id, patch);
    return null;
  },
});

export const adminRemove = adminMutation({
  args: { messageId: v.id("tvMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Mensaje no encontrado");
    await ctx.db.delete(message._id);
    return null;
  },
});

export const adminMove = adminMutation({
  args: {
    messageId: v.id("tvMessages"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Mensaje no encontrado");
    const siblings = await ctx.db
      .query("tvMessages")
      .withIndex("by_zone", (q) => q.eq("zone", message.zone))
      .collect();
    siblings.sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((row) => row._id === message._id);
    const swapWith =
      args.direction === "up" ? siblings[index - 1] : siblings[index + 1];
    if (!swapWith) return null;
    const now = Date.now();
    await ctx.db.patch(message._id, { order: swapWith.order, updatedAt: now });
    await ctx.db.patch(swapWith._id, { order: message.order, updatedAt: now });
    return null;
  },
});

export const tvWidgetKindValidator = v.union(
  v.literal("banner"),
  v.literal("ticker"),
  v.literal("clock"),
  v.literal("message"),
  v.literal("insightsStats"),
  v.literal("insightsActivity"),
  v.literal("insightsHarness"),
  v.literal("insightsStacks"),
  v.literal("insightsScatter"),
  v.literal("insightsLeaderboard"),
  v.literal("insightsEvolution"),
  v.literal("liveCommits"),
  v.literal("liveAgents"),
  v.literal("liveTokens"),
  v.literal("liveLeaderboard"),
  v.literal("feed"),
  v.literal("sponsorGrid"),
  v.literal("sponsorTicker"),
);

export const tvSponsorValidator = v.object({
  name: v.string(),
  logoUrl: v.string(),
  href: v.string(),
  tier: v.union(v.literal("gold"), v.literal("silver"), v.literal("community")),
});

export const tvTickerSpeedValidator = v.union(
  v.literal("slow"),
  v.literal("normal"),
  v.literal("fast"),
);

export const tvFeedModeValidator = v.union(
  v.literal("latest"),
  v.literal("rotate"),
);

export const tvFeedSourceValidator = v.union(
  v.literal("all"),
  v.literal("participants"),
  v.literal("github"),
);

const widgetReturn = v.object({
  _id: v.string(),
  kind: tvWidgetKindValidator,
  x: v.number(),
  y: v.number(),
  w: v.number(),
  h: v.number(),
  z: v.number(),
  text: v.string(),
  sponsors: v.optional(v.array(tvSponsorValidator)),
  tickerSpeed: v.optional(tvTickerSpeedValidator),
  feedMode: v.optional(tvFeedModeValidator),
  feedSource: v.optional(tvFeedSourceValidator),
});

type WidgetKind = Doc<"tvWidgets">["kind"];

const MIN_SIZE = 8;

const TEXT_KINDS = new Set<WidgetKind>(["banner", "ticker", "message"]);

const DEFAULT_SPONSORS = [
  {
    name: "HackSpain",
    logoUrl: "",
    href: "https://hackspain.com",
    tier: "gold" as const,
  },
  {
    name: "Convex",
    logoUrl: "",
    href: "https://convex.dev",
    tier: "gold" as const,
  },
  {
    name: "Vercel",
    logoUrl: "",
    href: "https://vercel.com",
    tier: "silver" as const,
  },
];

const KIND_DEFAULTS: Record<
  WidgetKind,
  { x: number; y: number; w: number; h: number; text: string }
> = {
  banner: { x: 4, y: 6, w: 70, h: 16, text: "HackSpain 2026" },
  ticker: {
    x: 0,
    y: 86,
    w: 100,
    h: 14,
    text: "HackSpain 2026 · Madrid · 42 equipos hackeando",
  },
  clock: { x: 78, y: 6, w: 18, h: 16, text: "" },
  message: {
    x: 8,
    y: 28,
    w: 36,
    h: 24,
    text: "Escribe un aviso para el venue.",
  },
  insightsStats: { x: 4, y: 24, w: 92, h: 28, text: "" },
  insightsActivity: { x: 4, y: 22, w: 60, h: 56, text: "" },
  insightsHarness: { x: 66, y: 22, w: 30, h: 56, text: "" },
  insightsStacks: { x: 8, y: 22, w: 40, h: 56, text: "" },
  insightsScatter: { x: 8, y: 20, w: 56, h: 58, text: "" },
  insightsLeaderboard: { x: 6, y: 10, w: 88, h: 80, text: "" },
  insightsEvolution: { x: 6, y: 10, w: 88, h: 80, text: "" },
  liveCommits: { x: 6, y: 16, w: 40, h: 72, text: "" },
  liveAgents: { x: 50, y: 16, w: 44, h: 28, text: "" },
  liveTokens: { x: 50, y: 48, w: 44, h: 28, text: "" },
  liveLeaderboard: { x: 8, y: 16, w: 50, h: 68, text: "" },
  feed: { x: 52, y: 16, w: 42, h: 72, text: "" },
  sponsorGrid: { x: 8, y: 28, w: 84, h: 40, text: "" },
  sponsorTicker: { x: 0, y: 86, w: 100, h: 14, text: "" },
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function layoutBox(input: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  const w = clamp(input.w, MIN_SIZE, 100);
  const h = clamp(input.h, MIN_SIZE, 100);
  return {
    x: clamp(input.x, 0, 100 - w),
    y: clamp(input.y, 0, 100 - h),
    w,
    h,
  };
}

function toPublicWidget(row: Doc<"tvWidgets">) {
  return {
    _id: row._id,
    kind: row.kind,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    z: row.z,
    text: row.text,
    sponsors: row.sponsors,
    tickerSpeed: row.tickerSpeed,
    feedMode: row.feedMode,
    feedSource: row.feedSource,
  };
}

function snapshotOf(row: Doc<"tvWidgets">) {
  return {
    kind: row.kind,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    z: row.z,
    text: row.text,
    sponsors: row.sponsors,
    tickerSpeed: row.tickerSpeed,
    feedMode: row.feedMode,
    feedSource: row.feedSource,
  };
}

function byZ(a: Doc<"tvWidgets">, b: Doc<"tvWidgets">) {
  return a.z - b.z || a._creationTime - b._creationTime;
}

function defaultText(kind: WidgetKind, text?: string) {
  if (!TEXT_KINDS.has(kind)) return "";
  const trimmed = text?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : KIND_DEFAULTS[kind].text;
}

function zoneLayout(
  zone: Doc<"tvMessages">["zone"],
  index: number,
): { x: number; y: number; w: number; h: number } {
  if (zone === "banner") return { x: 4, y: 4 + index * 16, w: 72, h: 14 };
  if (zone === "ticker") return { x: 0, y: 86, w: 100, h: 14 };
  if (zone === "left") return { x: 4, y: 22 + index * 20, w: 44, h: 18 };
  return { x: 52, y: 22 + index * 20, w: 44, h: 18 };
}

function zoneKind(zone: Doc<"tvMessages">["zone"]): WidgetKind {
  if (zone === "banner") return "banner";
  if (zone === "ticker") return "ticker";
  return "message";
}

/**
 * Public composition for /tv. Uses the live saved state when one is set;
 * otherwise the working canvas.
 */
export const listWidgets = query({
  args: {},
  returns: v.array(widgetReturn),
  handler: async (ctx) => {
    const live = await ctx.db
      .query("tvLayouts")
      .withIndex("by_live", (q) => q.eq("isLive", true))
      .first();
    if (live) {
      return live.widgets.map((widget, index) => ({
        _id: `${live._id}:${index}`,
        ...widget,
      }));
    }
    const rows = await ctx.db.query("tvWidgets").withIndex("by_z").collect();
    return rows.sort(byZ).map(toPublicWidget);
  },
});

export const liveState = query({
  args: {},
  returns: v.union(
    v.object({ _id: v.id("tvLayouts"), name: v.string() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const live = await ctx.db
      .query("tvLayouts")
      .withIndex("by_live", (q) => q.eq("isLive", true))
      .first();
    return live ? { _id: live._id, name: live.name } : null;
  },
});

const tvFeedPostReturn = v.object({
  _id: v.string(),
  kind: v.union(v.literal("post"), v.literal("github")),
  authorName: v.string(),
  teamName: v.string(),
  text: v.string(),
  hasImage: v.boolean(),
  createdAt: v.number(),
});

async function toTvFeedPost(ctx: QueryCtx, post: Doc<"posts">) {
  const author = post.authorId ? await ctx.db.get(post.authorId) : null;
  const signup = author ? await getSignupForUser(ctx, author) : null;
  const team = post.teamId ? await ctx.db.get(post.teamId) : null;
  const authorName =
    post.kind === "github"
      ? (post.github?.actor || team?.name || "GitHub")
      : (author?.name || signup?.fullName || "Alguien");
  return {
    _id: post._id,
    kind: post.kind,
    authorName,
    teamName: team?.name ?? "",
    text: post.text,
    hasImage: Boolean(post.imageId),
    createdAt: post.createdAt,
  };
}

/**
 * Public venue feed. Display names and copy only — no emails, no storage URLs.
 */
export const listFeed = query({
  args: {
    source: v.optional(tvFeedSourceValidator),
  },
  returns: v.array(tvFeedPostReturn),
  handler: async (ctx, args) => {
    const source = args.source ?? "participants";
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .take(40);
    const filtered = rows.filter((row) => {
      if (source === "participants") return row.kind === "post";
      if (source === "github") return row.kind === "github";
      return true;
    });
    const out = [];
    for (const row of filtered.slice(0, 16)) {
      out.push(await toTvFeedPost(ctx, row));
    }
    return out;
  },
});

export const listGithubActivity = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      repo: v.string(),
      actor: v.string(),
      text: v.string(),
      sha: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .take(40);
    return rows
      .filter((row) => row.kind === "github")
      .slice(0, 16)
      .map((row) => ({
        _id: row._id,
        repo: row.github?.repo ?? "",
        actor: row.github?.actor ?? "",
        text: row.text,
        sha: (row.externalId ?? row._id).slice(-7),
      }));
  },
});

export const adminListWidgets = adminQuery({
  args: {},
  returns: v.array(widgetReturn),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tvWidgets").withIndex("by_z").collect();
    return rows.sort(byZ).map(toPublicWidget);
  },
});

export const adminCreateWidget = adminMutation({
  args: {
    kind: tvWidgetKindValidator,
    text: v.optional(v.string()),
  },
  returns: v.id("tvWidgets"),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("tvWidgets").collect();
    const nudge = (existing.length % 6) * 2;
    const preset = KIND_DEFAULTS[args.kind];
    const box = layoutBox({
      x: preset.x + nudge,
      y: preset.y + nudge,
      w: preset.w,
      h: preset.h,
    });
    const z = existing.reduce((max, row) => Math.max(max, row.z), 0) + 1;
    const now = Date.now();
    const isSponsor =
      args.kind === "sponsorGrid" || args.kind === "sponsorTicker";
    return await ctx.db.insert("tvWidgets", {
      kind: args.kind,
      ...box,
      z,
      text: defaultText(args.kind, args.text),
      sponsors: isSponsor ? DEFAULT_SPONSORS : undefined,
      tickerSpeed: args.kind === "sponsorTicker" ? "normal" : undefined,
      feedMode: args.kind === "feed" ? "latest" : undefined,
      feedSource: args.kind === "feed" ? "participants" : undefined,
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminUpdateWidget = adminMutation({
  args: {
    widgetId: v.id("tvWidgets"),
    text: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    w: v.optional(v.number()),
    h: v.optional(v.number()),
    z: v.optional(v.number()),
    sponsors: v.optional(v.array(tvSponsorValidator)),
    tickerSpeed: v.optional(tvTickerSpeedValidator),
    feedMode: v.optional(tvFeedModeValidator),
    feedSource: v.optional(tvFeedSourceValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const widget = await ctx.db.get(args.widgetId);
    if (!widget) throw new Error("Caja no encontrada");
    const box = layoutBox({
      x: args.x ?? widget.x,
      y: args.y ?? widget.y,
      w: args.w ?? widget.w,
      h: args.h ?? widget.h,
    });
    let text = widget.text;
    if (args.text !== undefined) {
      if (!TEXT_KINDS.has(widget.kind)) {
        text = widget.text;
      } else {
        const trimmed = args.text.trim();
        if (!trimmed) throw new Error("El texto no puede estar vacío");
        text = trimmed;
      }
    }
    await ctx.db.patch(widget._id, {
      ...box,
      text,
      z: args.z === undefined ? widget.z : clamp(args.z, 0, 10_000),
      sponsors: args.sponsors ?? widget.sponsors,
      tickerSpeed: args.tickerSpeed ?? widget.tickerSpeed,
      feedMode: args.feedMode ?? widget.feedMode,
      feedSource: args.feedSource ?? widget.feedSource,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const adminRemoveWidget = adminMutation({
  args: { widgetId: v.id("tvWidgets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const widget = await ctx.db.get(args.widgetId);
    if (!widget) throw new Error("Caja no encontrada");
    await ctx.db.delete(widget._id);
    return null;
  },
});

export const adminEnsureLayout = adminMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("tvWidgets").collect();
    if (existing.length > 0) return existing.length;

    const messages = await ctx.db.query("tvMessages").collect();
    const active = messages.filter((row) => row.active).sort(byZoneOrder);
    const now = Date.now();
    let created = 0;

    if (active.length > 0) {
      const counts: Record<Doc<"tvMessages">["zone"], number> = {
        banner: 0,
        left: 0,
        right: 0,
        ticker: 0,
      };
      for (const message of active) {
        const index = counts[message.zone];
        counts[message.zone] += 1;
        const box = layoutBox(zoneLayout(message.zone, index));
        await ctx.db.insert("tvWidgets", {
          kind: zoneKind(message.zone),
          ...box,
          z: created + 1,
          text: message.text,
          createdBy: ctx.user._id,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
      await ctx.db.insert("tvWidgets", {
        kind: "clock",
        ...layoutBox(KIND_DEFAULTS.clock),
        z: created + 1,
        text: "",
        createdBy: ctx.user._id,
        createdAt: now,
        updatedAt: now,
      });
      return created + 1;
    }

    const seed: Array<{
      kind: WidgetKind;
      x: number;
      y: number;
      w: number;
      h: number;
      z: number;
      text: string;
    }> = [
      {
        kind: "clock",
        x: 80,
        y: 4,
        w: 16,
        h: 14,
        z: 3,
        text: "",
      },
      {
        kind: "banner",
        x: 4,
        y: 4,
        w: 72,
        h: 14,
        z: 2,
        text: "HackSpain 2026",
      },
      {
        kind: "insightsStats",
        x: 4,
        y: 22,
        w: 92,
        h: 24,
        z: 1,
        text: "",
      },
      {
        kind: "insightsActivity",
        x: 4,
        y: 50,
        w: 30,
        h: 46,
        z: 1,
        text: "",
      },
      {
        kind: "feed",
        x: 36,
        y: 50,
        w: 28,
        h: 46,
        z: 1,
        text: "",
      },
      {
        kind: "insightsHarness",
        x: 66,
        y: 50,
        w: 30,
        h: 46,
        z: 1,
        text: "",
      },
    ];
    for (const widget of seed) {
      const box = layoutBox(widget);
      await ctx.db.insert("tvWidgets", {
        kind: widget.kind,
        ...box,
        z: widget.z,
        text: widget.text,
        feedMode: widget.kind === "feed" ? "latest" : undefined,
        feedSource: widget.kind === "feed" ? "participants" : undefined,
        createdBy: ctx.user._id,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }
    return created;
  },
});

export const adminListLayouts = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("tvLayouts"),
      name: v.string(),
      isLive: v.boolean(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tvLayouts").collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        _id: row._id,
        name: row.name,
        isLive: row.isLive,
        updatedAt: row.updatedAt,
      }));
  },
});

export const adminSaveLayout = adminMutation({
  args: { name: v.string(), layoutId: v.optional(v.id("tvLayouts")) },
  returns: v.id("tvLayouts"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Ponle un nombre al estado");
    const rows = await ctx.db.query("tvWidgets").withIndex("by_z").collect();
    const widgets = rows.sort(byZ).map(snapshotOf);
    const now = Date.now();
    if (args.layoutId) {
      const existing = await ctx.db.get(args.layoutId);
      if (!existing) throw new Error("Estado no encontrado");
      await ctx.db.patch(existing._id, { name, widgets, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("tvLayouts", {
      name,
      isLive: false,
      widgets,
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminLoadLayout = adminMutation({
  args: { layoutId: v.id("tvLayouts") },
  returns: v.array(widgetReturn),
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.layoutId);
    if (!layout) throw new Error("Estado no encontrado");
    const current = await ctx.db.query("tvWidgets").collect();
    for (const row of current) {
      await ctx.db.delete(row._id);
    }
    const now = Date.now();
    const created: Array<ReturnType<typeof toPublicWidget>> = [];
    for (const widget of layout.widgets) {
      const box = layoutBox(widget);
      const id = await ctx.db.insert("tvWidgets", {
        kind: widget.kind,
        ...box,
        z: widget.z,
        text: widget.text,
        sponsors: widget.sponsors,
        tickerSpeed: widget.tickerSpeed,
        feedMode: widget.feedMode,
        feedSource: widget.feedSource,
        createdBy: ctx.user._id,
        createdAt: now,
        updatedAt: now,
      });
      created.push({
        _id: id,
        kind: widget.kind,
        ...box,
        z: widget.z,
        text: widget.text,
        sponsors: widget.sponsors,
        tickerSpeed: widget.tickerSpeed,
        feedMode: widget.feedMode,
        feedSource: widget.feedSource,
      });
    }
    return created.sort(
      (a, b) => a.z - b.z || a._id.localeCompare(b._id),
    );
  },
});

export const adminSetLive = adminMutation({
  args: { layoutId: v.id("tvLayouts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.layoutId);
    if (!layout) throw new Error("Estado no encontrado");
    const live = await ctx.db
      .query("tvLayouts")
      .withIndex("by_live", (q) => q.eq("isLive", true))
      .collect();
    const now = Date.now();
    for (const row of live) {
      if (row._id !== layout._id) {
        await ctx.db.patch(row._id, { isLive: false, updatedAt: now });
      }
    }
    await ctx.db.patch(layout._id, { isLive: true, updatedAt: now });
    return null;
  },
});

export const adminRemoveLayout = adminMutation({
  args: { layoutId: v.id("tvLayouts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const layout = await ctx.db.get(args.layoutId);
    if (!layout) throw new Error("Estado no encontrado");
    await ctx.db.delete(layout._id);
    return null;
  },
});
