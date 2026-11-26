import type { AnyDataModel, GenericMutationCtx } from "convex/server";
import type { MutationCtx } from "../_generated/server";

/** Tables the schema no longer defines. Empty them before that drop, or leftover rows block the push. */
const UNREAD_TABLES = [
  "eventSettings",
  "judgingScores",
  "judgingAssignments",
  "tvMessages",
  "tvWidgets",
  "tvLayouts",
  "signups",
  "settings",
  "hackspain27_emails",
] as const;

const USER_DROP_FIELDS = [
  "attendanceStatus",
  "dietaryDetails",
  "dietaryRestrictions",
  "onboardingComplete",
  "signupId",
  "termsAcceptedAt",
  "travelOrigin",
  "userTypeId",
] as const;

const SIGNUP_ID_FIELD = ["signupId"] as const;

export async function deleteUnreadTableRows(
  ctx: MutationCtx
): Promise<Record<string, number>> {
  const untyped = ctx.db as GenericMutationCtx<AnyDataModel>["db"];
  const deleted: Record<string, number> = {};
  for (const table of UNREAD_TABLES) {
    try {
      for (const row of await untyped.query(table).collect()) {
        await untyped.delete(row._id);
        deleted[table] = (deleted[table] ?? 0) + 1;
      }
    } catch {
      // Already absent on this deployment.
    }
  }
  return deleted;
}

async function stripFields(
  ctx: MutationCtx,
  table: string,
  fields: readonly string[]
): Promise<number> {
  const untyped = ctx.db as GenericMutationCtx<AnyDataModel>["db"];
  const drop = new Set(fields);
  let stripped = 0;
  try {
    for (const row of await untyped.query(table).collect()) {
      const next: Record<string, unknown> = {};
      let changed = false;
      for (const [key, value] of Object.entries(row)) {
        if (key === "_id" || key === "_creationTime") {
          continue;
        }
        if (drop.has(key)) {
          changed = true;
          continue;
        }
        next[key] = value;
      }
      if (changed) {
        await untyped.replace(row._id, next);
        stripped += 1;
      }
    }
  } catch {
    // Table already absent on this deployment.
  }
  return stripped;
}

export async function prepareEditionNarrow(ctx: MutationCtx): Promise<{
  deleted: Record<string, number>;
  stripped: Record<string, number>;
}> {
  const stripped = {
    eventPasses: await stripFields(ctx, "eventPasses", SIGNUP_ID_FIELD),
    finalists: await stripFields(ctx, "finalists", SIGNUP_ID_FIELD),
    teamMembers: await stripFields(ctx, "teamMembers", SIGNUP_ID_FIELD),
    users: await stripFields(ctx, "users", USER_DROP_FIELDS),
  };
  const deleted = await deleteUnreadTableRows(ctx);
  return { deleted, stripped };
}
