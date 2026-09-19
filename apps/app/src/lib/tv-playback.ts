import type { ScreenConfig } from "@convex/lib/tvScreens";

// getRandomValues also works on HTTP venue LANs, where randomUUID is unavailable.
export function screenClientId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A fresh tab adopts the baseline; a consumed command cannot cause a reload loop.
export function shouldReloadTv(previous: number | null, incoming: number) {
  return previous !== null && incoming > previous;
}

// A slow HTTP response must not overwrite a subscription received meanwhile.
export function shouldApplyPoll(startVersion: number, currentVersion: number) {
  return startVersion === currentVersion;
}

// HTTP and WebSocket delivery can cross, including when a subscription reconnects.
export function shouldApplyScreenConfig(current: ScreenConfig | undefined, incoming: ScreenConfig) {
  return !current || (incoming.revision >= current.revision && incoming.reloadVersion >= current.reloadVersion);
}
