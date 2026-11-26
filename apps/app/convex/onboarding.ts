import { v } from "convex/values";
import { acceptedMutation, acceptedQuery } from "./lib/customFunctions";
import { defaultedAttendance } from "./lib/attendance";
import { isAdmin } from "./lib/auth";
import { getCurrentParticipation } from "./lib/participations";
import { attendanceValidator } from "./lib/validators";
import { normalizePhone, PHONE_ERROR } from "./lib/normalize";

export const status = acceptedQuery({
  args: {},
  handler: async (ctx) => {
    const participation = await getCurrentParticipation(ctx, ctx.user);
    const onboarded =
      participation?.onboardingComplete === true || isAdmin(ctx.user);
    return {
      phone: ctx.user.phone,
      notificationConsent: ctx.user.notificationConsent,
      attendanceStatus: defaultedAttendance(
        participation?.attendanceStatus,
        onboarded
      ),
      dietaryRestrictions: participation?.dietaryRestrictions,
      dietaryDetails: participation?.dietaryDetails,
      travelOrigin: participation?.travelOrigin,
      onboardingComplete: onboarded,
    };
  },
  returns: v.object({
    phone: v.optional(v.string()),
    notificationConsent: v.boolean(),
    attendanceStatus: attendanceValidator,
    dietaryRestrictions: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    travelOrigin: v.optional(v.string()),
    onboardingComplete: v.boolean(),
  }),
});

export const confirmDetails = acceptedMutation({
  args: {
    consent: v.boolean(),
    /** Contact number for the venue; stored normalised (E.164), not verified. */
    phone: v.string(),
    termsAccepted: v.boolean(),
    /** Pre-event logistics; the dashboard no longer asks, the CLI still may. */
    travelOrigin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error(PHONE_ERROR);
    }
    if (!args.termsAccepted) {
      throw new Error("Acepta los términos para continuar");
    }
    const participation = await getCurrentParticipation(ctx, ctx.user);
    const travelOrigin =
      args.travelOrigin?.trim() ||
      participation?.travelOrigin?.trim() ||
      undefined;
    const dietaryRestrictions =
      participation?.dietaryRestrictions?.trim() || "Ninguna";
    const dietaryDetails = participation?.dietaryDetails?.trim() || undefined;
    // Revisiting the step from the wizard's "Atrás" keeps the original stamps.
    const consentChanged = ctx.user.notificationConsent !== args.consent;
    await ctx.db.patch(ctx.user._id, {
      phone,
      notificationConsent: args.consent,
      notificationConsentAt: consentChanged
        ? Date.now()
        : (ctx.user.notificationConsentAt ?? Date.now()),
    });
    if (participation) {
      const cancelled = participation.attendanceStatus === "cancelled";
      await ctx.db.patch(participation._id, {
        dietaryDetails,
        dietaryRestrictions,
        onboardingComplete: true,
        termsAcceptedAt: participation.termsAcceptedAt ?? Date.now(),
        travelOrigin,
        ...(cancelled
          ? {}
          : {
              attendanceStatus: "attending" as const,
              status:
                participation.status === "accepted" ||
                participation.status === "confirmed"
                  ? ("confirmed" as const)
                  : participation.status,
            }),
      });
    }
    return null;
  },
  returns: v.null(),
});
