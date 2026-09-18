"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { screenKey, screenPreset } from "@convex/lib/tvScreens";
import type { ScreenPreset } from "@convex/lib/tvScreens";
import { PlaybackBoundary } from "@/components/tv/playback";
import { PresetScreen } from "@/components/tv/presets";
import { useScreenConnection } from "@/components/tv/screen-connection";
import { screenClientId } from "@/lib/tv-playback";

function ManagedScreen({ id, initialPreset }: { id: string; initialPreset: ScreenPreset }) {
  const { config, connected } = useScreenConnection(id, initialPreset);
  return (
    <>
      <PlaybackBoundary key={config.revision}><PresetScreen config={config} /></PlaybackBoundary>
      {!connected ? <p role="status" className="fixed right-4 bottom-4 z-[60] bg-hs-ink/90 px-3 py-2 text-sm text-hs-paper">Conectando pantalla · {id}</p> : null}
    </>
  );
}

function TvRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const rawKey = params.get("screen");
  const demo = params.get("demo") === "1";
  const initialPreset = screenPreset(params.get("view") === "messages" ? "avisos" : params.get("view"));
  useEffect(() => {
    if (demo || rawKey) { return; }
    const next = new URLSearchParams(params.toString());
    next.set("screen", `tv-${screenClientId().slice(0, 8)}`);
    router.replace(`/tv?${next.toString()}`);
  }, [demo, rawKey, params, router]);
  if (demo) {
    return <PresetScreen config={{ preset: initialPreset, message: "Bienvenidos a HackSpain", revision: 0, reloadVersion: 0 }} demo />;
  }
  if (!rawKey) { return <div className="h-dvh bg-hs-ink" />; }
  let id: string;
  try { id = screenKey(rawKey); }
  catch {
    return <div className="flex h-dvh items-center justify-center bg-hs-ink p-8 text-hs-paper">Identificador no válido. Usa /tv?screen=entrada con letras sin acentos, números o guiones.</div>;
  }
  return <ManagedScreen key={id} id={id} initialPreset={initialPreset} />;
}

export default function TvPage() {
  return <Suspense fallback={<div className="h-dvh bg-hs-ink" />}><TvRoute /></Suspense>;
}
