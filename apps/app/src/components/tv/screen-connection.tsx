"use client";

import { useConvex, useConvexConnectionState } from "convex/react";
import { api } from "@convex/_generated/api";
import { useEffect, useState } from "react";
import { SCREEN_HEARTBEAT_MS } from "@convex/lib/tvScreens";
import type { ScreenConfig, ScreenPreset } from "@convex/lib/tvScreens";
import { screenClientId, shouldReloadTv } from "@/lib/tv-playback";

export function useScreenConnection(key: string, initialPreset: ScreenPreset) {
  const convex = useConvex();
  const connection = useConvexConnectionState();
  const [config, setConfig] = useState<ScreenConfig>({ preset: initialPreset, message: "", revision: 0, reloadVersion: 0 });
  const [received, setReceived] = useState(false);
  useEffect(() => {
    let stopped = false;
    const clientId = screenClientId();
    let previousReload: number | null = null;
    let receivedRevision = 0;
    let inFlight = false;
    let request: AbortController | undefined;
    const storageKey = `hs-tv-screen:${key}`;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const value: { reloadVersion?: number } = JSON.parse(saved);
        if (Number.isSafeInteger(value.reloadVersion)) { previousReload = value.reloadVersion ?? null; }
      }
    } catch { /* An in-memory baseline also works when kiosk storage is disabled. */ }
    async function contact() {
      if (stopped || inFlight) { return; }
      inFlight = true;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/tv", {
          method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key, clientId, url: window.location.href, initialPreset,
            width: window.innerWidth, height: window.innerHeight,
            receivedRevision, receivedReloadVersion: previousReload ?? 0,
          }),
        });
        if (!response.ok) { throw new Error("Screen offline"); }
        // Keep the legacy response compatible, but only the subscription applies commands.
      } catch {
        // Presence retries on the next interval. Keep displaying the last received view.
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    const watch = convex.watchQuery(api.tvPlayback.screenConfiguration, { key });
    function applyConfig() {
      if (stopped) { return; }
      let next: ScreenConfig | null | undefined;
      try { next = watch.localQueryResult(); }
      catch { setReceived(false); return; }
      if (!next) { return; }
      const reload = shouldReloadTv(previousReload, next.reloadVersion);
      previousReload = next.reloadVersion;
      receivedRevision = next.revision;
      try { sessionStorage.setItem(storageKey, JSON.stringify({ reloadVersion: next.reloadVersion })); }
      catch { /* Fresh sessions adopt the new baseline without a reload loop. */ }
      setConfig((current) => current.revision === next.revision && current.preset === next.preset
        && current.reloadVersion === next.reloadVersion && current.message === next.message ? current : next);
      setReceived(true);
      if (reload) { window.location.reload(); return; }
      void contact();
    }
    const unsubscribe = watch.onUpdate(applyConfig);
    applyConfig();
    void contact();
    const timer = setInterval(() => void contact(), SCREEN_HEARTBEAT_MS);
    return () => { stopped = true; unsubscribe(); clearInterval(timer); request?.abort(); };
  }, [convex, key, initialPreset]);
  return { config, connected: received && connection.isWebSocketConnected };
}
