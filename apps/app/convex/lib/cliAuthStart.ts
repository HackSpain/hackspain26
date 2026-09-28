import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";
import { constantTimeEqual } from "@oslojs/crypto/subtle";

export const START_WINDOW_MS = 60_000;
export const START_LIMIT_PER_IP = 120;
export const START_PROOF_MAX_AGE_MS = 2 * 60_000;

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function mac(secret: string, message: string): string {
  return hex(hmac(SHA256, encoder.encode(secret), encoder.encode(message)));
}

/** The IP never enters Convex storage or function arguments. */
export function startIdentityKey(bridgeSecret: string, ip: string): string {
  return mac(bridgeSecret, `cli-auth-ip:v1:${ip}`);
}

export function signStart(
  bridgeSecret: string,
  deviceSecret: string,
  identityKey: string,
  issuedAt: number
): string {
  return mac(
    bridgeSecret,
    `cli-auth-start:v1:${deviceSecret}:${identityKey}:${issuedAt}`
  );
}

export function validStartProof(
  bridgeSecret: string,
  deviceSecret: string,
  identityKey: string,
  issuedAt: number,
  signature: string,
  now: number
): boolean {
  if (
    bridgeSecret.length < 32 ||
    !/^[a-f0-9]{64}$/.test(identityKey) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !Number.isSafeInteger(issuedAt) ||
    Math.abs(now - issuedAt) > START_PROOF_MAX_AGE_MS
  ) {
    return false;
  }
  const expected = signStart(bridgeSecret, deviceSecret, identityKey, issuedAt);
  return constantTimeEqual(encoder.encode(signature), encoder.encode(expected));
}
