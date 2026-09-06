"use client";

import { useEffect, useState } from "react";
import type { TvWidget } from "@/lib/tv";
import {
  InsightsActivityBox,
  InsightsEvolutionBox,
  InsightsHarnessBox,
  InsightsLeaderboardBox,
  InsightsScatterBox,
  InsightsStacksBox,
  InsightsStatsBox,
} from "./insights-boxes";
import { FeedBox } from "./feed-box";
import {
  LiveAgentsBox,
  LiveCommitsBox,
  LiveLeaderboardBox,
  LiveTokensBox,
} from "./live-boxes";
import { SponsorGridBox, SponsorTickerBox } from "./sponsor-boxes";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

function BannerWidget({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-hs-ink px-4 text-center">
      <p className="font-bungee text-[clamp(1.1rem,4cqw,4.5rem)] leading-tight text-balance text-hs-gold uppercase">
        {text}
      </p>
    </div>
  );
}

function TickerWidget({ text }: { text: string }) {
  const parts = text
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const items = parts.length > 0 ? parts : [text];
  return (
    <div className="flex h-full items-center overflow-hidden bg-hs-gold">
      <div
        className="tv-ticker flex w-max"
        style={{ animationDuration: `${Math.max(18, items.length * 8)}s` }}
      >
        {[0, 1].map((copy) => (
          <p
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 whitespace-nowrap font-bungee text-[clamp(0.9rem,2.6cqw,2rem)] text-hs-ink uppercase"
          >
            {items.map((item, index) => (
              <span key={index} className="px-8">
                {item} <span aria-hidden>✦</span>
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

function ClockWidget() {
  const now = useClock();
  return (
    <div className="flex h-full items-center justify-center bg-hs-ink px-3">
      <p
        className="font-bungee text-[clamp(1.4rem,6cqw,5rem)] tabular-nums text-hs-paper"
        aria-label="Hora actual"
      >
        {now
          ? now.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </p>
    </div>
  );
}

function MessageWidget({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col justify-center border-[3px] border-hs-gold/40 bg-hs-paper/5 p-4">
      <p className="whitespace-pre-wrap break-words text-[clamp(0.85rem,2.2cqw,1.75rem)] leading-snug text-pretty text-hs-paper">
        {text}
      </p>
    </div>
  );
}

export function TvWidgetView({
  widget,
  editor = false,
}: {
  widget: TvWidget;
  editor?: boolean;
}) {
  switch (widget.kind) {
    case "banner":
      return <BannerWidget text={widget.text} />;
    case "ticker":
      return <TickerWidget text={widget.text} />;
    case "clock":
      return <ClockWidget />;
    case "message":
      return <MessageWidget text={widget.text} />;
    case "insightsStats":
      return <InsightsStatsBox />;
    case "insightsActivity":
      return <InsightsActivityBox />;
    case "insightsHarness":
      return <InsightsHarnessBox />;
    case "insightsStacks":
      return <InsightsStacksBox />;
    case "insightsScatter":
      return <InsightsScatterBox />;
    case "insightsLeaderboard":
      return <InsightsLeaderboardBox />;
    case "insightsEvolution":
      return <InsightsEvolutionBox />;
    case "liveCommits":
      return <LiveCommitsBox />;
    case "liveAgents":
      return <LiveAgentsBox />;
    case "liveTokens":
      return <LiveTokensBox />;
    case "liveLeaderboard":
      return <LiveLeaderboardBox />;
    case "feed":
      return (
        <FeedBox mode={widget.feedMode} source={widget.feedSource} />
      );
    case "sponsorGrid":
      return (
        <SponsorGridBox sponsors={widget.sponsors ?? []} editor={editor} />
      );
    case "sponsorTicker":
      return (
        <SponsorTickerBox
          sponsors={widget.sponsors ?? []}
          speed={widget.tickerSpeed}
          editor={editor}
        />
      );
  }
}
