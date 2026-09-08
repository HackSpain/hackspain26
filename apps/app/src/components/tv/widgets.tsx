"use client";

import { useEffect, useState } from "react";
import type { TvFontWeight, TvWidget } from "@/lib/tv";
import { tvFontSizeClass, tvFontWeightClass, tvHasBackground } from "@/lib/tv";
import { cn } from "@/lib/utils";
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

function BannerWidget({
  text,
  fontSize,
  fontWeight,
  background,
}: {
  text: string;
  fontSize?: number;
  fontWeight?: TvFontWeight;
  background?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center px-4 text-center",
        tvHasBackground(background) && "bg-hs-ink",
      )}
    >
      <p
        className={cn(
          "font-bungee leading-tight text-balance text-hs-gold uppercase",
          tvFontSizeClass("banner", fontSize),
          tvFontWeightClass(fontWeight),
        )}
      >
        {text}
      </p>
    </div>
  );
}

function TickerWidget({
  text,
  fontSize,
  fontWeight,
  background,
}: {
  text: string;
  fontSize?: number;
  fontWeight?: TvFontWeight;
  background?: boolean;
}) {
  const fill = tvHasBackground(background);
  const parts = text
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const items = parts.length > 0 ? parts : [text];
  return (
    <div
      className={cn(
        "flex h-full items-center overflow-hidden",
        fill && "bg-hs-gold",
      )}
    >
      <div
        className="tv-ticker flex w-max"
        style={{ animationDuration: `${Math.max(18, items.length * 8)}s` }}
      >
        {[0, 1].map((copy) => (
          <p
            key={copy}
            aria-hidden={copy === 1}
            className={cn(
              "flex shrink-0 whitespace-nowrap font-bungee uppercase",
              fill ? "text-hs-ink" : "text-hs-gold",
              tvFontSizeClass("ticker", fontSize),
              tvFontWeightClass(fontWeight),
            )}
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

function ClockWidget({ fontSize }: { fontSize?: number }) {
  const now = useClock();
  return (
    <div className="flex h-full items-center justify-center bg-hs-ink px-3">
      <p
        className={cn(
          "font-bungee tabular-nums text-hs-paper",
          tvFontSizeClass("clock", fontSize),
        )}
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

function MessageWidget({
  text,
  fontSize,
  fontWeight,
  background,
}: {
  text: string;
  fontSize?: number;
  fontWeight?: TvFontWeight;
  background?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center p-4",
        tvHasBackground(background) &&
          "border-[3px] border-hs-gold/40 bg-hs-paper/5",
      )}
    >
      <p
        className={cn(
          "whitespace-pre-wrap break-words leading-snug text-pretty text-hs-paper",
          tvFontSizeClass("message", fontSize),
          tvFontWeightClass(fontWeight),
        )}
      >
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
      return (
        <BannerWidget
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
    case "ticker":
      return (
        <TickerWidget
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
    case "clock":
      return <ClockWidget fontSize={widget.fontSize} />;
    case "message":
      return (
        <MessageWidget
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
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
