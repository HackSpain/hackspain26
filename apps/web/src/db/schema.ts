import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

type SignupApprovalStatus =
  | "accepted"
  | "cancelled"
  | "confirmed"
  | "pending"
  | "rejected"
  | "waitlist";

export const hackathonSignups = pgTable(
  "hackathon_signups",
  {
    achievements: text("achievements"),
    ambassadorMotivation: text("ambassador_motivation"),
    approvalStatus: text("approval_status")
      .$type<SignupApprovalStatus>()
      .default("pending")
      .notNull(),
    /**
     * The photo they chose for their badge, as a data URI, downscaled in the
     * browser before it is sent. Stored so the social image can print it: that
     * image is drawn on the server, which cannot see a photo living in a tab.
     */
    badgePhoto: text("badge_photo"),
    /** Doubles as the cache key for the social image. */
    badgePhotoUpdatedAt: timestamp("badge_photo_updated_at", {
      withTimezone: true,
    }),
    cameFromPreSignup: boolean("came_from_pre_signup").default(false).notNull(),
    cancellationEmailSentAt: timestamp("cancellation_email_sent_at", {
      withTimezone: true,
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dietaryConsentAt: timestamp("dietary_consent_at", { withTimezone: true }),
    dietaryDetails: text("dietary_details"),
    dietaryRestrictions: text("dietary_restrictions")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    email: text("email").notNull().unique(),
    employer: text("employer"),
    freeTime: text("free_time"),
    fullName: text("full_name").notNull(),
    githubUrl: text("github_url"),
    heardFrom: text("heard_from_sources")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    linkedinUrl: text("linkedin_url"),
    managementToken: uuid("management_token")
      .defaultRandom()
      .notNull()
      .unique(),
    occupationStatuses: text("occupation_statuses")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    referralCode: text("referral_code"),
    studyInstitution: text("study_institution"),
    wantsAmbassador: boolean("wants_ambassador").default(false).notNull(),
    webUrl: text("web_url"),
    xUrl: text("x_url"),
  },
  (table) => [
    check(
      "hackathon_signups_approval_status_check",
      sql`${table.approvalStatus} IN ('pending', 'rejected', 'accepted', 'confirmed', 'cancelled', 'waitlist')`
    ),
  ]
);

export const hackathonPreSignups = pgTable("hackathon_pre_signups", {
  cancellationToken: uuid("cancellation_token")
    .defaultRandom()
    .notNull()
    .unique(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  githubUrl: text("github_url"),
  id: uuid("id").defaultRandom().primaryKey(),
  linkedinUrl: text("linkedin_url"),
  referralCode: text("referral_code"),
  signupCompletedAt: timestamp("signup_completed_at", {
    withTimezone: true,
  }),
  signupToken: uuid("signup_token").defaultRandom().notNull().unique(),
  webUrl: text("web_url"),
  xUrl: text("x_url"),
});

type MentorSponsorRole = "mentor" | "sponsor";

export const mentorSponsorSignups = pgTable(
  "mentor_sponsor_signups",
  {
    /** `<day>_<slot>` keys, e.g. `fri_lunch`; drives food headcounts. */
    attendanceSlots: text("attendance_slots")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    company: text("company").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dietaryConsentAt: timestamp("dietary_consent_at", { withTimezone: true }),
    dietaryDetails: text("dietary_details"),
    dietaryRestrictions: text("dietary_restrictions")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastName: text("last_name").notNull(),
    managementToken: uuid("management_token")
      .defaultRandom()
      .notNull()
      .unique(),
    notes: text("notes"),
    /** Set by hand in the DB, never by the form. */
    role: text("role").$type<MentorSponsorRole>(),
  },
  (table) => [
    check(
      "mentor_sponsor_signups_role_check",
      sql`${table.role} IS NULL OR ${table.role} IN ('mentor', 'sponsor')`
    ),
    check(
      "mentor_sponsor_signups_attendance_slots_check",
      sql`${table.attendanceSlots} <@ ARRAY['fri_morning', 'fri_lunch', 'fri_afternoon', 'fri_dinner', 'sat_morning', 'sat_lunch', 'sat_afternoon', 'sat_dinner', 'sun_morning', 'sun_lunch', 'sun_afternoon', 'sun_dinner']::text[]`
    ),
  ]
);
