import { z } from "zod";
import { normalizeReferralCode } from "./referral-code";

const SIGNUP_MAX = {
  email: 320,
  heardFrom: 500,
  heardFromOther: 494,
  longText: 8000,
  name: 200,
  url: 2048,
} as const;

export const HEARD_FROM_SOURCE_IDS = [
  "x",
  "exponential",
  "linkedin",
  "friend",
  "school",
  "event",
  "search",
  "other",
] as const;

export type HeardFromSourceId = (typeof HEARD_FROM_SOURCE_IDS)[number];

export const HEARD_FROM_OPTIONS: readonly {
  id: HeardFromSourceId;
  label: string;
}[] = [
  { id: "x", label: "X (Twitter)" },
  { id: "exponential", label: "Exponential" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "friend", label: "Un amigo o compañero" },
  { id: "school", label: "Universidad, FP o bootcamp" },
  { id: "event", label: "Evento, charla o meetup" },
  { id: "search", label: "Google u otra búsqueda" },
  { id: "other", label: "Otro" },
] as const;

export const DIETARY_RESTRICTION_IDS = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
  "halal",
  "kosher",
  "allergies",
  "other",
] as const;

export type DietaryRestrictionId = (typeof DIETARY_RESTRICTION_IDS)[number];

export const DIETARY_RESTRICTION_OPTIONS: readonly {
  id: DietaryRestrictionId;
  label: string;
}[] = [
  { id: "vegetarian", label: "Vegetariana" },
  { id: "vegan", label: "Vegana" },
  { id: "gluten_free", label: "Sin gluten" },
  { id: "lactose_free", label: "Sin lactosa" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
  { id: "allergies", label: "Alergias" },
  { id: "other", label: "Otra" },
] as const;

export const OCCUPATION_STATUS_IDS = ["student", "working"] as const;

export type OccupationStatusId = (typeof OCCUPATION_STATUS_IDS)[number];

export const OCCUPATION_STATUS_OPTIONS: readonly {
  id: OccupationStatusId;
  label: string;
}[] = [
  { id: "student", label: "Estudiante" },
  { id: "working", label: "Trabajo" },
] as const;

export function formatOccupationStatuses(statuses: readonly string[]): string {
  return statuses
    .map(
      (status) =>
        OCCUPATION_STATUS_OPTIONS.find(({ id }) => id === status)?.label ??
        status
    )
    .join(", ");
}

export function formatHeardFromStored(storedValues: readonly string[]): string {
  return storedValues
    .map((stored) => {
      if (stored.startsWith("other:")) {
        const detail = stored.slice(6).trim();
        return detail.length > 0 ? `Otro: ${detail}` : "Otro";
      }
      if (stored === "instagram") {
        return "Instagram";
      }
      const row = HEARD_FROM_OPTIONS.find((option) => option.id === stored);
      return row?.label ?? stored;
    })
    .join(", ");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROTOCOL_FULL_URI_START_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const HOSTNAME_CHARS_ONLY_RE = /^[a-z0-9.-]+$/i;
const TRAILING_SLASH_RE = /\/$/;
const LEADING_SLASHES_RE = /^\/+/;
const HANDLE_TERM_BOUNDARY_RE = /[/?#\s]/;
const FIRST_WHITESPACE_CHUNK_RE = /\s/;
const URL_SCHEME_PREFIX_RE = /^[a-z][a-z0-9+.-]*:/i;
const DUPLICATE_SLASHES_RE = /\/{2,}/g;
const TRAILING_SLASHES_ON_PATH_RE = /\/+$/;
const WWW_HOSTNAME_PREFIX_RE = /^www\./;
const LINE_BREAK_SPLIT_RE = /\r?\n/;

export type SocialKind = "x" | "linkedin" | "github" | "web";

function baseHostForProfileField(kind: Exclude<SocialKind, "web">): string {
  switch (kind) {
    case "x": {
      return "x.com";
    }
    case "linkedin": {
      return "linkedin.com";
    }
    case "github": {
      return "github.com";
    }
    default: {
      throw new Error(`unexpected profile host kind: ${String(kind)}`);
    }
  }
}

function expandProfileFieldInput(raw: string, baseHost: string): string {
  const v = raw.trim();
  if (!v) {
    return "";
  }
  if (PROTOCOL_FULL_URI_START_RE.test(v) || v.startsWith("//")) {
    return v;
  }
  if (v.startsWith("@")) {
    return v;
  }

  const slash = v.indexOf("/");
  const firstSegment = slash === -1 ? v : v.slice(0, slash);
  const firstLower = firstSegment.toLowerCase();
  const looksLikeHostname =
    firstLower.includes(".") &&
    HOSTNAME_CHARS_ONLY_RE.test(firstLower) &&
    !firstLower.startsWith(".");

  if (looksLikeHostname) {
    return `https://${v.replace(LEADING_SLASHES_RE, "")}`;
  }

  const host = baseHost.replace(TRAILING_SLASH_RE, "");
  const rest = v.replace(LEADING_SLASHES_RE, "");
  const hl = host.toLowerCase();
  const rl = rest.toLowerCase();
  if (rl === hl || rl.startsWith(`${hl}/`)) {
    return `https://${rest}`;
  }
  if (host === "linkedin.com" && rl.length > 0) {
    const linkedinPathPrefixes = [
      "in/",
      "company/",
      "school/",
      "showcase/",
      "pulse/",
    ];
    if (!linkedinPathPrefixes.some((p) => rl.startsWith(p))) {
      return `https://${host}/in/${rest}`;
    }
  }
  return `https://${host}/${rest}`;
}

const TWITTER_HOSTS = new Set([
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "m.twitter.com",
  "mobile.x.com",
]);

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

function isProfileHost(host: string): boolean {
  return (
    host === "x.com" ||
    host === "linkedin.com" ||
    host.endsWith(".linkedin.com") ||
    host === "github.com" ||
    host === "gist.github.com" ||
    host.endsWith(".github.io")
  );
}

function hostMatchesKind(host: string, kind: SocialKind): boolean {
  switch (kind) {
    case "x": {
      return host === "x.com";
    }
    case "linkedin": {
      return host === "linkedin.com" || host.endsWith(".linkedin.com");
    }
    case "github": {
      return (
        host === "github.com" ||
        host === "gist.github.com" ||
        host.endsWith(".github.io")
      );
    }
    case "web": {
      return host.length > 0;
    }
    default: {
      return false;
    }
  }
}

export function normalizeSocialUrl(input: string, kind: SocialKind): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (kind === "x") {
    if (trimmed.startsWith("@")) {
      const handle =
        trimmed
          .slice(1)
          .split(HANDLE_TERM_BOUNDARY_RE)[0]
          ?.replace(LEADING_SLASHES_RE, "") ?? "";
      if (!handle) {
        return "";
      }
      return `https://x.com/${handle}`;
    }
    if (
      !(
        trimmed.includes("://") ||
        trimmed.includes("/") ||
        trimmed.includes(".")
      )
    ) {
      const h = trimmed.split(FIRST_WHITESPACE_CHUNK_RE)[0] ?? "";
      if (h.length > 0) {
        return `https://x.com/${h}`;
      }
    }
  }

  let s = trimmed;
  if (!URL_SCHEME_PREFIX_RE.test(s)) {
    s = s.startsWith("//")
      ? `https:${s}`
      : `https://${s.replace(LEADING_SLASHES_RE, "")}`;
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "";
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return "";
  }

  let host = u.hostname.toLowerCase();
  host = stripWww(host);

  if (TWITTER_HOSTS.has(host)) {
    host = "x.com";
  }

  let path = u.pathname || "/";
  path = path.replace(DUPLICATE_SLASHES_RE, "/");
  if (path.length > 1) {
    path = path.replace(TRAILING_SLASHES_ON_PATH_RE, "");
  }

  const search = kind === "web" && !isProfileHost(host) ? u.search : "";

  if (!hostMatchesKind(host, kind)) {
    return "";
  }

  const out = `https://${host}${path}${search}`;
  return out.length > SIGNUP_MAX.url ? "" : out;
}

export type ProfileFieldKind = Exclude<SocialKind, "web">;

function profileNormalizedToInputSuffix(
  norm: string,
  kind: ProfileFieldKind
): string {
  if (!norm) {
    return "";
  }
  let u: URL;
  try {
    u = new URL(norm);
  } catch {
    return "";
  }
  let path = u.pathname || "/";
  path = path.replace(DUPLICATE_SLASHES_RE, "/");
  if (path.length > 1) {
    path = path.replace(TRAILING_SLASHES_ON_PATH_RE, "");
  }
  const tail = path.startsWith("/") ? path.slice(1) : path;
  const h = u.hostname.toLowerCase().replace(WWW_HOSTNAME_PREFIX_RE, "");

  if (kind === "github" && h.endsWith(".github.io")) {
    return tail ? `${h}/${tail}` : h;
  }
  if (kind === "linkedin") {
    const tl = tail.toLowerCase();
    if (tl.startsWith("in/")) {
      return tail.slice(3).replace(LEADING_SLASHES_RE, "");
    }
  }
  return tail;
}

export function cleanProfilePasteText(
  raw: string,
  kind: ProfileFieldKind
): string {
  const line =
    raw
      .split(LINE_BREAK_SPLIT_RE)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  if (!line) {
    return "";
  }
  const expanded = expandProfileFieldInput(line, baseHostForProfileField(kind));
  const norm = normalizeSocialUrl(expanded, kind);
  if (!norm) {
    return line;
  }
  return profileNormalizedToInputSuffix(norm, kind);
}

function socialField(kind: SocialKind) {
  return z
    .string()
    .max(SIGNUP_MAX.url)
    .transform((raw, ctx) => {
      const trimmed = raw.trim();
      const expanded =
        kind === "web"
          ? trimmed
          : expandProfileFieldInput(trimmed, baseHostForProfileField(kind));
      const norm = normalizeSocialUrl(expanded, kind);
      if (trimmed.length > 0 && norm.length === 0) {
        ctx.addIssue({
          code: "custom",
          input: trimmed,
          message: "invalid_social_url",
        });
      }
      return norm;
    });
}

const referralCodeField = z.preprocess(
  (v) => (typeof v === "string" ? v : ""),
  z.string().transform((s) => normalizeReferralCode(s) ?? "")
);

const signupBodySchema = z
  .object({
    achievements: z
      .string()
      .max(SIGNUP_MAX.longText)
      .transform((s) => s.trim()),
    ambassadorMotivation: z
      .string()
      .max(SIGNUP_MAX.longText)
      .transform((s) => s.trim()),
    dietaryDataConsent: z.boolean().optional().default(false),
    dietaryDetails: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z
        .string()
        .max(SIGNUP_MAX.longText)
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
      .max(SIGNUP_MAX.email)
      .transform((s) => s.trim().toLowerCase())
      .refine((s) => EMAIL_RE.test(s), { message: "invalid_email" }),
    employer: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z
        .string()
        .max(SIGNUP_MAX.name)
        .transform((value) => value.trim())
    ),
    freeTime: z
      .string()
      .max(SIGNUP_MAX.longText)
      .transform((s) => s.trim()),
    fullName: z
      .string()
      .max(SIGNUP_MAX.name)
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, { message: "fullName_required" }),
    githubUrl: socialField("github"),
    heardFromOther: z.preprocess(
      (v) => (typeof v === "string" ? v : ""),
      z
        .string()
        .max(SIGNUP_MAX.heardFromOther)
        .transform((s) => s.trim())
    ),
    heardFromSources: z.preprocess(
      (value) => (Array.isArray(value) ? value : []),
      z
        .array(z.enum(HEARD_FROM_SOURCE_IDS))
        .min(1, { message: "heard_from_required" })
        .max(HEARD_FROM_SOURCE_IDS.length)
        .transform((values) => [...new Set(values)])
    ),
    invitationToken: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z
        .string()
        .max(64)
        .refine((value) => value === "" || UUID_RE.test(value), {
          message: "invalid_invitation",
        })
    ),
    isUnderThirty: z.boolean().optional().default(false),
    linkedinUrl: socialField("linkedin"),
    occupationStatuses: z.preprocess(
      (value) => (Array.isArray(value) ? value : []),
      z
        .array(z.enum(OCCUPATION_STATUS_IDS))
        .max(OCCUPATION_STATUS_IDS.length)
        .transform((values) => [...new Set(values)])
    ),
    referralCode: referralCodeField,
    signupAccessKey: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z.string().max(256)
    ),
    studyInstitution: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z
        .string()
        .max(SIGNUP_MAX.name)
        .transform((value) => value.trim())
    ),
    wantsAmbassador: z.boolean().optional().default(false),
    webUrl: socialField("web"),
    xUrl: socialField("x"),
  })
  .superRefine((data, ctx) => {
    const has =
      data.xUrl.length > 0 ||
      data.linkedinUrl.length > 0 ||
      data.githubUrl.length > 0 ||
      data.webUrl.length > 0;
    if (!has) {
      ctx.addIssue({
        code: "custom",
        message: "social_required",
        path: ["xUrl"],
      });
    }
    if (data.wantsAmbassador && data.ambassadorMotivation.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "ambassador_motivation_required",
        path: ["ambassadorMotivation"],
      });
    }
    const hasDietaryData =
      data.dietaryRestrictions.length > 0 || data.dietaryDetails.length > 0;
    if (hasDietaryData && !data.dietaryDataConsent) {
      ctx.addIssue({
        code: "custom",
        message: "dietary_consent_required",
        path: ["dietaryDataConsent"],
      });
    }
    if (!data.isUnderThirty) {
      ctx.addIssue({
        code: "custom",
        message: "under_thirty_required",
        path: ["isUnderThirty"],
      });
    }
    if (
      data.occupationStatuses.includes("student") &&
      data.studyInstitution.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "study_institution_required",
        path: ["studyInstitution"],
      });
    }
    if (
      data.occupationStatuses.includes("working") &&
      data.employer.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "employer_required",
        path: ["employer"],
      });
    }
    if (
      data.heardFromSources.includes("other") &&
      data.heardFromOther.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "heard_from_other_required",
        path: ["heardFromOther"],
      });
    }
  })
  .transform(({ heardFromSources, heardFromOther, ...rest }) => {
    const heardFrom = heardFromSources.map((source) =>
      source === "other" ? `other:${heardFromOther.trim()}` : source
    );
    return { ...rest, heardFrom };
  });

