import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { api as AppApi } from "../../../app/convex/_generated/api";
import { VERSION } from "../version";
import type { RefreshFn, Tokens } from "./auth-store";
import { currentToken } from "./auth-store";
import type { UrlSource } from "./config";
import { resolveAppUrl } from "./config";
import type { CliContext } from "./context";
import { authError, CliError, EXIT, RemoteError } from "./errors";

/**
 * The CLI never talks to Convex. Every call goes to the dashboard's
 * /api/cli/* routes, which run the allowlisted Convex function server-side
 * with the participant's own session. `api.teams.join` is typed from the
 * generated Convex API but at runtime is just `{ name: "teams:join" }`.
 */
type Ref = { name: string };

function moduleProxy(module: string): unknown {
  return new Proxy(
    {},
    {
      get: (_target, fn): Ref => ({ name: `${module}:${String(fn)}` }),
    }
  );
}

export const api = new Proxy(
  {},
  {
    get: (_target, module) => moduleProxy(String(module)),
  }
) as unknown as typeof AppApi;

export function functionName(ref: unknown): string {
  const name = (ref as Ref | undefined)?.name;
  if (typeof name !== "string") {
    throw new CliError("Invalid function reference");
  }
  return name;
}

/** Response envelope produced by apps/app/src/app/api/cli/_lib/respond.ts. */
type Envelope =
  | { ok: true; value: unknown }
  | { ok: false; error: { kind: "convex"; data: unknown } }
  | { ok: false; error: { kind: "error"; message: string } };

export type FetchLike = typeof fetch;

type PostResult<T> =
  | { status: number; value: T; error?: never }
  | { status: number; error: Error; value?: never };
const REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(value: unknown): Envelope | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.ok === true && "value" in value) {
    return { ok: true, value: value.value };
  }
  if (value.ok !== false || !isRecord(value.error)) {
    return null;
  }
  if (value.error.kind === "convex" && "data" in value.error) {
    return { ok: false, error: { kind: "convex", data: value.error.data } };
  }
  if (value.error.kind === "error" && typeof value.error.message === "string") {
    return {
      ok: false,
      error: { kind: "error", message: value.error.message },
    };
  }
  return null;
}

function invalidResponse(url: string, status?: number): CliError {
  return new CliError(
    status === undefined
      ? `Server returned an invalid response from ${url}.`
      : `Server answered ${status} with an invalid response from ${url}.`,
    {
      code: "SERVER",
      hint: `Is ${url} the dashboard? Pass --url if you are targeting a dev server.`,
    }
  );
}

function isTokens(value: unknown): value is Tokens {
  return (
    isRecord(value) &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.refreshToken === "string" &&
    value.refreshToken.length > 0
  );
}

function tokensFrom(value: unknown, url: string): Tokens | null {
  if (!(isRecord(value) && "tokens" in value)) {
    throw invalidResponse(url);
  }
  if (value.tokens === null || isTokens(value.tokens)) {
    return value.tokens;
  }
  throw invalidResponse(url);
}

function networkFailure<T>(url: string): PostResult<T> {
  return {
    error: new CliError("Could not reach the HackSpain server.", {
      code: "NETWORK",
      hint: `Tried ${url}. Check your connection, or pass --url for a dev server.`,
      exitCode: EXIT.NETWORK,
    }),
    status: 0,
  };
}

