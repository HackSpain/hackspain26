import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { hackathonSignups, shortlistReviews } from "../../db/schema";
import {
  isShortlistAuthorized,
  SHORTLIST_COOKIE_NAME,
} from "../../lib/shortlist-auth";
import { listPendingShortlistParticipants } from "../../lib/shortlist-server";
import type {
  ShortlistImportResponse,
  ShortlistResponse,
} from "../../lib/shortlist-types";

export const prerender = false;

const MAX_CSV_SIZE = 3_000_000;
const MAX_NOTES_LENGTH = 10_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTF8_BOM_PATTERN = /^\uFEFF/;

const reviewPatchSchema = z
  .object({
    decision: z.enum(["yes", "maybe", "no"]).nullable().optional(),
    notes: z.string().max(MAX_NOTES_LENGTH).optional(),
    score: z.number().int().min(1).max(5).nullable().optional(),
    signupId: z.string().regex(UUID_PATTERN),
  })
  .refine(
    ({ decision, notes, score }) =>
      decision !== undefined || notes !== undefined || score !== undefined,
    { message: "At least one review field is required" }
  );

const csvImportSchema = z.object({
  csvText: z.string().min(1).max(MAX_CSV_SIZE),
});

const notFound = (): Response =>
  Response.json({ error: "not_found" }, { status: 404 });

const isAuthorizedShortlistRequest = (cookies: {
  get: (name: string) => { value: string } | undefined;
}): Promise<boolean> =>
  isShortlistAuthorized(cookies.get(SHORTLIST_COOKIE_NAME)?.value);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  const pushField = (): void => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = (): void => {
    pushField();
    if (currentRow.some((value) => value.trim().length > 0)) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      pushField();
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  return rows;
};

const cellAt = (
  row: readonly string[],
  headerIndexes: ReadonlyMap<string, number>,
  header: string
): string => {
  const index = headerIndexes.get(header);
  return index === undefined ? "" : (row[index] ?? "").trim();
};

const nullableText = (value: string): string | null =>
  value.length > 0 ? value : null;

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await isAuthorizedShortlistRequest(cookies))) {
    return notFound();
  }

  try {
    const response: ShortlistResponse = {
      participants: await listPendingShortlistParticipants(),
    };
    return Response.json(response);
  } catch (error: unknown) {
    console.error(
      "[shortlist] Failed to load pending applicants",
      error instanceof Error ? error.message : "unknown error"
    );
    return Response.json({ error: "load_failed" }, { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!(await isAuthorizedShortlistRequest(cookies))) {
    return notFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = reviewPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_review" }, { status: 400 });
  }

  const { decision, notes, score, signupId } = parsed.data;
  const db = getDb();

  try {
    const [pendingSignup] = await db
      .select({ id: hackathonSignups.id })
      .from(hackathonSignups)
      .where(eq(hackathonSignups.id, signupId))
      .limit(1);

    if (!pendingSignup) {
      return Response.json({ error: "signup_not_found" }, { status: 404 });
    }

    const [status] = await db
      .select({ approvalStatus: hackathonSignups.approvalStatus })
      .from(hackathonSignups)
      .where(eq(hackathonSignups.id, signupId))
      .limit(1);

    if (status?.approvalStatus !== "pending") {
      return Response.json({ error: "signup_not_pending" }, { status: 409 });
    }

    const now = new Date();
    const reviewValues = {
      ...(decision === undefined ? {} : { decision }),
      ...(notes === undefined ? {} : { notes }),
      ...(score === undefined ? {} : { score }),
      signupId,
      updatedAt: now,
    };
    const updateValues = {
      ...(decision === undefined ? {} : { decision }),
      ...(notes === undefined ? {} : { notes }),
      ...(score === undefined ? {} : { score }),
      updatedAt: now,
    };

    await db.insert(shortlistReviews).values(reviewValues).onConflictDoUpdate({
      set: updateValues,
      target: shortlistReviews.signupId,
    });

    return Response.json({ ok: true, updatedAt: now.toISOString() });
  } catch (error: unknown) {
    console.error(
      "[shortlist] Failed to save review",
      error instanceof Error ? error.message : "unknown error"
    );
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAuthorizedShortlistRequest(cookies))) {
    return notFound();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = csvImportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_csv" }, { status: 400 });
  }

  try {
    const rows = parseCsvRows(
      parsed.data.csvText.replace(UTF8_BOM_PATTERN, "")
    );
    const [headers, ...dataRows] = rows;
    if (!headers) {
      return Response.json({ error: "empty_csv" }, { status: 400 });
    }

    const headerIndexes = new Map(
      headers.map((header, index) => [header.trim().toLowerCase(), index])
    );
    if (!(headerIndexes.has("id") || headerIndexes.has("email"))) {
      return Response.json(
        { error: "csv_requires_id_or_email" },
        { status: 400 }
      );
    }

    const db = getDb();
    const pendingSignups = await db
      .select({
        email: hackathonSignups.email,
        id: hackathonSignups.id,
      })
      .from(hackathonSignups)
      .where(eq(hackathonSignups.approvalStatus, "pending"));
    const signupsById = new Map(
      pendingSignups.map((signup) => [signup.id, signup])
    );
    const signupsByEmail = new Map(
      pendingSignups.map((signup) => [normalizeEmail(signup.email), signup])
    );
    const importedAt = new Date();
    const matchedRows = new Map<
      string,
      {
        notes: string | null;
        signupId: string;
        sourceImportedAt: Date;
        sourceNotes: string | null;
        updatedAt: Date;
      }
    >();
    let unmatched = 0;

    for (const row of dataRows) {
      const csvId = cellAt(row, headerIndexes, "id");
      const csvEmail = normalizeEmail(cellAt(row, headerIndexes, "email"));
      const signup = signupsById.get(csvId) ?? signupsByEmail.get(csvEmail);
      if (!signup) {
        unmatched += 1;
        continue;
      }

      const sourceNotes = nullableText(cellAt(row, headerIndexes, "notes"));
      matchedRows.set(signup.id, {
        notes: sourceNotes,
        signupId: signup.id,
        sourceImportedAt: importedAt,
        sourceNotes,
        updatedAt: importedAt,
      });
    }

    const values = [...matchedRows.values()];
    if (values.length > 0) {
      await db
        .insert(shortlistReviews)
        .values(values)
        .onConflictDoUpdate({
          set: {
            notes: sql`CASE WHEN ${shortlistReviews.sourceImportedAt} IS NULL AND ${shortlistReviews.notes} IS NULL THEN excluded.source_notes ELSE ${shortlistReviews.notes} END`,
            sourceImportedAt: sql`excluded.source_imported_at`,
            sourceNotes: sql`excluded.source_notes`,
            updatedAt: importedAt,
          },
          target: shortlistReviews.signupId,
        });
    }

    const response: ShortlistImportResponse = {
      imported: dataRows.length,
      matched: values.length,
      unmatched,
    };
    return Response.json(response);
  } catch (error: unknown) {
    console.error(
      "[shortlist] Failed to import CSV",
      error instanceof Error ? error.message : "unknown error"
    );
    return Response.json({ error: "import_failed" }, { status: 500 });
  }
};
