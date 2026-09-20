"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ClosingPanel } from "@/components/closing/panel";
import { CLOSING_SLIDES, ClosingSlide } from "@/components/closing/slides";
import { CLOSING_API_PATH, CLOSING_PATH } from "@/lib/closing";
import type { ClosingData } from "@/lib/closing";
import { demoClosingData, summarize } from "@/lib/closing-summary";

const POLL_MS = 60_000;

function useClosingData(demo: boolean): { data: ClosingData | null; failed: boolean } {
  const [data, setData] = useState<ClosingData | null>(() => (demo ? demoClosingData() : null));
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    if (demo) {
      return;
    }
    fetch(CLOSING_API_PATH, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        setData((await response.json()) as ClosingData);
        setFailed(false);
      })
      // Keep the last good numbers on screen; their stamp shows how old they are.
      .catch(() => setFailed(true));
  }, [demo]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  return { data, failed };
}

function ClosingRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = params.get("demo") === "1";
  const slideParam = params.get("slide");
  const single = slideParam === null ? null : Math.min(Math.max(Number(slideParam) || 1, 1), CLOSING_SLIDES.length) - 1;
  const { data, failed } = useClosingData(demo);
  const summary = useMemo(() => (data ? summarize(data) : null), [data]);

  const go = useCallback((index: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (index === null) {
      next.delete("slide");
    } else {
      next.set("slide", String(index + 1));
    }
    const query = next.toString();
    router.replace(query ? `${CLOSING_PATH}?${query}` : CLOSING_PATH);
  }, [params, router]);

  useEffect(() => {
    if (single === null) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        go(Math.min(single + 1, CLOSING_SLIDES.length - 1));
      } else if (event.key === "ArrowLeft") {
        go(Math.max(single - 1, 0));
      } else if (event.key === "Escape") {
        go(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, single]);

  if (!summary) {
    return (
      <div className="flex h-dvh items-center justify-center bg-hs-ink p-8 text-hs-paper">
        {failed ? "No se han podido cargar los datos. Reintentando cada minuto." : "Cargando datos…"}
      </div>
    );
  }

  // ?slide=n: one full slide, letterboxed to the viewport and nothing else: made for a clean capture.
  if (single !== null) {
    return (
      <main className="flex h-dvh items-center justify-center bg-hs-ink">
        <div className="w-[min(100vw,calc(100dvh*16/9))]">
          <ClosingSlide index={single} summary={summary} demo={demo} />
        </div>
      </main>
    );
  }

  const stepParam = params.get("step");
  return <ClosingPanel summary={summary} demo={demo} step={stepParam === null ? null : Math.max(Number(stepParam) || 1, 1) - 1} />;
}

export default function ClosingPage() {
  return <Suspense fallback={<div className="h-dvh bg-hs-ink" />}><ClosingRoute /></Suspense>;
}
