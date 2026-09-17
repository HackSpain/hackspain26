/**
 * Marks everyone on the accreditation sheet as Hacker / Mentor / Sponsor and
 * creates accounts for mentors and sponsors who never registered.
 *
 *   pnpm import:accreditations <sheet.csv>                # dry run against .env.local's deployment
 *   pnpm import:accreditations <sheet.csv> --apply        # write
 *   pnpm import:accreditations <sheet.csv> --url https://<prod>.convex.cloud --apply
 *
 * MIGRATION_SECRET must match the target deployment (`npx convex env get
 * MIGRATION_SECRET --prod`); it is read from the environment or apps/app/.env.local.
 * Sheet columns: tipo,nombre,email,organizacion,dieta,dieta_detalle,franjas.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { AccreditationType } from "../convex/migrations";

const TYPES: AccreditationType[] = ["hacker", "mentor", "sponsor"];

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** RFC 4180: quoted fields may hold commas, newlines and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function isType(value: string): value is AccreditationType {
  return (TYPES as string[]).includes(value);
}

function readSheet(path: string) {
  const [header, ...lines] = parseCsv(readFileSync(path, "utf8").replace(/^﻿/, ""));
  if (!header) {
    throw new Error("Empty sheet");
  }
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new Error(`Column "${name}" missing; found ${header.join(", ")}`);
    }
    return index;
  };
  const cType = col("tipo");
  const cName = col("nombre");
  const cEmail = col("email");
  const cOrg = col("organizacion");
  const cDiet = col("dieta");
  const cDietDetail = col("dieta_detalle");
  const skipped: string[] = [];
  const rows = lines.flatMap((cells, index) => {
    const type = (cells[cType] ?? "").trim().toLowerCase();
    const email = (cells[cEmail] ?? "").trim().toLowerCase();
    if (!isType(type) || !email.includes("@")) {
      skipped.push(`line ${index + 2}: tipo="${type}" email="${email}"`);
      return [];
    }
    const diet = (cells[cDiet] ?? "")
      .split(";")
      .map((id) => id.trim())
      .filter(Boolean);
    return [
      {
        dietaryDetails: (cells[cDietDetail] ?? "").trim() || undefined,
        dietaryRestrictionIds: diet.length > 0 ? diet : undefined,
        email,
        fullName: (cells[cName] ?? "").trim(),
        organization: (cells[cOrg] ?? "").trim() || undefined,
        type,
      },
    ];
  });
  return { rows, skipped };
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const sheet = process.argv.slice(2).find((arg) => !arg.startsWith("--") && arg.endsWith(".csv"));
  if (!sheet) {
    console.error("Usage: import-accreditations <sheet.csv> [--apply] [--url <convex url>]");
    process.exit(2);
  }
  loadEnvFile(resolve(import.meta.dirname, "../.env.local"));
  const url = option("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.MIGRATION_SECRET;
  if (!url || !secret) {
    console.error("Need --url (or NEXT_PUBLIC_CONVEX_URL) and MIGRATION_SECRET");
    process.exit(2);
  }
  const dryRun = !flag("--apply");
  const { rows, skipped } = readSheet(resolve(sheet));
  const counts = Object.fromEntries(TYPES.map((t) => [t, rows.filter((r) => r.type === t).length]));
  console.log(`${dryRun ? "Dry run" : "Applying"} ${rows.length} rows against ${url}`);
  console.log(`  ${TYPES.map((t) => `${t}: ${counts[t]}`).join(", ")}`);
  for (const line of skipped) {
    console.log(`  skipped ${line}`);
  }

  const client = new ConvexHttpClient(url);
  const report = await client.mutation(api.migrations.importAccreditations, {
    dryRun,
    rows,
    secret,
  });
  const show = (title: string, emails: string[]) => {
    console.log(`${title}: ${emails.length}`);
    for (const email of emails) {
      console.log(`  ${email}`);
    }
  };
  console.log(`\nTypes created: ${report.typesCreated.join(", ") || "none"}`);
  show("Mentors/sponsors given an account", report.created);
  show("Accounts updated", report.updated);
  console.log(`Accounts already right: ${report.unchanged}`);
  show("Hackers registered but not logged in yet (nothing to mark)", report.noAccount);
  show("Hackers not found in the app (check the sheet)", report.unknown);
  if (dryRun) {
    console.log("\nDry run: nothing written. Add --apply to write.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