export type SignupBodyParsed = z.infer<typeof signupBodySchema>;

export function parseSignupBody(
  body: unknown
):
  | { ok: true; data: SignupBodyParsed }
  | { ok: false; error: string; status: number } {
  const r = signupBodySchema.safeParse(body);
  if (r.success) {
    return { data: r.data, ok: true };
  }
  const { issues } = r.error;
  const first = issues[0];
  const msg = first?.message ?? "validation_error";
  if (msg === "social_required") {
    return { error: "social_required", ok: false, status: 400 };
  }
  if (msg === "invalid_social_url") {
    return { error: "invalid_social_url", ok: false, status: 400 };
  }
  if (msg === "invalid_email") {
    return { error: "invalid_email", ok: false, status: 400 };
  }
  if (msg === "fullName_required") {
    return { error: "fullName_required", ok: false, status: 400 };
  }
  if (msg === "study_institution_required") {
    return { error: "study_institution_required", ok: false, status: 400 };
  }
  if (msg === "employer_required") {
    return { error: "employer_required", ok: false, status: 400 };
  }
  if (msg === "dietary_consent_required") {
    return { error: "dietary_consent_required", ok: false, status: 400 };
  }
  if (msg === "under_thirty_required") {
    return { error: "under_thirty_required", ok: false, status: 400 };
  }
  if (msg === "heard_from_required" || msg === "heard_from_invalid") {
    return { error: "heard_from_required", ok: false, status: 400 };
  }
  if (msg === "ambassador_motivation_required") {
    return { error: "ambassador_motivation_required", ok: false, status: 400 };
  }
  if (msg === "heard_from_other_required") {
    return { error: "heard_from_other_required", ok: false, status: 400 };
  }
  if (msg === "invalid_invitation") {
    return { error: "invalid_invitation", ok: false, status: 400 };
  }
  return { error: "invalid_request", ok: false, status: 400 };
}

