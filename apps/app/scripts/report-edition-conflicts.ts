import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { normalizeEmail } from "../convex/lib/normalize";

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

function neonAccepted(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "accepted";
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
    throw new Error("MIGRATION_SECRET is required (apps/app/.env.local)");
  }

  const sql = neon(databaseUrl);
  const convex = new ConvexHttpClient(convexUrl);
  const convexRows = await convex.query(api.editions.convexSignupSnapshot, {
    secret,
  });
  const neonRows = (await sql`
    SELECT email, approval_status, id
    FROM hackathon_signups
  `) as { email: string; approval_status: string | null; id: string }[];

  const convexByEmail = new Map(
    convexRows.map((row) => [normalizeEmail(row.email), row])
  );
  const neonByEmail = new Map(
    neonRows.map((row) => [normalizeEmail(row.email), row])
  );

  const onlyNeon: string[] = [];
  const onlyConvex: string[] = [];
  const statusMismatch: {
    acceptedConvex: boolean;
    acceptedNeon: boolean;
    email: string;
  }[] = [];

  for (const [email, row] of neonByEmail) {
    const convexRow = convexByEmail.get(email);
    if (!convexRow) {
      onlyNeon.push(email);
      continue;
    }
    const acceptedNeon = neonAccepted(row.approval_status);
    if (acceptedNeon !== convexRow.accepted) {
      statusMismatch.push({
        acceptedConvex: convexRow.accepted,
        acceptedNeon,
        email,
      });
    }
  }
  for (const email of convexByEmail.keys()) {
    if (!neonByEmail.has(email)) {
      onlyConvex.push(email);
    }
  }

  console.log(
    JSON.stringify(
      {
        convex: convexRows.length,
        neon: neonRows.length,
        onlyConvex: onlyConvex.length,
        onlyNeon: onlyNeon.length,
        statusMismatch: statusMismatch.length,
        sampleOnlyConvex: onlyConvex.slice(0, 20),
        sampleOnlyNeon: onlyNeon.slice(0, 20),
        sampleStatusMismatch: statusMismatch.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
