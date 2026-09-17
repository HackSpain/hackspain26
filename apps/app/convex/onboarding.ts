import { v } from "convex/values";
import { acceptedMutation, acceptedQuery } from "./lib/customFunctions";
import { defaultedAttendance } from "./lib/attendance";
import { getSignupForUser } from "./lib/auth";
import { attendanceValidator } from "./lib/validators";
import { normalizePhone, PHONE_ERROR } from "./lib/normalize";

export const status = acceptedQuery({
  args: {},
  handler: async (ctx) => {
    const signup = await getSignupForUser(ctx, ctx.user);
    return {
      phone: ctx.user.phone,
      notificationConsent: ctx.user.notificationConsent,
      attendanceStatus: defaultedAttendance(
        ctx.user.attendanceStatus,
        ctx.user.onboardingComplete || ctx.user.role === "admin"
      ),
      dietaryRestrictions:
        ctx.user.dietaryRestrictions ?? signup?.dietaryRestrictions,
      dietaryDetails: ctx.user.dietaryDetails ?? signup?.dietaryDetails,
      travelOrigin: ctx.user.travelOrigin,
      onboardingComplete: ctx.user.onboardingComplete,
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
    const travelOrigin =
      args.travelOrigin?.trim() || ctx.user.travelOrigin?.trim() || undefined;
    const signup = await getSignupForUser(ctx, ctx.user);
    const dietaryRestrictions =
      ctx.user.dietaryRestrictions?.trim() ||
      signup?.dietaryRestrictions?.trim() ||
      "Ninguna";
    const dietaryDetails =
      ctx.user.dietaryDetails?.trim() ||
      signup?.dietaryDetails?.trim() ||
      undefined;
    // Revisiting the step from the wizard's "Atrás" keeps the original stamps.
    const consentChanged = ctx.user.notificationConsent !== args.consent;
    await ctx.db.patch(ctx.user._id, {
      phone,
      dietaryRestrictions,
      dietaryDetails,
      travelOrigin,
      notificationConsent: args.consent,
      notificationConsentAt: consentChanged
        ? Date.now()
        : (ctx.user.notificationConsentAt ?? Date.now()),
      termsAcceptedAt: ctx.user.termsAcceptedAt ?? Date.now(),
      attendanceStatus: "attending",
      onboardingComplete: true,
    });
    return null;
  },
  returns: v.null(),
});
