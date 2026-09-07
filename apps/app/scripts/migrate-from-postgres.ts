import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

type SignupRow = {
  id: string;
  created_at: Date | string;
  full_name: string;
  email: string;
  x_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  web_url: string | null;
  achievements: string | null;
  free_time: string | null;
  wants_ambassador: boolean;
  ambassador_motivation: string | null;
  // Only selected when the column exists: live Neon has approval_status but
  // not ambassador_study_where; a database created from the repo's Drizzle
  // schema is the other way around.
  approval_status?: string | null;
  ambassador_study_where?: string | null;
  dietary_restrictions?: string[] | null;
  dietary_details?: string | null;
};

type AmbassadorRow = {
  id: string;
  created_at: Date | string;
  full_name: string;
  email: string;
  institution: string;
  city_region: string;
  x_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  web_url: string | null;
  motivation: string;
  outreach_plan: string;
};

const repoRoot = resolve(import.meta.dirname, "../../..");

function loadEnvFile(path: string, overrideKeys?: Set<string>): void {
  if (!existsSync(path)) {
    return;
  }
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const trimmed = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || overrideKeys?.has(key)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(repoRoot, "apps/app/.env.local"));
loadEnvFile(resolve(repoRoot, "apps/web/.env"), new Set(["DATABASE_URL"]));

function loadAcceptedEmails(): Set<string> {
  const path = resolve(repoRoot, "apps/web/src/data/shortlistApplicants.json");
  if (!existsSync(path)) {
    return new Set();
  }
  const rows = JSON.parse(readFileSync(path, "utf8")) as {
    email?: string;
    finalSelected?: boolean;
  }[];
  const emails = new Set<string>();
  for (const row of rows) {
    if (!row.finalSelected) {
      continue;
    }
    const email = row.email?.trim().toLowerCase();
    if (email) {
      emails.add(email);
    }
  }
  return emails;
}

function toMillis(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

function optional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function urlsFromNeon(row: {
  x_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  web_url: string | null;
}): { kind: "x" | "linkedin" | "github" | "web"; url: string }[] {
  const urls: { kind: "x" | "linkedin" | "github" | "web"; url: string }[] = [];
  const xUrl = optional(row.x_url);
  const linkedinUrl = optional(row.linkedin_url);
  const githubUrl = optional(row.github_url);
  const webUrl = optional(row.web_url);
  if (xUrl) {
    urls.push({ kind: "x", url: xUrl });
  }
  if (linkedinUrl) {
    urls.push({ kind: "linkedin", url: linkedinUrl });
  }
  if (githubUrl) {
    urls.push({ kind: "github", url: githubUrl });
  }
  if (webUrl) {
    urls.push({ kind: "web", url: webUrl });
  }
  return urls;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  const secret = process.env.MIGRATION_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required (apps/web/.env)");
  }
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required (apps/app/.env.local)");
  }
  if (!secret) {
    throw new Error(
      "MIGRATION_SECRET is required (apps/app/.env.local, must match Convex env)"
    );
  }

  const sql = neon(databaseUrl);
  const convex = new ConvexHttpClient(convexUrl);
  const acceptedEmails = loadAcceptedEmails();

  // Live Neon and a fresh database from the repo's Drizzle schema disagree on
  // optional columns, so probe what actually exists before selecting.
  const signupColumns = (await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hackathon_signups'
  `) as { column_name: string }[];
  const availableColumns = new Set(signupColumns.map((row) => row.column_name));
  const requiredColumns = [
    "id",
    "created_at",
    "full_name",
    "email",
    "x_url",
    "linkedin_url",
    "github_url",
    "web_url",
    "achievements",
    "free_time",
    "wants_ambassador",
    "ambassador_motivation",
  ];
  const missingRequired = requiredColumns.filter(
    (column) => !availableColumns.has(column)
  );
  if (missingRequired.length > 0) {
    throw new Error(
      `hackathon_signups is missing expected columns: ${missingRequired.join(", ")}`
    );
  }
  const optionalColumns = [
    "approval_status",
    "ambassador_study_where",
    "dietary_restrictions",
    "dietary_details",
  ].filter((column) => availableColumns.has(column));
  const hasApprovalStatus = availableColumns.has("approval_status");

  const signups = (await sql.query(
    `SELECT ${[...requiredColumns, ...optionalColumns].join(", ")} FROM hackathon_signups`
  )) as SignupRow[];

  const ambassadorTables = (await sql`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ambassador_applications'
    LIMIT 1
  `) as { ok: number }[];

  const ambassadors = ambassadorTables.length
    ? ((await sql`
        SELECT
          id, created_at, full_name, email, institution, city_region,
          x_url, linkedin_url, github_url, web_url, motivation, outreach_plan
        FROM ambassador_applications
      `) as AmbassadorRow[])
    : [];

  const rowAccepted = (row: SignupRow): boolean =>
    (hasApprovalStatus && row.approval_status === "confirmed") ||
    acceptedEmails.has(row.email.trim().toLowerCase());

  let signupInserted = 0;
  let signupUpdated = 0;
  for (const group of chunk(signups, 50)) {
    const result = await convex.mutation(api.migrations.importSignups, {
      secret,
      signups: group.map((row) => ({
        accepted: rowAccepted(row),
        achievements: optional(row.achievements),
        ambassadorMotivation: optional(row.ambassador_motivation),
        ambassadorStudyWhere: optional(row.ambassador_study_where),
        createdAt: toMillis(row.created_at),
        dietaryDetails: optional(row.dietary_details),
        dietaryRestrictionIds: row.dietary_restrictions ?? undefined,
        email: row.email,
        freeTime: optional(row.free_time),
        fullName: row.full_name,
        neonId: row.id,
        urls: urlsFromNeon(row),
        wantsAmbassador: Boolean(row.wants_ambassador),
      })),
    });
    signupInserted += result.inserted;
    signupUpdated += result.updated;
  }

  let ambassadorInserted = 0;
  let ambassadorUpdated = 0;
  for (const group of chunk(ambassadors, 50)) {
    const result = await convex.mutation(api.migrations.importAmbassadors, {
      applications: group.map((row) => ({
        email: row.email,
        fullName: row.full_name,
        institution: row.institution,
        cityRegion: row.city_region,
        urls: urlsFromNeon(row),
        motivation: row.motivation,
        outreachPlan: row.outreach_plan,
        createdAt: toMillis(row.created_at),
        neonId: row.id,
      })),
      secret,
    });
    ambassadorInserted += result.inserted;
    ambassadorUpdated += result.updated;
  }

  const acceptedInBatch = signups.filter(rowAccepted).length;
  console.log(
    `Signups: ${signups.length} read, ${signupInserted} inserted, ${signupUpdated} updated, ${acceptedInBatch} marked accepted (Neon confirmed + shortlist)`
  );
  if (ambassadorTables.length === 0) {
    console.log("Ambassador applications: table not in Neon, skipped");
  } else {
    console.log(
      `Ambassador applications: ${ambassadors.length} read, ${ambassadorInserted} inserted, ${ambassadorUpdated} updated`
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
