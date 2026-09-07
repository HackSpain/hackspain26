import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";

/**
 * Pulls public GitHub activity for every team repo into the feed.
 *
 * Runs from convex/crons.ts. Uses conditional requests (ETag), so a repo
 * with nothing new costs no rate limit at all. GITHUB_TOKEN must be set on
 * the deployment: unauthenticated calls share a 60/hour budget per egress
 * IP, and Convex's shared IPs have it exhausted essentially all the time.
 *
 * GitHub's Events API only returns trimmed payloads (no commit list, no
 * pull request title), so pushes are described from the ref and head sha,
 * and pull requests get one extra detail request for their title.
 */
const EVENTS_PER_REPO = 30;
const MAX_TEXT = 200;

const eventInput = v.object({
  externalId: v.string(),
  event: v.string(),
  text: v.string(),
  url: v.string(),
  actor: v.optional(v.string()),
  createdAt: v.number(),
});

export const reposToPoll = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      teamId: v.id("teams"),
      repo: v.string(),
      etag: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();
    const out = [];
    for (const team of teams) {
      const repo = repoSlug(team.repoUrl);
      if (repo) {
        out.push({ teamId: team._id, repo, etag: team.githubEtag });
      }
    }
    return out;
  },
});

/** Which of these externalIds are not in the feed yet, so we only enrich new events. */
export const unseen = internalQuery({
  args: { externalIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const out = [];
    for (const externalId of args.externalIds) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_external", (q) => q.eq("externalId", externalId))
        .first();
      if (!existing) out.push(externalId);
    }
    return out;
  },
});

/**
 * Organiser tool: drop every GitHub post for a repo, e.g. after a team
 * pointed at the wrong repository. `pnpm --filter app exec convex run githubFeed:purgeRepo '{"repo":"org/name"}'`
 */
export const purgeRepo = internalMutation({
  args: { repo: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("kind"), "github"))
      .collect();
    let removed = 0;
    for (const post of posts) {
      if (post.github?.repo === args.repo) {
        await ctx.db.delete(post._id);
        removed++;
      }
    }
    return removed;
  },
});

export const recordEvents = internalMutation({
  args: {
    teamId: v.id("teams"),
    repo: v.string(),
    etag: v.optional(v.string()),
    events: v.array(eventInput),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const event of args.events) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_external", (q) => q.eq("externalId", event.externalId))
        .first();
      if (existing) continue;
      await ctx.db.insert("posts", {
        kind: "github",
        teamId: args.teamId,
        text: event.text,
        github: {
          repo: args.repo,
          event: event.event,
          url: event.url,
          actor: event.actor,
        },
        externalId: event.externalId,
        createdAt: event.createdAt,
      });
      inserted++;
    }
    await ctx.db.patch(args.teamId, {
      githubEtag: args.etag,
      githubPolledAt: Date.now(),
    });
    return inserted;
  },
});

export function repoSlug(repoUrl: string | undefined): string | null {
  if (!repoUrl) return null;
  const match = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repoUrl);
  return match ? `${match[1]}/${match[2]}` : null;
}

type GitHubEvent = {
  id: string;
  type: string;
  actor?: { login?: string };
  created_at: string;
  payload?: {
    ref?: string;
    head?: string;
    action?: string;
    number?: number;
    pull_request?: {
      number?: number;
      url?: string;
      title?: string;
      merged?: boolean;
    };
    release?: { name?: string; tag_name?: string; html_url?: string };
    ref_type?: string;
  };
};

export type Described = {
  event: string;
  text: string;
  url: string;
  /** API URL of the pull request, when a detail fetch can add its title. */
  detailUrl?: string;
};

function firstLine(text: string | undefined): string {
  return (text ?? "").split("\n")[0]?.trim().slice(0, MAX_TEXT) ?? "";
}

