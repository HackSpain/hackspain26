import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";

/**
 * The only Convex functions the CLI may call through /api/cli/rpc, keyed by
 * their Convex name. Everything runs server-side with the participant's own
 * session token, so the gate ladder in convex/lib/auth.ts still applies.
 */
export type Exposed =
  | { kind: "query"; ref: FunctionReference<"query"> }
  | { kind: "mutation"; ref: FunctionReference<"mutation"> }
  | { kind: "action"; ref: FunctionReference<"action"> };

const query = (ref: FunctionReference<"query">): Exposed => ({ kind: "query", ref });
const mutation = (ref: FunctionReference<"mutation">): Exposed => ({ kind: "mutation", ref });

export const CLI_FUNCTIONS: Record<string, Exposed> = {
  "users:me": query(api.users.me),
  "users:attachAfterLogin": mutation(api.users.attachAfterLogin),
};
