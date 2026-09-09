"use client";

import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { TvSnapshot } from "@convex/tvPlayback";
import { shouldApplyPoll, shouldReloadTv } from "@/lib/tv-playback";

export class PlaybackBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="flex min-h-dvh items-center justify-center bg-hs-ink text-hs-gold">
        <p className="font-bungee text-4xl">HackSpain · Volvemos enseguida</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

// This controller lives above the screen boundary, so widget errors cannot
// disable remote recovery. The editor and its widgets stay owned by tv/.
export function useTvPlayback() {
  const convex = useConvex();
  const [snapshot, setSnapshot] = useState<TvSnapshot>();
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let stopped = false;
    let contact = 0;
    let subscriptionVersion = 0;
    let previousReload: number | null = null;
    let fingerprint = "";
    let timer: ReturnType<typeof setTimeout>;
    let request: AbortController | undefined;
    try {
      const saved = sessionStorage.getItem("hs-tv-reload-version");
      if (saved !== null && Number.isSafeInteger(Number(saved))) {
        previousReload = Number(saved);
      }
    } catch {
      /* Kiosks may disable storage; fresh sessions adopt the baseline. */
    }

    function receive(value: TvSnapshot | undefined) {
      if (stopped || !value) {
        return;
      }
      contact = Date.now();
      setConnected(true);
      const reload = shouldReloadTv(previousReload, value.reloadVersion);
      previousReload = value.reloadVersion;
      try {
        sessionStorage.setItem(
          "hs-tv-reload-version",
          String(value.reloadVersion),
        );
      } catch {
        /* In-memory baseline remains usable. */
      }
      const next = JSON.stringify(value);
      if (next !== fingerprint) {
        fingerprint = next;
        setSnapshot(value);
        setRevision((version) => version + 1);
      }
      if (reload) {
        window.location.reload();
      }
    }

    const watch = convex.watchQuery(api.tvPlayback.snapshot, {});
    const read = () => {
      try {
        const value = watch.localQueryResult();
        if (value) {
          subscriptionVersion += 1;
          receive(value);
        }
      } catch {
        /* HTTP continues if the WebSocket query fails. */
      }
    };
    const unsubscribe = watch.onUpdate(read);
    read();

    async function poll() {
      const startedAt = subscriptionVersion;
      const controller = new AbortController();
      request = controller;
      const abort = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/tv", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("TV offline");
        }
        const value: TvSnapshot = await response.json();
        if (
          Array.isArray(value.widgets) &&
          Array.isArray(value.messages) &&
          Number.isSafeInteger(value.reloadVersion) &&
          shouldApplyPoll(startedAt, subscriptionVersion)
        ) {
          receive(value);
        }
      } catch {
        /* Keep the last published layout; never reload while offline. */
      } finally {
        clearTimeout(abort);
        if (!stopped) {
          setConnected(Date.now() - contact < 60_000);
          timer = setTimeout(poll, 20_000);
        }
      }
    }
    void poll();
    return () => {
      stopped = true;
      unsubscribe();
      clearTimeout(timer);
      request?.abort();
    };
  }, [convex]);
  return { snapshot, connected, revision };
}