/** Map one GitHub event onto a feed line; null for events we do not show. */
export function describeEvent(
  repo: string,
  event: GitHubEvent,
): Described | null {
  const actor = event.actor?.login ?? "someone";
  const p = event.payload ?? {};
  switch (event.type) {
    case "PushEvent": {
      const branch = (p.ref ?? "").replace("refs/heads/", "");
      if (!branch || !p.head) return null;
      return {
        event: "push",
        text: `${actor} pushed to ${branch} (${p.head.slice(0, 7)})`,
        url: `https://github.com/${repo}/commit/${p.head}`,
      };
    }
    case "PullRequestEvent": {
      const pr = p.pull_request ?? {};
      const number = p.number ?? pr.number;
      if (!number) return null;
      const verb =
        p.action === "opened"
          ? "opened"
          : p.action === "closed"
            ? pr.merged
              ? "merged"
              : "closed"
            : null;
      if (!verb) return null;
      const title = firstLine(pr.title);
      return {
        event: "pull_request",
        text: `${actor} ${verb} #${number}${title ? `: ${title}` : ""}`,
        url: `https://github.com/${repo}/pull/${number}`,
        detailUrl: pr.title === undefined ? pr.url : undefined,
      };
    }
    case "ReleaseEvent": {
      if (p.action !== "published") return null;
      const rel = p.release ?? {};
      return {
        event: "release",
        text: `${actor} published release ${rel.name || rel.tag_name || ""}`.trim(),
        url: rel.html_url ?? `https://github.com/${repo}/releases`,
      };
    }
    case "CreateEvent": {
      if (p.ref_type !== "tag") return null;
      return {
        event: "tag",
        text: `${actor} tagged ${p.ref ?? ""}`.trim(),
        url: `https://github.com/${repo}/releases/tag/${p.ref ?? ""}`,
      };
    }
    default:
      return null;
  }
}

function githubHeaders(etag?: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "hackspain-feed",
    "x-github-api-version": "2022-11-28",
    ...(etag ? { "if-none-match": etag } : {}),
    ...authHeader(),
  };
}

/**
 * The events payload omits the pull request title and merge state; one
 * request to the PR itself fills them in. Fails soft: the plain line stays.
 */
export async function enrichPullRequest(
  described: Described,
  actor: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Described> {
  if (!described.detailUrl) return described;
  try {
    const response = await fetchImpl(described.detailUrl, {
      headers: githubHeaders(),
    });
    if (!response.ok) return described;
    const pr = (await response.json()) as {
      title?: string;
      merged?: boolean;
      number?: number;
    };
    const title = firstLine(pr.title);
    const closed = / closed #\d+/.test(described.text);
    const verb = closed ? (pr.merged ? "merged" : "closed") : "opened";
    return {
      ...described,
      text: `${actor} ${verb} #${pr.number ?? ""}${title ? `: ${title}` : ""}`,
    };
  } catch {
    return described;
  }
}

function authHeader(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (token) return { authorization: `Bearer ${token}` };
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (id && secret) {
    return { authorization: `Basic ${btoa(`${id}:${secret}`)}` };
  }
  return {};
}

export const pollRepos = internalAction({
  args: {},
  returns: v.object({ polled: v.number(), inserted: v.number() }),
  handler: async (ctx) => {
    const repos = await ctx.runQuery(internal.githubFeed.reposToPoll, {});
    let polled = 0;
    let inserted = 0;
    for (const { teamId, repo, etag } of repos) {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/events?per_page=${EVENTS_PER_REPO}`,
        { headers: githubHeaders(etag) },
      );
      polled++;
      if (response.status === 304) continue;
      if (response.status === 403 || response.status === 429) {
        const remaining = response.headers.get("x-ratelimit-remaining") ?? "?";
        const reset = response.headers.get("x-ratelimit-reset");
        const resetAt = reset
          ? new Date(Number(reset) * 1000).toISOString()
          : "?";
        console.warn(
          `github feed: ${response.status} while polling ${repo} (remaining ${remaining}, resets ${resetAt}, ${authHeader().authorization ? "authenticated" : "unauthenticated"}); stopping this run`,
        );
        break;
      }
      if (!response.ok) {
        console.warn(`github feed: ${repo} answered ${response.status}`);
        continue;
      }
      const events = (await response.json()) as GitHubEvent[];
      const candidates = [];
      for (const event of events) {
        const described = describeEvent(repo, event);
        if (!described) continue;
        candidates.push({
          externalId: `github:${event.id}`,
          described,
          actor: event.actor?.login,
          createdAt: Date.parse(event.created_at) || Date.now(),
        });
      }
      const fresh = new Set(
        await ctx.runQuery(internal.githubFeed.unseen, {
          externalIds: candidates.map((c) => c.externalId),
        }),
      );
      const mapped = [];
      for (const candidate of candidates) {
        if (!fresh.has(candidate.externalId)) continue;
        const described = await enrichPullRequest(
          candidate.described,
          candidate.actor ?? "someone",
        );
        mapped.push({
          externalId: candidate.externalId,
          event: described.event,
          text: described.text,
          url: described.url,
          actor: candidate.actor,
          createdAt: candidate.createdAt,
        });
      }
      inserted += await ctx.runMutation(internal.githubFeed.recordEvents, {
        teamId,
        repo,
        etag: response.headers.get("etag") ?? undefined,
        events: mapped,
      });
    }
    return { polled, inserted };
  },
});
