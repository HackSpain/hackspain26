"use client";

import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { ScreenConfig } from "@convex/lib/tvScreens";
import { ArrivalDemo, ArrivalStage, LiveArrivals } from "@/components/arrivals/screen";
import { MarketScreen } from "./market";
import { PanelV2Screen } from "./panel-v2";
import { TeamsScreen } from "./teams";
import { useClock } from "./motion";
import { SponsorsScreen } from "./sponsors-screen";

function Activity() {
  const posts = useQuery(api.tv.listFeed, { source: "all" });
  return (
    <div className="grid min-h-0 flex-1 auto-rows-fr gap-[2vmin] md:grid-cols-2">
      {posts?.slice(0, 4).map((post) => (
        <article key={post._id} className="flex min-h-0 flex-col justify-center overflow-hidden border border-hs-paper/20 bg-hs-paper/5 p-[3vmin]">
          <h2 className="font-bungee text-[clamp(18px,2.3vmin,48px)] text-hs-gold">{post.authorName}</h2>
          {post.teamName ? <p className="mt-2 text-[2vmin] text-hs-paper/60">{post.teamName}</p> : null}
          <p className="mt-[2vmin] line-clamp-5 whitespace-pre-wrap break-words text-[clamp(18px,3vmin,64px)] leading-snug">{post.text}</p>
        </article>
      ))}
      {posts?.length === 0 ? <p className="self-center text-[4vmin] text-hs-paper/60">La actividad aparecerá aquí.</p> : null}
      {!posts ? <p className="self-center text-[4vmin] text-hs-paper/60">Cargando actividad…</p> : null}
    </div>
  );
}

export function PresetScreen({ config, demo = false }: { config: ScreenConfig; demo?: boolean }) {
  const now = useClock();
  if (config.preset === "entradas") { return demo ? <ArrivalDemo /> : <LiveArrivals />; }
  if (config.preset === "espera") { return <ArrivalStage person={null} waiting />; }
  if (config.preset === "panel") { return <MarketScreen demo={demo} />; }
  if (config.preset === "panelv2") { return <PanelV2Screen demo={demo} />; }
  if (config.preset === "equipos") { return <TeamsScreen demo={demo} />; }
  if (config.preset === "patrocinadores") { return <SponsorsScreen />; }
  return (
    <main className="flex h-dvh w-full flex-col gap-[4vmin] overflow-hidden bg-hs-ink p-[4vmin] text-hs-paper">
      <header className="flex shrink-0 items-center justify-between gap-6">
        <Image src="/logo.svg" alt="HackSpain" width={190} height={63} className="h-auto w-[clamp(100px,12vw,280px)]" />
        <p className="font-mono text-[clamp(16px,2.5vmin,48px)] tabular-nums text-hs-paper/60">
          {now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
        </p>
      </header>
      {config.preset === "avisos" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="max-w-[90%] whitespace-pre-wrap break-words text-center font-bungee leading-tight text-balance text-hs-gold" style={{ fontSize: config.message.length > 240 ? "4vmin" : config.message.length > 100 ? "6vmin" : "9vmin" }}>{config.message || "HackSpain 2026"}</p>
        </div>
      ) : null}
      {config.preset === "actividad" ? <Activity /> : null}
    </main>
  );
}
