import { z } from "zod";
import { DIETARY_RESTRICTION_IDS } from "./signup-validation";

const MENTOR_SPONSOR_MAX = {
  email: 320,
  longText: 8000,
  name: 200,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `<day>_<slot>` keys; must stay in sync with the DB check constraint. */
export const ATTENDANCE_SLOT_IDS = [
  "fri_morning",
  "fri_lunch",
  "fri_afternoon",
  "fri_dinner",
  "sat_morning",
  "sat_lunch",
  "sat_afternoon",
  "sat_dinner",
  "sun_morning",
  "sun_lunch",
  "sun_afternoon",
  "sun_dinner",
] as const;

export type AttendanceSlotId = (typeof ATTENDANCE_SLOT_IDS)[number];

export const ATTENDANCE_DAY_OPTIONS: readonly {
  id: "fri" | "sat" | "sun";
  label: string;
}[] = [
  { id: "fri", label: "Viernes 18" },
  { id: "sat", label: "Sábado 19" },
  { id: "sun", label: "Domingo 20" },
] as const;

export const ATTENDANCE_MEAL_OPTIONS: readonly {
  id: "morning" | "lunch" | "afternoon" | "dinner";
  label: string;
}[] = [
  { id: "morning", label: "Mañana" },
  { id: "lunch", label: "Comida" },
  { id: "afternoon", label: "Tarde" },
  { id: "dinner", label: "Cena" },
] as const;

/** One line per attended day, e.g. "Viernes 18: comida, tarde". */
export function formatAttendanceSlots(
  slots: readonly string[]
): readonly string[] {
  const chosen = new Set(slots);
  const lines: string[] = [];
  for (const day of ATTENDANCE_DAY_OPTIONS) {
    const meals = ATTENDANCE_MEAL_OPTIONS.filter((meal) =>
      chosen.has(`${day.id}_${meal.id}`)
    ).map((meal) => meal.label.toLowerCase());
    if (meals.length > 0) {
      lines.push(`${day.label}: ${meals.join(", ")}`);
    }
  }
  return lines;
}

function requiredName(message: string) {
  return z
    .string()
    .max(MENTOR_SPONSOR_MAX.name)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message });
}

const mentorSponsorBodySchema = z
  .object({
    attendanceSlots: z.preprocess(
      (value) => (Array.isArray(value) ? value : []),
      z
        .array(z.enum(ATTENDANCE_SLOT_IDS))
        .min(1, { message: "attendance_required" })
        .max(ATTENDANCE_SLOT_IDS.length)
        .transform((values) => [...new Set(values)])
    ),
    company: requiredName("company_required"),
    dietaryDataConsent: z.boolean().optional().default(false),
    dietaryDetails: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z
        .string()
        .max(MENTOR_SPONSOR_MAX.longText)
        .transform((value) => value.trim())
    ),
    dietaryRestrictions: z.preprocess(
      (value) => (Array.isArray(value) ? value : []),
      z
        .array(z.enum(DIETARY_RESTRICTION_IDS))
        .max(DIETARY_RESTRICTION_IDS.length)
        .transform((values) => [...new Set(values)])
    ),
    email: z
      .string()
      .max(MENTOR_SPONSOR_MAX.email)
      .transform((s) => s.trim().toLowerCase())
      .refine((s) => EMAIL_RE.test(s), { message: "invalid_email" }),
    firstName: requiredName("first_name_required"),
    lastName: requiredName("last_name_required"),
    notes: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z
        .string()
        .max(MENTOR_SPONSOR_MAX.longText)
        .transform((value) => value.trim())
    ),
  })
  .superRefine((data, ctx) => {
    const hasDietaryData =
      data.dietaryRestrictions.length > 0 || data.dietaryDetails.length > 0;
    if (hasDietaryData && !data.dietaryDataConsent) {
      ctx.addIssue({
        code: "custom",
        message: "dietary_consent_required",
        path: ["dietaryDataConsent"],
      });
    }
  });

type MentorSponsorBodyParsed = z.infer<typeof mentorSponsorBodySchema>;

const KNOWN_ERRORS = new Set([
  "first_name_required",
  "last_name_required",
  "invalid_email",
  "company_required",
  "attendance_required",
  "dietary_consent_required",
]);

export function parseMentorSponsorBody(
  body: unknown
):
  | { ok: true; data: MentorSponsorBodyParsed }
  | { ok: false; error: string; status: number } {
  const r = mentorSponsorBodySchema.safeParse(body);
  if (r.success) {
    return { data: r.data, ok: true };
  }
  const msg = r.error.issues[0]?.message ?? "validation_error";
  if (KNOWN_ERRORS.has(msg)) {
    return { error: msg, ok: false, status: 400 };
  }
  return { error: "invalid_request", ok: false, status: 400 };
}
