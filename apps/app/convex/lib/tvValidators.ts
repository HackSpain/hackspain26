import { v } from "convex/values";

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
  v.literal("sponsorTicker")
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
  v.literal("fast")
);

export const tvFeedModeValidator = v.union(
  v.literal("latest"),
  v.literal("rotate")
);

export const tvFeedSourceValidator = v.union(
  v.literal("all"),
  v.literal("participants"),
  v.literal("github")
);

export const tvFontWeightValidator = v.union(
  v.literal("normal"),
  v.literal("medium"),
  v.literal("semibold"),
  v.literal("bold")
);

export const tvWidgetFields = {
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
  fontSize: v.optional(v.number()),
  fontWeight: v.optional(tvFontWeightValidator),
  background: v.optional(v.boolean()),
};

export const tvWidgetValidator = v.object(tvWidgetFields);
