const REFERRAL_QUERY_PARAM = "ref";
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

function setStoredReferralCode(code: string, storage?: StorageLike): void {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return;
  }
  const s = storage ?? defaultStorage();
  if (!s) {
    return;
  }
  try {
    s.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    /* quota / private mode */
  }
}

/** Reads `?ref=` from search, persists it, and returns the active code. */
function captureReferralFromSearch(
  search: string,
  storage?: StorageLike
): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const raw = params.get(REFERRAL_QUERY_PARAM);
  if (!raw) {
    return getStoredReferralCode(storage);
  }
  const normalized = normalizeReferralCode(raw);
  if (normalized) {
    setStoredReferralCode(normalized, storage);
    return normalized;
  }
  return getStoredReferralCode(storage);
}

export function captureReferralFromLocation(
  storage?: StorageLike
): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return captureReferralFromSearch(window.location.search, storage);
}

/** Appends `ref` to same-site relative links when a code is stored. */
export function appendReferralToInternalHref(
  href: string,
  code?: string | null
): string {
  const ref =
    code ?? (typeof window === "undefined" ? null : getStoredReferralCode());
  if (!ref) {
    return href;
  }
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  const hashIdx = href.indexOf("#");
  const base = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const hash = hashIdx === -1 ? "" : href.slice(hashIdx);
  const qIdx = base.indexOf("?");
  const path = qIdx === -1 ? base : base.slice(0, qIdx);
  const query = qIdx === -1 ? "" : base.slice(qIdx + 1);
  const params = new URLSearchParams(query);
  if (params.has(REFERRAL_QUERY_PARAM)) {
    return href;
  }
  params.set(REFERRAL_QUERY_PARAM, ref);
  const qs = params.toString();
  return qs.length > 0 ? `${path}?${qs}${hash}` : `${path}${hash}`;
}
