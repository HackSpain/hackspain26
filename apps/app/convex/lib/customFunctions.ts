import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getCurrentUser,
  requireAccepted,
  requireAdmin,
  requireInEvent,
  requireJudge,
  requireOnboarded,
  requireSponsorCatalog,
} from "./auth";

type Resolve = (ctx: QueryCtx | MutationCtx) => Promise<Doc<"users">>;

function wrapQuery(resolve: Resolve) {
  return customQuery(query, {
    args: {},
    input: async (ctx) => ({
      args: {},
      ctx: { ...ctx, user: await resolve(ctx) },
    }),
  });
}

function wrapMutation(resolve: Resolve) {
  return customMutation(mutation, {
    args: {},
    input: async (ctx) => ({
      args: {},
      ctx: { ...ctx, user: await resolve(ctx) },
    }),
  });
}

export const authedQuery = wrapQuery(getCurrentUser);
export const authedMutation = wrapMutation(getCurrentUser);
export const acceptedQuery = wrapQuery(requireAccepted);
export const acceptedMutation = wrapMutation(requireAccepted);
/**
 * Onboarded participants inside the hackathon window (convex/lib/eventWindow.ts).
 * Outside it only explicitly exempt features work; use the anytime wrappers
 * for one that must survive a closed window. Admins are never gated.
 */
export const onboardedQuery = wrapQuery(requireInEvent);
export const onboardedMutation = wrapMutation(requireInEvent);
/** Onboarded, no window check: features that remain available at any time. */
export const anytimeOnboardedQuery = wrapQuery(requireOnboarded);
export const anytimeOnboardedMutation = wrapMutation(requireOnboarded);
/** Onboarded, no window check: profile fields the participant may always edit. */
export const profileMutation = wrapMutation(requireOnboarded);
export const adminQuery = wrapQuery(requireAdmin);
export const adminMutation = wrapMutation(requireAdmin);
/** Jury panel: scoring continues after the hackathon window closes. */
export const judgeQuery = wrapQuery(requireJudge);
export const judgeMutation = wrapMutation(requireJudge);
export const catalogQuery = wrapQuery(requireSponsorCatalog);