async function post<T>(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  token?: string | null
): Promise<PostResult<T>> {
  let response: Response;
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    response = await fetchImpl(url, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "user-agent": `hackspain-cli/${VERSION}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      method: "POST",
      signal,
    });
  } catch {
    return networkFailure<T>(url);
  }
  let envelope: Envelope | null = null;
  try {
    envelope = parseEnvelope(await response.json());
  } catch {
    if (signal.aborted) {
      return networkFailure<T>(url);
    }
    envelope = null;
  }
  if (!envelope || envelope.ok !== response.ok) {
    return {
      error: invalidResponse(url, response.status),
      status: response.status,
    };
  }
  if (envelope.ok) {
    return { status: response.status, value: envelope.value as T };
  }
  if (envelope.error.kind === "convex") {
    return {
      error: new RemoteError(envelope.error.data),
      status: response.status,
    };
  }
  return { error: new Error(envelope.error.message), status: response.status };
}

function unwrap<T>(result: PostResult<T>): T {
  if (result.error) {
    throw result.error;
  }
  return result.value;
}

export type Client = {
  query<Q extends FunctionReference<"query">>(
    ref: Q,
    args: FunctionArgs<Q>
  ): Promise<FunctionReturnType<Q>>;
  mutation<M extends FunctionReference<"mutation">>(
    ref: M,
    args: FunctionArgs<M>
  ): Promise<FunctionReturnType<M>>;
  action<A extends FunctionReference<"action">>(
    ref: A,
    args: FunctionArgs<A>
  ): Promise<FunctionReturnType<A>>;
};

export type TokenProvider = (force?: boolean) => Promise<string | null>;

/**
 * Calls /api/cli/rpc with the current token; on 401 refreshes once (under
 * the credentials lock) and retries, mirroring what the browser client does.
 */
export function createClient(
  url: string,
  token: TokenProvider,
  fetchImpl: FetchLike = fetch
): Client {
  const call = async <T>(ref: unknown, args: unknown): Promise<T> => {
    const name = functionName(ref);
    const endpoint = `${url}/api/cli/rpc`;
    let bearer = await token();
    let result = await post<T>(fetchImpl, endpoint, { args, name }, bearer);
    if (result.status === 401 && bearer) {
      bearer = await token(true);
      if (bearer) {
        result = await post<T>(fetchImpl, endpoint, { args, name }, bearer);
      }
    }
    return unwrap(result);
  };
  return { action: call, mutation: call, query: call };
}

export type Session = {
  url: string;
  urlSource: UrlSource;
  client: Client;
  authenticated: boolean;
  /** Fresh bearer token for out-of-band calls such as the telemetry upload. */
  token: TokenProvider;
};

export function makeRefresh(
  url: string,
  fetchImpl: FetchLike = fetch
): RefreshFn {
  return async (refreshToken) => {
    const endpoint = `${url}/api/cli/auth/refresh`;
    const value = unwrap(
      await post<unknown>(fetchImpl, endpoint, { refreshToken })
    );
    return tokensFrom(value, endpoint);
  };
}

export async function authStart(
  url: string,
  email: string,
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  const endpoint = `${url}/api/cli/auth/start`;
  const value = unwrap(await post<unknown>(fetchImpl, endpoint, { email }));
  if (!isRecord(value) || typeof value.started !== "boolean") {
    throw invalidResponse(endpoint);
  }
  return value.started;
}

export async function authVerify(
  url: string,
  email: string,
  code: string,
  fetchImpl: FetchLike = fetch
): Promise<Tokens | null> {
  const endpoint = `${url}/api/cli/auth/verify`;
  const value = unwrap(
    await post<unknown>(fetchImpl, endpoint, { code, email })
  );
  return tokensFrom(value, endpoint);
}

/**
 * Start a browser (device-code) login. The CLI keeps `secret` to itself;
 * the returned short-lived `code` goes into the /cli-auth URL the user
 * approves in the dashboard.
 */
export async function deviceStart(
  url: string,
  secret: string,
  fetchImpl: FetchLike = fetch
): Promise<{ code: string; expiresAt: number }> {
  const endpoint = `${url}/api/cli/auth/device/start`;
  const value = unwrap(await post<unknown>(fetchImpl, endpoint, { secret }));
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt)
  ) {
    throw invalidResponse(endpoint);
  }
  return { code: value.code, expiresAt: value.expiresAt };
}

export type DevicePoll =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "approved"; tokens: Tokens; email: string | null };

/** One poll of the browser login. "approved" comes back exactly once. */
export async function devicePoll(
  url: string,
  code: string,
  secret: string,
  fetchImpl: FetchLike = fetch
): Promise<DevicePoll> {
  const endpoint = `${url}/api/cli/auth/device/poll`;
  const value = unwrap(
    await post<unknown>(fetchImpl, endpoint, {
      code,
      secret,
    })
  );
  if (!isRecord(value)) {
    throw invalidResponse(endpoint);
  }
  if (value.status === "pending" || value.status === "expired") {
    return { status: value.status };
  }
  if (
    value.status === "approved" &&
    isTokens(value.tokens) &&
    (value.email === null || typeof value.email === "string")
  ) {
    return { status: "approved", tokens: value.tokens, email: value.email };
  }
  throw invalidResponse(endpoint);
}

export async function authSignOut(
  url: string,
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  const endpoint = `${url}/api/cli/auth/signout`;
  const value = unwrap(await post<unknown>(fetchImpl, endpoint, {}, token));
  if (!isRecord(value) || value.signedOut !== true) {
    throw invalidResponse(endpoint);
  }
}

/**
 * Upload an image for a feed post through /api/cli/upload. Returns the
 * storage id to pass to feed:post.
 */
export async function uploadImage(
  session: Session,
  bytes: Uint8Array,
  contentType: string,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const bearer = await session.token();
  let response: Response;
  try {
    response = await fetchImpl(`${session.url}/api/cli/upload`, {
      body: new Blob([Buffer.from(bytes)], {
        type: contentType,
      }),
      headers: {
        "content-type": contentType,
        "user-agent": `hackspain-cli/${VERSION}`,
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      method: "POST",
    });
  } catch {
    throw new CliError("Could not reach the HackSpain server.", {
      code: "NETWORK",
      exitCode: EXIT.NETWORK,
    });
  }
  const endpoint = `${session.url}/api/cli/upload`;
  const envelope = parseEnvelope(await response.json().catch(() => null));
  if (!envelope || envelope.ok !== response.ok) {
    throw invalidResponse(endpoint, response.status);
  }
  if (!envelope.ok) {
    throw envelope.error.kind === "convex"
      ? new RemoteError(envelope.error.data)
      : new Error(envelope.error.message);
  }
  if (
    !isRecord(envelope.value) ||
    typeof envelope.value.imageId !== "string" ||
    envelope.value.imageId.length === 0
  ) {
    throw invalidResponse(endpoint, response.status);
  }
  return envelope.value.imageId;
}

const IMAGE_TIMEOUT_MS = 8000;

/**
 * Fetch a feed image as a PNG resized to `width` px through
 * `/api/files/<id>?w=`, with the session's bearer token. Best effort: any
 * failure returns null and the caller prints the link instead. Retries once
 * with a refreshed token on 401, like the rpc client.
 */
export async function fetchImage(
  session: Session,
  imagePath: string,
  width: number,
  fetchImpl: FetchLike = fetch
): Promise<Uint8Array | null> {
  const url = new URL(imagePath, session.url);
  url.searchParams.set("w", String(width));
  const attempt = async (bearer: string | null): Promise<Response | null> => {
    try {
      return await fetchImpl(url, {
        headers: {
          accept: "image/png",
          "user-agent": `hackspain-cli/${VERSION}`,
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
        redirect: "manual",
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  };
  let response = await attempt(await session.token());
  if (response?.status === 401) {
    response = await attempt(await session.token(true));
  }
  if (
    !(
      response?.ok &&
      (response.headers.get("content-type") ?? "").startsWith("image/png")
    )
  ) {
    return null;
  }
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Open a session against the dashboard. With `requireAuth` a missing or
 * expired session is a hard error; otherwise calls go out anonymously.
 */
export async function openSession(
  ctx: CliContext,
  options: { requireAuth?: boolean } = {}
): Promise<Session> {
  const { url, source } = resolveAppUrl(ctx.urlOverride);
  const refresh = makeRefresh(url);
  const token: TokenProvider = (force = false) =>
    currentToken(url, refresh, { force });
  const initial = await token();
  if (options.requireAuth && !initial) {
    throw authError();
  }
  return {
    authenticated: Boolean(initial),
    client: createClient(url, token),
    token,
    url,
    urlSource: source,
  };
}
