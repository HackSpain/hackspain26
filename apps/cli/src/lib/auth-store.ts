import { closeSync, openSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { configDir, ensureDir, readJsonFile, writeFileAtomic } from "./config";
import { CliError, EXIT } from "./errors";

export type Credentials = {
  version: 1;
  appUrl: string;
  email: string;
  token: string;
  refreshToken: string;
  tokenExpiresAt: number;
  updatedAt: number;
};

export type Tokens = { token: string; refreshToken: string };

/** Refresh this long before the JWT expires (JWTs last 1 h by default). */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** A token written this recently by another process is trusted as-is. */
const JUST_REFRESHED_MS = 20 * 1000;
const LOCK_WAIT_MS = 15 * 1000;
const LOCK_STALE_MS = 30 * 1000;
const LOCK_POLL_MS = 100;

export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

function lockPath(): string {
  return join(configDir(), "credentials.lock");
}

export function readCredentials(): Credentials | null {
  const creds = readJsonFile<Credentials>(credentialsPath());
  if (!creds || creds.version !== 1) {
    return null;
  }
  if (
    typeof creds.token !== "string" ||
    typeof creds.refreshToken !== "string" ||
    typeof creds.appUrl !== "string"
  ) {
    return null;
  }
  return creds;
}

export function writeCredentials(creds: Credentials): void {
  ensureDir(configDir(), 0o700);
  writeFileAtomic(
    credentialsPath(),
    `${JSON.stringify(creds, null, 2)}\n`,
    0o600
  );
}

export function clearCredentials(): void {
  try {
    unlinkSync(credentialsPath());
  } catch {
    // Already gone.
  }
}

/** Expiry (epoch ms) from a JWT's `exp` claim, without verifying it. */
export function decodeJwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const exp: unknown = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function credentialsFromTokens(
  tokens: Tokens,
  appUrl: string,
  email: string
): Credentials {
  return {
    version: 1,
    appUrl,
    email,
    token: tokens.token,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt:
      decodeJwtExpiry(tokens.token) ?? Date.now() + 55 * 60 * 1000,
    updatedAt: Date.now(),
  };
}

export function isFresh(creds: Credentials, now = Date.now()): boolean {
  return creds.tokenExpiresAt - now > REFRESH_MARGIN_MS;
}

/**
 * Cross-process mutex around the credential file. Convex Auth refresh tokens
 * rotate, and reusing an old one outside a 10 s window invalidates the whole
 * session, so the CLI and the watcher must never race a refresh.
 */
export async function withCredentialsLock<T>(fn: () => Promise<T>): Promise<T> {
  ensureDir(configDir(), 0o700);
  const path = lockPath();
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      const fd = openSync(path, "wx");
      closeSync(fd);
      break;
    } catch (err) {
      if ((err as { code?: string }).code !== "EEXIST") {
        throw err;
      }
      try {
        if (Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS) {
          unlinkSync(path);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new CliError(
          "Another hackspain process is holding the credentials lock.",
          {
            code: "LOCKED",
            hint: `If nothing is running, delete ${path}.`,
          }
        );
      }
      await Bun.sleep(LOCK_POLL_MS);
    }
  }
  try {
    return await fn();
  } finally {
    try {
      unlinkSync(path);
    } catch {
      // Released by the stale-lock path already.
    }
  }
}

export type RefreshFn = (refreshToken: string) => Promise<Tokens | null>;

export function sessionExpired(): CliError {
  return new CliError("Your session has expired.", {
    code: "SESSION_EXPIRED",
    hint: "Run `hackspain auth login` again.",
    exitCode: EXIT.AUTH,
  });
}

/**
 * Return a valid access token for `appUrl`, refreshing under the lock when
 * it is about to expire or when the server rejected it (`force`). Returns null
 * when there are no credentials for this deployment.
 */
export async function currentToken(
  appUrl: string,
  refresh: RefreshFn,
  options: { force?: boolean } = {}
): Promise<string | null> {
  const creds = readCredentials();
  if (!creds || creds.appUrl !== appUrl) {
    return null;
  }
  if (isFresh(creds) && !options.force) {
    return creds.token;
  }

  return await withCredentialsLock(async () => {
    const latest = readCredentials();
    if (!latest || latest.appUrl !== appUrl) {
      return null;
    }
    const justRefreshed = Date.now() - latest.updatedAt < JUST_REFRESHED_MS;
    if (isFresh(latest) && (!options.force || justRefreshed)) {
      return latest.token;
    }
    const tokens = await refresh(latest.refreshToken);
    if (!tokens) {
      clearCredentials();
      throw sessionExpired();
    }
    const next = credentialsFromTokens(tokens, appUrl, latest.email);
    writeCredentials(next);
    return next.token;
  });
}
