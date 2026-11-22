import { envFromRuntime } from "./runtime-env";

const SECRET_HEADER = "x-hackspain-secret";

type ConfirmState = "confirm" | "confirmed" | "invalid" | "not_accepted";
type CancelState = "already_cancelled" | "cancelled" | "confirm" | "invalid";

export interface ConfirmView {
  fullName: string;
  githubHandle: string | null;
  photoDataUri: string | null;
  photoVersion: number | null;
  state: ConfirmState;
}

export interface CancelView {
  fullName: string;
  state: CancelState;
}

export interface SharedBadge {
  fullName: string;
  githubHandle: string | null;
  photoDataUri: string | null;
  photoVersion: number | null;
}

export interface ApplyInput {
  achievements?: string;
  ambassadorMotivation?: string;
  ambassadorStudyWhere?: string;
  dietaryDetails?: string;
  dietaryRestrictions?: string;
  email: string;
  freeTime?: string;
  fullName: string;
  githubUrl?: string;
  linkedinUrl?: string;
  roleSlug: string;
  wantsAmbassador?: boolean;
  webUrl?: string;
  xUrl?: string;
}

const TRAILING_SLASH_RE = /\/$/;
const CONVEX_CLOUD_RE = /\.convex\.cloud$/;

function toSiteUrl(convexUrl: string): string {
  return convexUrl
    .replace(TRAILING_SLASH_RE, "")
    .replace(CONVEX_CLOUD_RE, ".convex.site");
}

function landingConfig(): { secret: string; siteUrl: string } | null {
  const convexUrl = envFromRuntime("CONVEX_URL");
  const secret = envFromRuntime("SUBSCRIBE_SECRET");
  if (!(convexUrl && secret)) {
    return null;
  }
  return { secret, siteUrl: toSiteUrl(convexUrl) };
}

class LandingRequestError extends Error {
  readonly error: string;
  readonly status: number;

  constructor(error: string, status: number) {
    super(error);
    this.name = "LandingRequestError";
    this.error = error;
    this.status = status;
  }
}

async function landingFetch(
  path: string,
  init: RequestInit
): Promise<Response> {
  const config = landingConfig();
  if (!config) {
    throw new LandingRequestError("save_failed", 500);
  }
  return await fetch(`${config.siteUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      [SECRET_HEADER]: config.secret,
    },
    signal: AbortSignal.timeout(10_000),
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LandingRequestError("save_failed", 500);
  }
}

function errorCode(body: unknown): string {
  return isRecord(body) && typeof body.error === "string"
    ? body.error
    : "save_failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfirmView(value: unknown): value is ConfirmView {
  return (
    isRecord(value) &&
    typeof value.fullName === "string" &&
    typeof value.state === "string"
  );
}

function isCancelView(value: unknown): value is CancelView {
  return (
    isRecord(value) &&
    typeof value.fullName === "string" &&
    typeof value.state === "string"
  );
}

function isSharedBadge(value: unknown): value is SharedBadge {
  return isRecord(value) && typeof value.fullName === "string";
}

export async function subscribeEmail(email: string): Promise<void> {
  const response = await landingFetch("/landing/subscribe", {
    body: JSON.stringify({ email }),
    method: "POST",
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new LandingRequestError(errorCode(body), response.status);
  }
}

export async function applyParticipation(input: ApplyInput): Promise<void> {
  const response = await landingFetch("/landing/apply", {
    body: JSON.stringify(input),
    method: "POST",
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new LandingRequestError(errorCode(body), response.status);
  }
}

export function isLandingRequestError(
  error: unknown
): error is LandingRequestError {
  return error instanceof LandingRequestError;
}

const INVALID_CONFIRMATION: ConfirmView = {
  fullName: "",
  githubHandle: null,
  photoDataUri: null,
  photoVersion: null,
  state: "invalid",
};

const INVALID_CANCELLATION: CancelView = { fullName: "", state: "invalid" };

async function landingView<T>(
  path: string,
  init: RequestInit,
  parse: (body: unknown) => T,
  fallback: T
): Promise<T> {
  try {
    const response = await landingFetch(path, init);
    const body = await readJson(response);
    if (!response.ok) {
      return fallback;
    }
    return parse(body);
  } catch {
    return fallback;
  }
}

function confirmViewFrom(body: unknown): ConfirmView {
  if (!isConfirmView(body)) {
    return INVALID_CONFIRMATION;
  }
  return {
    fullName: body.fullName,
    githubHandle:
      typeof body.githubHandle === "string" ? body.githubHandle : null,
    photoDataUri:
      typeof body.photoDataUri === "string" ? body.photoDataUri : null,
    photoVersion:
      typeof body.photoVersion === "number" ? body.photoVersion : null,
    state: body.state,
  };
}

function cancelViewFrom(body: unknown): CancelView {
  if (!isCancelView(body)) {
    return INVALID_CANCELLATION;
  }
  return { fullName: body.fullName, state: body.state };
}

export async function lookupConfirmation(token: string): Promise<ConfirmView> {
  return await landingView(
    `/landing/confirm?token=${encodeURIComponent(token)}`,
    { method: "GET" },
    confirmViewFrom,
    INVALID_CONFIRMATION
  );
}

export async function confirmParticipation(
  token: string
): Promise<ConfirmView> {
  return await landingView(
    "/landing/confirm",
    { body: JSON.stringify({ token }), method: "POST" },
    confirmViewFrom,
    INVALID_CONFIRMATION
  );
}

export async function lookupCancellation(token: string): Promise<CancelView> {
  return await landingView(
    `/landing/cancel?token=${encodeURIComponent(token)}`,
    { method: "GET" },
    cancelViewFrom,
    INVALID_CANCELLATION
  );
}

export async function cancelParticipation(token: string): Promise<CancelView> {
  return await landingView(
    "/landing/cancel",
    { body: JSON.stringify({ token }), method: "POST" },
    cancelViewFrom,
    INVALID_CANCELLATION
  );
}

export async function requestCancellationLink(email: string): Promise<void> {
  try {
    await landingFetch("/landing/cancel/request", {
      body: JSON.stringify({ email }),
      method: "POST",
    });
  } catch {
    // Same submitted copy whether the email exists.
  }
}

export async function saveBadgePhoto(
  token: string,
  photo: string
): Promise<{ version: number | null }> {
  const response = await landingFetch("/landing/badge-photo", {
    body: JSON.stringify({ photo, token }),
    method: "POST",
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new LandingRequestError(errorCode(body), response.status);
  }
  const version =
    isRecord(body) && typeof body.version === "number" ? body.version : null;
  return { version };
}

export async function findSharedBadge(input: {
  fullName: string;
  githubHandle: string | null;
}): Promise<SharedBadge | null> {
  const params = new URLSearchParams({ name: input.fullName });
  if (input.githubHandle) {
    params.set("github", input.githubHandle);
  }
  try {
    const response = await landingFetch(`/landing/share?${params.toString()}`, {
      method: "GET",
    });
    if (!response.ok) {
      return null;
    }
    const body = await readJson(response);
    if (body === null || !isSharedBadge(body)) {
      return null;
    }
    return {
      fullName: body.fullName,
      githubHandle:
        typeof body.githubHandle === "string" ? body.githubHandle : null,
      photoDataUri:
        typeof body.photoDataUri === "string" ? body.photoDataUri : null,
      photoVersion:
        typeof body.photoVersion === "number" ? body.photoVersion : null,
    };
  } catch {
    return null;
  }
}
