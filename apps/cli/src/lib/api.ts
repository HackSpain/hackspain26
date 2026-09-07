import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { api as AppApi } from "../../../app/convex/_generated/api";
import { VERSION } from "../version";
import { currentToken, type RefreshFn, type Tokens } from "./auth-store";
import { resolveAppUrl, type UrlSource } from "./config";
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
type Envelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { kind: "convex"; data: unknown } }
  | { ok: false; error: { kind: "error"; message: string } };

export type FetchLike = typeof fetch;

type PostResult<T> = { status: number; value?: T; error?: Error };

async function post<T>(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  token?: string | null
): Promise<PostResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": `hackspain-cli/${VERSION}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: 0,
      error: new CliError("Could not reach the HackSpain server.", {
        code: "NETWORK",
        hint: `Tried ${url}. Check your connection, or pass --url for a dev server.`,
        exitCode: EXIT.NETWORK,
      }),
    };
  }
  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    envelope = null;
  }
  if (!envelope) {
    return {
      status: response.status,
      error: new CliError(
        `Server answered ${response.status} without a JSON body.`,
        {
          code: "SERVER",
          hint: `Is ${url} the dashboard? Pass --url if you are targeting a dev server.`,
        }
      ),
    };
  }
  if (envelope.ok) {
    return { status: response.status, value: envelope.value };
  }
  if (envelope.error.kind === "convex") {
    return {
      status: response.status,
      error: new RemoteError(envelope.error.data),
    };
  }
  return { status: response.status, error: new Error(envelope.error.message) };
}

function unwrap<T>(result: PostResult<T>): T {
  if (result.error) {
    throw result.error;
  }
  return result.value as T;
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
    let result = await post<T>(fetchImpl, endpoint, { name, args }, bearer);
    if (result.status === 401 && bearer) {
      bearer = await token(true);
      if (bearer) {
        result = await post<T>(fetchImpl, endpoint, { name, args }, bearer);
      }
    }
    return unwrap(result);
  };
  return { query: call, mutation: call, action: call };
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
  return async (refreshToken) =>
    unwrap(
      await post<{ tokens: Tokens | null }>(
        fetchImpl,
        `${url}/api/cli/auth/refresh`,
        { refreshToken }
      )
    ).tokens ?? null;
}

export async function authStart(
  url: string,
  email: string,
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  return Boolean(
    unwrap(
      await post<{ started: boolean }>(fetchImpl, `${url}/api/cli/auth/start`, {
        email,
      })
    ).started
  );
}

export async function authVerify(
  url: string,
  email: string,
  code: string,
  fetchImpl: FetchLike = fetch
): Promise<Tokens | null> {
  return (
    unwrap(
      await post<{ tokens: Tokens | null }>(
        fetchImpl,
        `${url}/api/cli/auth/verify`,
        { email, code }
      )
    ).tokens ?? null
  );
}

export async function authSignOut(
  url: string,
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  unwrap(await post(fetchImpl, `${url}/api/cli/auth/signout`, {}, token));
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
    url,
    urlSource: source,
    client: createClient(url, token),
    authenticated: Boolean(initial),
    token,
  };
}