export function parseSignupBodyClient(body: unknown):
  | { ok: true; data: SignupBodyParsed }
  | {
      ok: false;
      code:
        | "social_required"
        | "invalid_social_url"
        | "invalid_email"
        | "fullName"
        | "study_institution"
        | "employer"
        | "dietary_consent"
        | "under_thirty"
        | "ambassador_motivation"
        | "heard_from"
        | "heard_from_other"
        | "generic";
    } {
  const r = signupBodySchema.safeParse(body);
  if (r.success) {
    return { data: r.data, ok: true };
  }
  const msg = r.error.issues[0]?.message;
  if (msg === "social_required") {
    return { code: "social_required", ok: false };
  }
  if (msg === "invalid_social_url") {
    return { code: "invalid_social_url", ok: false };
  }
  if (msg === "invalid_email") {
    return { code: "invalid_email", ok: false };
  }
  if (msg === "fullName_required") {
    return { code: "fullName", ok: false };
  }
  if (msg === "study_institution_required") {
    return { code: "study_institution", ok: false };
  }
  if (msg === "employer_required") {
    return { code: "employer", ok: false };
  }
  if (msg === "dietary_consent_required") {
    return { code: "dietary_consent", ok: false };
  }
  if (msg === "under_thirty_required") {
    return { code: "under_thirty", ok: false };
  }
  if (msg === "heard_from_required" || msg === "heard_from_invalid") {
    return { code: "heard_from", ok: false };
  }
  if (msg === "ambassador_motivation_required") {
    return { code: "ambassador_motivation", ok: false };
  }
  if (msg === "heard_from_other_required") {
    return { code: "heard_from_other", ok: false };
  }
  return { code: "generic", ok: false };
}
