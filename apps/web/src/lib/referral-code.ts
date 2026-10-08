const REFERRAL_STORAGE_KEY = "hackspain-referral-code-v1";
const REFERRAL_CODE_MAX_LENGTH = 64;

const REFERRAL_CODE_RE = /^[a-zA-Z0-9_-]+$/;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

/** Normalizes and validates a referral code from URL or form input. */
export function normalizeReferralCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > REFERRAL_CODE_MAX_LENGTH) {
    return null;
  }
  if (!REFERRAL_CODE_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function getStoredReferralCode(storage?: StorageLike): string | null {
  const s = storage ?? defaultStorage();
  if (!s) {
    return null;
  }
  try {
    const v = s.getItem(REFERRAL_STORAGE_KEY);
    if (!v) {
      return null;
    }
    return normalizeReferralCode(v);
  } catch {
    return null;
  }
}
