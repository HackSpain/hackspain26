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
  requireOnboarded,
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
export const onboardedQuery = wrapQuery(requireOnboarded);
export const onboardedMutation = wrapMutation(requireOnboarded);
export const adminQuery = wrapQuery(requireAdmin);
export const adminMutation = wrapMutation(requireAdmin);
