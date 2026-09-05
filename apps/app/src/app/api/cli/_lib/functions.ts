import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";

/**
 * The only Convex functions the CLI may call through /api/cli/rpc, keyed by
 * their Convex name. Everything runs server-side with the participant's own
 * session token, so the gate ladder in convex/lib/auth.ts still applies.
 * Add a line here when a CLI command needs a new function.
 */
export type Exposed =
  | { kind: "query"; ref: FunctionReference<"query"> }
  | { kind: "mutation"; ref: FunctionReference<"mutation"> }
  | { kind: "action"; ref: FunctionReference<"action"> };

const query = (ref: FunctionReference<"query">): Exposed => ({ kind: "query", ref });
const mutation = (ref: FunctionReference<"mutation">): Exposed => ({ kind: "mutation", ref });

export const CLI_FUNCTIONS: Record<string, Exposed> = {
  // auth / profile
  "users:me": query(api.users.me),
  "users:attachAfterLogin": mutation(api.users.attachAfterLogin),

  // teams
  "teams:mine": query(api.teams.mine),
  "teams:list": query(api.teams.list),
  "teams:create": mutation(api.teams.create),
  "teams:join": mutation(api.teams.join),
  "teams:leave": mutation(api.teams.leave),
  "teams:regenerateCode": mutation(api.teams.regenerateCode),
  "teams:setRepoUrl": mutation(api.teams.setRepoUrl),
  "teams:setTechStack": mutation(api.teams.setTechStack),
  "teams:transferOwnership": mutation(api.teams.transferOwnership),
  "teams:dissolve": mutation(api.teams.dissolve),

  // tracks and projects
  "tracks:list": query(api.tracks.list),
  "tracks:settings": query(api.tracks.settings),
  "submissions:mine": query(api.submissions.mine),
  "submissions:listPublic": query(api.submissions.listPublic),
  "submissions:saveDraft": mutation(api.submissions.saveDraft),
  "submissions:submit": mutation(api.submissions.submit),

  // perks and milestones
  "perks:listCatalog": query(api.perks.listCatalog),
  "milestones:add": mutation(api.milestones.add),
  "milestones:mine": query(api.milestones.mine),
  "milestones:list": query(api.milestones.list),

  // watcher
  "notifications:forMe": query(api.notifications.forMe),

  // feed (image upload goes through /api/cli/upload, not rpc)
  "feed:list": query(api.feed.list),
  "feed:post": mutation(api.feed.post),
  "feed:remove": mutation(api.feed.remove),
};
