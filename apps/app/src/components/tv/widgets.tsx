"use client";

import { useRef } from "react";
import { useLiveInsights } from "@/app/insights/use-live-insights";
import type { TvFontWeight, TvWidget } from "@/lib/tv";
import { tvFontSizeClass, tvFontSizeStyle, tvFontWeightClass, tvHasBackground } from "@/lib/tv";
import { cn } from "@/lib/utils";
import { gsap, SplitText, TV_EASE_OUT, useGSAP } from "./gsap";
import { useClock, usePrefersReducedMotion } from "./motion";
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
  LiveModelsBox,
  LiveTokensBox,
} from "./live-boxes";
import { SponsorGridBox, SponsorTickerBox } from "./sponsor-boxes";

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
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      if (reduced || !ref.current) {
        return;
      }
      SplitText.create(ref.current, {
        type: "lines,words,chars",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, {
            yPercent: 110,
            opacity: 0,
            duration: 0.8,
            ease: TV_EASE_OUT,
            stagger: 0.02,
            delay: 0.45,
          }),
      });
    },
    { dependencies: [text, reduced], revertOnUpdate: true },
  );

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center px-4 text-center",
        tvHasBackground(background) && "bg-hs-ink",
      )}
    >
      <p
        ref={ref}
        style={tvFontSizeStyle(fontSize)}
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
            style={tvFontSizeStyle(fontSize)}
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

function padClock(value: number) {
  return String(value).padStart(2, "0");
}

function EventClock() {
  const now = useClock();
  const { startsAt, endsAt } = useLiveInsights();
  const time = now?.getTime();
  let label = "En marcha";
  let target: number | undefined;
  if (time !== undefined && startsAt !== undefined && endsAt !== undefined) {
    if (time < startsAt) {
      label = "Empieza en";
      target = startsAt;
    } else if (time < endsAt) {
      label = "Quedan";
      target = endsAt;
    } else {
      label = "Hackathon terminado";
    }
  }
  const left =
    target !== undefined && time !== undefined
      ? Math.max(0, Math.floor((target - time) / 1000))
      : null;
  const madrid =
    now?.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    }) ?? "--:--";

  const countdown =
    left === null
      ? "--:--:--"
      : `${padClock(Math.floor(left / 3600))}:${padClock(Math.floor(left / 60) % 60)}:${padClock(left % 60)}`;

  return (
    <div className="grid h-full grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.1fr)] gap-[0.3cqw] bg-hs-ink">
      <p className="flex items-center justify-center gap-[0.5cqw] bg-hs-red px-[0.6cqw] font-bungee text-[clamp(0.7rem,1.3cqw,1.8rem)] uppercase text-hs-paper">
        <span className="tv-pulse size-[0.7cqw] shrink-0 rounded-full bg-hs-paper" aria-hidden />
        En directo
      </p>
      <div className="flex flex-col items-center justify-center bg-hs-gold px-[0.6cqw] leading-none text-hs-ink">
        <span className="text-[clamp(0.5rem,0.7cqw,0.95rem)] font-bold tracking-[0.12em] uppercase">
          {label}
        </span>
        <span className="mt-[0.35cqw] font-bungee text-[clamp(1.1rem,2.4cqw,3.2rem)] tabular-nums">
          {countdown}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center bg-hs-teal px-[0.6cqw] leading-none text-hs-paper">
        <span className="text-[clamp(0.5rem,0.7cqw,0.95rem)] font-bold tracking-[0.12em] uppercase">
          Madrid
        </span>
        <span className="mt-[0.35cqw] font-bungee text-[clamp(1.1rem,2.4cqw,3.2rem)] tabular-nums">
          {madrid}
        </span>
      </div>
    </div>
  );
}

function ClockWidget({ fontSize }: { fontSize?: number }) {
  const now = useClock();
  return (
    <div className="flex h-full items-center justify-center bg-hs-ink px-3">
      <p
        style={tvFontSizeStyle(fontSize)}
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
        style={tvFontSizeStyle(fontSize)}
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
      return widget.text === "event" ? (
        <EventClock />
      ) : (
        <ClockWidget fontSize={widget.fontSize} />
      );
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
    case "liveModels":
      return <LiveModelsBox />;
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
          logosOnly={widget.text === "logos"}
        />
      );
  }
}
