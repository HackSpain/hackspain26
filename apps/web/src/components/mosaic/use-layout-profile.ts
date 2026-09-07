import { useSyncExternalStore } from "react";
import type { LayoutProfile } from "./artboard";
import { COMPACT_MEDIA_QUERY } from "./artboard";

function getSnapshot(): LayoutProfile {
  return window.matchMedia(COMPACT_MEDIA_QUERY).matches ? "compact" : "desktop";
}

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(COMPACT_MEDIA_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * Returns null during SSR and the initial hydration pass so that the
 * landing page renders nothing until the real viewport size is known.
 * This prevents mobile users on slow connections from seeing the
 * desktop layout while JS is still loading.
 */
export function useLayoutProfile(): LayoutProfile | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
