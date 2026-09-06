"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { TvStage } from "@/components/tv/stage";

type Zone = "banner" | "left" | "right" | "ticker";

type TvMessage = {
  _id: string;
  text: string;
  zone: Zone;
  order: number;
};

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const initial = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);
  return now;
}

function zoneMessages(messages: TvMessage[] | undefined, zone: Zone) {
  return (messages ?? []).filter((message) => message.zone === zone);
}

function Column({ title, items }: { title: string; items: TvMessage[] }) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col gap-4">
      {items.map((message) => (
        <div
          key={message._id}
          className="border-[3px] border-hs-gold/40 bg-hs-paper/5 p-5"
        >
          <p className="whitespace-pre-wrap break-words text-xl leading-snug text-hs-paper lg:text-2xl">
            {message.text}
          </p>
        </div>
      ))}
    </section>
  );
}

function TvMessagesBoard({ showBackLink }: { showBackLink: boolean }) {
  const messages = useQuery(api.tv.list);
  const now = useClock();

  const banner = zoneMessages(messages, "banner");
  const left = zoneMessages(messages, "left");
  const right = zoneMessages(messages, "right");
  const ticker = zoneMessages(messages, "ticker");
  const empty =
    messages !== undefined &&
    banner.length + left.length + right.length + ticker.length === 0;

  const tickerLine = ticker.map((message) => message.text);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-hs-ink text-hs-paper">
      {showBackLink ? (
        <div className="px-6 pt-3 lg:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-11 items-center gap-2 text-sm font-medium text-hs-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-gold motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver al dashboard
          </Link>
        </div>
      ) : null}
      <header className="flex items-baseline justify-between gap-4 border-b-[3px] border-hs-gold px-6 py-4 lg:px-10">
        <p className="font-bungee text-2xl uppercase text-hs-gold lg:text-4xl">
          HackSpain <span className="text-hs-paper">2026</span>
        </p>
        <p
          className="font-bungee text-2xl tabular-nums text-hs-paper lg:text-4xl"
          aria-label="Hora actual"
        >
          {now
            ? now.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      </header>

      {banner.length > 0 ? (
        <div className="border-b-[3px] border-hs-gold/40 px-6 py-6 text-center lg:px-10 lg:py-8">
          {banner.map((message) => (
            <p
              key={message._id}
              className="font-bungee text-3xl uppercase leading-tight text-hs-gold lg:text-6xl"
            >
              {message.text}
            </p>
          ))}
        </div>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden px-6 py-6 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:py-8">
        {empty ? (
          <div className="col-span-full flex items-center justify-center lg:col-span-2">
            <p className="font-bungee text-4xl uppercase text-hs-gold/60 lg:text-7xl">
              Madrid · 2026
            </p>
          </div>
        ) : (
          <>
            <Column title="Columna izquierda" items={left} />
            <Column title="Columna derecha" items={right} />
          </>
        )}
      </main>

      {tickerLine.length > 0 ? (
        <footer className="overflow-hidden border-t-[3px] border-hs-gold bg-hs-gold py-3">
          <div
            className="tv-ticker flex w-max"
            style={{ animationDuration: `${Math.max(24, tickerLine.length * 10)}s` }}
          >
            {[0, 1].map((copy) => (
              <p
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 whitespace-nowrap font-bungee text-xl uppercase text-hs-ink lg:text-2xl"
              >
                {tickerLine.map((text, index) => (
                  <span key={index} className="px-8">
                    {text} <span aria-hidden>✦</span>
                  </span>
                ))}
              </p>
            ))}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function TvBackLink() {
  return (
    <Link
      href="/"
      className="absolute top-3 left-3 z-50 inline-flex min-h-11 min-w-11 items-center gap-2 text-sm font-medium text-hs-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-gold motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96]"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Volver al dashboard
    </Link>
  );
}

function TvComposition({ showBackLink }: { showBackLink: boolean }) {
  const widgets = useQuery(api.tv.listWidgets);

  return (
    <div className="relative h-dvh overflow-hidden bg-hs-ink">
      {showBackLink ? <TvBackLink /> : null}
      {widgets === undefined ? (
        <div className="h-full bg-hs-ink" />
      ) : (
        <TvStage widgets={widgets} fill />
      )}
    </div>
  );
}

function TvScreen() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const fromApp = searchParams.get("from") === "app";

  if (view === "messages") {
    return <TvMessagesBoard showBackLink={fromApp} />;
  }

  return <TvComposition showBackLink={fromApp} />;
}

export default function TvPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-hs-ink" />}>
      <TvScreen />
    </Suspense>
  );
}
