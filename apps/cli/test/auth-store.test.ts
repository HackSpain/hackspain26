import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Credentials } from "../src/lib/auth-store";
import {
  clearCredentials,
  credentialsFromTokens,
  credentialsPath,
  currentToken,
  decodeJwtExpiry,
  isFresh,
  REFRESH_MARGIN_MS,
  readCredentials,
  withCredentialsLock,
  writeCredentials,
} from "../src/lib/auth-store";

const URL = "https://example.convex.cloud";

function jwtExpiringAt(epochSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url"
  );
  const payload = Buffer.from(JSON.stringify({ exp: epochSeconds })).toString(
    "base64url"
  );
  return `${header}.${payload}.sig`;
}

function creds(overrides: Partial<Credentials> = {}): Credentials {
  return {
    appUrl: URL,
    email: "a@b.c",
    refreshToken: "r1",
    token: "t1",
    tokenExpiresAt: Date.now() + 60 * 60 * 1000,
    updatedAt: Date.now() - 60 * 1000,
    version: 1,
    ...overrides,
  };
}

let dir: string;
const previousXdg = process.env.XDG_CONFIG_HOME;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hackspain-auth-"));
  process.env.XDG_CONFIG_HOME = dir;
});

afterEach(() => {
  process.env.XDG_CONFIG_HOME = previousXdg;
  rmSync(dir, { force: true, recursive: true });
});

describe("credential file", () => {
  test("round-trips and is private", () => {
    writeCredentials(creds());
    expect(readCredentials()?.email).toBe("a@b.c");
    if (process.platform !== "win32") {
      expect(statSync(credentialsPath()).mode & 0o777).toBe(0o600);
    }
    clearCredentials();
    expect(readCredentials()).toBeNull();
  });

  test("rejects unknown versions and malformed files", () => {
    writeCredentials({ ...creds(), version: 2 as 1 });
    expect(readCredentials()).toBeNull();
  });

  test("derives expiry from the JWT", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(decodeJwtExpiry(jwtExpiringAt(exp))).toBe(exp * 1000);
    expect(decodeJwtExpiry("not-a-jwt")).toBeNull();
    const c = credentialsFromTokens(
      { refreshToken: "r", token: jwtExpiringAt(exp) },
      URL,
      "x@y.z"
    );
    expect(c.tokenExpiresAt).toBe(exp * 1000);
    expect(isFresh(c)).toBe(true);
    expect(
      isFresh({ ...c, tokenExpiresAt: Date.now() + REFRESH_MARGIN_MS - 1 })
    ).toBe(false);
  });
});

describe("currentToken", () => {
  test("returns null without credentials or for another deployment", async () => {
    const refresh = async () => {
      throw new Error("should not refresh");
    };
    expect(await currentToken(URL, refresh)).toBeNull();
    writeCredentials(creds({ appUrl: "https://other.convex.cloud" }));
    expect(await currentToken(URL, refresh)).toBeNull();
  });

  test("uses a fresh token without touching the network", async () => {
    writeCredentials(creds());
    let calls = 0;
    const token = await currentToken(URL, async () => {
      calls++;
      return null;
    });
    expect(token).toBe("t1");
    expect(calls).toBe(0);
  });

  test("refreshes an expiring token, writes before returning, rotates the refresh token", async () => {
    writeCredentials(creds({ tokenExpiresAt: Date.now() + 1000 }));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await currentToken(URL, async (refreshToken) => {
      expect(refreshToken).toBe("r1");
      return { refreshToken: "r2", token: jwtExpiringAt(exp) };
    });
    expect(token).toBe(jwtExpiringAt(exp));
    const stored = readCredentials();
    expect(stored?.refreshToken).toBe("r2");
    expect(stored?.tokenExpiresAt).toBe(exp * 1000);
  });

  test("two concurrent refreshes hit the network exactly once", async () => {
    writeCredentials(creds({ tokenExpiresAt: Date.now() + 1000 }));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    let calls = 0;
    const refresh = async (refreshToken: string) => {
      calls++;
      await Bun.sleep(150);
      if (refreshToken !== "r1") {
        return null; // reuse would be a logout
      }
      return { refreshToken: "r2", token: jwtExpiringAt(exp) };
    };
    const [a, b] = await Promise.all([
      currentToken(URL, refresh),
      currentToken(URL, refresh),
    ]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(readCredentials()?.refreshToken).toBe("r2");
  });

  test("a rejected token that was refreshed seconds ago is trusted, not refreshed again", async () => {
    writeCredentials(creds({ updatedAt: Date.now() }));
    let calls = 0;
    const token = await currentToken(
      URL,
      async () => {
        calls++;
        return null;
      },
      { force: true }
    );
    expect(token).toBe("t1");
    expect(calls).toBe(0);
  });

  test("a forced refresh of an older token goes to the network", async () => {
    writeCredentials(creds({ updatedAt: Date.now() - 60_000 }));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await currentToken(
      URL,
      async () => ({ refreshToken: "r2", token: jwtExpiringAt(exp) }),
      { force: true }
    );
    expect(token).toBe(jwtExpiringAt(exp));
  });

  test("a dead refresh token clears credentials and asks to log in again", async () => {
    writeCredentials(creds({ tokenExpiresAt: 0 }));
    await expect(currentToken(URL, async () => null)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      exitCode: 3,
    });
    expect(readCredentials()).toBeNull();
  });
});

describe("withCredentialsLock", () => {
  test("serialises critical sections", async () => {
    const order: string[] = [];
    await Promise.all([
      withCredentialsLock(async () => {
        order.push("a-in");
        await Bun.sleep(100);
        order.push("a-out");
      }),
      withCredentialsLock(async () => {
        order.push("b-in");
        order.push("b-out");
      }),
    ]);
    expect(order).toEqual(["a-in", "a-out", "b-in", "b-out"]);
  });

  test("releases the lock even when the body throws", async () => {
    await expect(
      withCredentialsLock(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(() =>
      readFileSync(join(dir, "hackspain", "credentials.lock"))
    ).toThrow();
  });
});
