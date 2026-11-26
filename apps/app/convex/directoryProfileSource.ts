import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireDirectoryViewer } from "./lib/auth";
import { getCurrentParticipation } from "./lib/participations";
import { isDirectoryComplete } from "./lib/directory";
import { matchesParticipantProfile } from "./lib/directoryProfileSource";

/** Authorize the exact profile shown on a directory card before an external fetch. */
export const assert = internalQuery({
  args: {
    kind: v.union(v.literal("github"), v.literal("linkedin")),
    participantId: v.id("users"),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await requireDirectoryViewer(ctx);
    const participant = await ctx.db.get(args.participantId);
    if (!participant || !isDirectoryComplete(participant.directory)) {
      throw new Error("Ese perfil no pertenece al directorio.");
    }
    const signup = await getCurrentParticipation(ctx, participant);
    if (
      !matchesParticipantProfile(
        args.kind,
        args.value,
        participant.githubUsername ?? signup?.githubUsername,
        signup?.urls
      )
    ) {
      throw new Error("Ese perfil no pertenece al directorio.");
    }
    return null;
  },
  returns: v.null(),
});
