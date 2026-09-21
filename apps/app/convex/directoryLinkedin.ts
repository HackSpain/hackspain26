"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  linkedinProfileIsStale,
  linkedinProfileValidator,
  linkedinUrlFor,
  missingLinkedinProfile,
  normalizeLinkedinSlug,
  nyneHeaders,
  profileFromNyne,
} from "./lib/linkedinProfile";
import type { LinkedinProfile } from "./lib/linkedinProfile";

const NYNE_ENRICH = "https://api.nyne.ai/person/enrichment";
const POLL_MS = 1000;
const POLL_ATTEMPTS = 12;

type NyneEnvelope = {
  data?: {
    completed?: boolean;
    error?: unknown;
    request_id?: string;
    result?: Record<string, unknown> | null;
    status?: string;
  };
  error?: { code?: string; message?: string };
  success?: boolean;
};

async function nyneFetch(
  url: string,
  headers: Record<string, string>,
  init?: RequestInit,
): Promise<NyneEnvelope> {
  const response = await fetch(url, { ...init, headers });
  if (response.status === 429) {
    throw new Error("LinkedIn pide esperar.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Fallo al leer LinkedIn.");
  }
  if (response.status === 402) {
    throw new Error("Fallo al leer LinkedIn.");
  }
  if (!response.ok && response.status !== 202) {
    throw new Error("LinkedIn no responde.");
  }
  return (await response.json()) as NyneEnvelope;
}

async function enrich(slug: string, fetchedAt: number): Promise<LinkedinProfile> {
  const headers = nyneHeaders();
  if (!headers) {
    throw new Error("Falta configurar Nyne.");
  }
  const submitted = await nyneFetch(NYNE_ENRICH, headers, {
    body: JSON.stringify({
      newsfeed: ["linkedin"],
      social_media_url: linkedinUrlFor(slug),
    }),
    method: "POST",
  });
  let envelope = submitted;
  const requestId = submitted.data?.request_id;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const status = envelope.data?.status;
    if (status === "failed") {
      return missingLinkedinProfile(slug, fetchedAt);
    }
    if (
      envelope.data?.completed ||
      status === "completed" ||
      envelope.data?.result
    ) {
      const result = envelope.data?.result;
      if (!result) {
        return missingLinkedinProfile(slug, fetchedAt);
      }
      return profileFromNyne(result, slug, fetchedAt);
    }
    if (!requestId) {
      break;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, POLL_MS);
    });
    const poll = new URL(NYNE_ENRICH);
    poll.searchParams.set("request_id", requestId);
    envelope = await nyneFetch(poll.toString(), headers);
  }
  throw new Error("LinkedIn no responde.");
}

export const refresh = action({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<LinkedinProfile> => {
    await ctx.runQuery(internal.directory.assertViewer, {});
    const slug = normalizeLinkedinSlug(args.slug);
    if (!slug) {
      throw new Error("Esa URL de LinkedIn no vale.");
    }
    const existing: LinkedinProfile | null = await ctx.runQuery(
      internal.directory.linkedinCached,
      { slug },
    );
    const now = Date.now();
    if (existing && !linkedinProfileIsStale(existing, now)) {
      return existing;
    }
    if (!nyneHeaders()) {
      if (existing) {
        return existing;
      }
      throw new Error("Falta configurar Nyne.");
    }
    const profile = await enrich(slug, now);
    await ctx.runMutation(internal.directory.saveLinkedinProfile, profile);
    return profile;
  },
  returns: linkedinProfileValidator,
});
