import { ANALYTICS_CONSENT_STORAGE_KEY } from "../data/cookie-consent";
import { trackPageviewAfterConsent } from "../lib/consent-analytics";

/** Cookie banner + consent-driven Vercel Analytics pageview (bundled as ES module — no broken `/lib/...` URLs). */
export function initCookieConsentBanner(): void {
  const banner = document.querySelector("#hs-cookie-banner");
  const acceptBtn = document.querySelector("#hs-cookie-accept");
  const rejectBtn = document.querySelector("#hs-cookie-reject");

  function readConsent(): string | null {
    try {
      return localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function hideBanner(): void {
    banner?.classList.add("hidden");
  }

  const existing = readConsent();
  if (existing !== "granted" && existing !== "denied") {
    banner?.classList.remove("hidden");
  }

  function persist(value: NonNullable<Window["__hsAnalyticsConsent"]>): void {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    window.__hsAnalyticsConsent = value;
    hideBanner();
  }

  acceptBtn?.addEventListener("click", () => {
    persist("granted");
    trackPageviewAfterConsent();
  });

  rejectBtn?.addEventListener("click", () => {
    persist("denied");
  });
}
