import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentParticipation } from "./participationLookup";
import type { ParticipationStatus } from "./validators";
import { participationStatusValidator } from "./validators";

export { participationStatusValidator };
export type { ParticipationStatus };
export {
  getCurrentParticipation,
  participationByEditionEmail,
  participationByEditionUser,
} from "./participationLookup";

export function participationIsRegistered(
  status: ParticipationStatus | undefined
): boolean {
  return status !== undefined && status !== "interested";
}

export function participationIsAccepted(
  status: ParticipationStatus | undefined
): boolean {
  return (
    status === "accepted" || status === "confirmed" || status === "cancelled"
  );
}

export function legacyParticipationStatus(args: {
  accepted?: boolean;
  attendanceStatus?: Doc<"participations">["attendanceStatus"];
  hasSignup: boolean;
  onboarded: boolean;
  staffWithoutSignup: boolean;
}): ParticipationStatus {
  if (args.attendanceStatus === "cancelled") {
    return "cancelled";
  }
  if (args.accepted === true) {
    return args.onboarded ? "confirmed" : "accepted";
  }
  if (args.staffWithoutSignup) {
    return "accepted";
  }
  if (args.hasSignup) {
    return "applied";
  }
  return "applied";
}

export async function requireCurrentParticipation(
  ctx: QueryCtx | MutationCtx,
  user: Pick<Doc<"users">, "_id" | "email">
): Promise<Doc<"participations">> {
  const row = await getCurrentParticipation(ctx, user);
  if (!row || !participationIsRegistered(row.status)) {
    throw new Error("No hay inscripción a la hackathon con este email");
  }
  return row;
}
