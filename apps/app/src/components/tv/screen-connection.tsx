"use client";

import { useEffect, useState } from "react";
import { SCREEN_OFFLINE_MS, SCREEN_POLL_MS } from "@convex/lib/tvScreens";
import type { ScreenConfig, ScreenPreset } from "@convex/lib/tvScreens";
import { screenClientId, shouldReloadTv } from "@/lib/tv-playback";

export function useScreenConnection(key: string, initialPreset: ScreenPreset) {
  const [config, setConfig] = useState<ScreenConfig>({ preset: initialPreset, message: "", revision: 0, reloadVersion: 0 });
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let stopped = false;
    const clientId = screenClientId();
    let previousReload: number | null = null;
    let receivedRevision = 0;
    let lastContact = 0;
    let timer: ReturnType<typeof setTimeout>;
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
        const next: ScreenConfig = await response.json();
        if (stopped) { return; }
        lastContact = Date.now();
        setConnected(true);
        const reload = shouldReloadTv(previousReload, next.reloadVersion);
        previousReload = next.reloadVersion;
        receivedRevision = next.revision;
        try { sessionStorage.setItem(storageKey, JSON.stringify({ reloadVersion: next.reloadVersion })); }
        catch { /* Fresh sessions adopt the new baseline without a reload loop. */ }
        setConfig((current) => current.revision === next.revision && current.preset === next.preset
          && current.reloadVersion === next.reloadVersion && current.message === next.message ? current : next);
        if (reload) { window.location.reload(); }
      } catch {
        if (!stopped) { setConnected(Date.now() - lastContact < SCREEN_OFFLINE_MS); }
      } finally {
        clearTimeout(timeout);
        if (!stopped) { timer = setTimeout(contact, SCREEN_POLL_MS); }
      }
    }
    void contact();
    return () => { stopped = true; clearTimeout(timer); request?.abort(); };
  }, [key, initialPreset]);
  return { config, connected };
}
