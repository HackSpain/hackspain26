"use client";

import { memo } from 'react';
import type { ReactNode } from 'react';
import { TV_PALETTE, tvFontSizeClass, tvFontSizeStyle, tvFontWeightClass, tvHasBackground } from '@/lib/tv';
import type { TvFontWeight, TvWidget } from '@/lib/tv';
import { cn } from '@/lib/utils';
import { SponsorTickerBox } from './sponsor-boxes';

function BannerPreview({
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
        'flex h-full items-center justify-center px-4 text-center',
        tvHasBackground(background) && 'bg-hs-ink',
      )}
    >
      <p
        style={tvFontSizeStyle(fontSize)}
        className={cn(
          'font-bungee leading-tight text-balance text-hs-gold uppercase',
          tvFontSizeClass('banner', fontSize),
          tvFontWeightClass(fontWeight),
        )}
      >
        {text}
      </p>
    </div>
  );
}

function TickerPreview({
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
  return (
    <div
      className={cn(
        'flex h-full items-center overflow-hidden px-4',
        fill && 'bg-hs-gold',
      )}
    >
      <p
        style={tvFontSizeStyle(fontSize)}
        className={cn(
          'truncate font-bungee uppercase',
          fill ? 'text-hs-ink' : 'text-hs-gold',
          tvFontSizeClass('ticker', fontSize),
          tvFontWeightClass(fontWeight),
        )}
      >
        {text}
      </p>
    </div>
  );
}

function ClockPreview({ fontSize }: { fontSize?: number }) {
  return (
    <div className="flex h-full items-center justify-center bg-hs-ink px-3">
      <p
        style={tvFontSizeStyle(fontSize)}
        className={cn(
          "font-bungee tabular-nums text-hs-paper",
          tvFontSizeClass("clock", fontSize),
        )}
      >
        21:00
      </p>
    </div>
  );
}

function MessagePreview({
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
        'flex h-full flex-col justify-center p-4',
        tvHasBackground(background) &&
          'border-[3px] border-hs-gold/40 bg-hs-paper/5',
      )}
    >
      <p
        style={tvFontSizeStyle(fontSize)}
        className={cn(
          'line-clamp-6 whitespace-pre-wrap break-words leading-snug text-pretty text-hs-paper',
          tvFontSizeClass('message', fontSize),
          tvFontWeightClass(fontWeight),
        )}
      >
        {text}
      </p>
    </div>
  );
}

function Frame({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-hs-paper p-3 text-hs-ink">
      <p className="font-bungee text-[10px] uppercase">{title}</p>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Bars({ widths }: { widths: number[] }) {
  return (
    <div className="flex h-full flex-col justify-end gap-1">
      {widths.map((width, index) => (
        <span
          key={index}
          className="block h-2 bg-hs-navy/20"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

function SponsorPreview({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-hs-paper p-3 text-hs-brown">
        <p className="text-sm">Doble clic o usa el panel para sponsors</p>
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-2 content-start gap-2 bg-hs-paper p-3 text-hs-ink sm:grid-cols-3">
      {names.map((name) => (
        <div
          key={name}
          className="flex items-center border-[3px] border-hs-ink/15 px-2 py-2 font-bungee text-xs uppercase"
        >
          {name}
        </div>
      ))}
    </div>
  );
}

export const TvWidgetPreview = memo(function TvWidgetPreview({
  widget,
}: {
  widget: TvWidget;
}) {
  switch (widget.kind) {
    case "banner": {
      return (
        <BannerPreview
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
    }
    case "ticker": {
      return (
        <TickerPreview
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
    }
    case "clock": {
      return <ClockPreview fontSize={widget.fontSize} />;
    }
    case "message": {
      return (
        <MessagePreview
          text={widget.text}
          fontSize={widget.fontSize}
          fontWeight={widget.fontWeight}
          background={widget.background}
        />
      );
    }
    case "insightsStats": {
      return (
        <div className="grid h-full grid-cols-2 gap-2 lg:grid-cols-4">
          {["Tokens", "Commits", "Sesiones", "PRs"].map((label, index) => (
            <div
              key={label}
              className={`flex flex-col justify-between border-[3px] border-hs-ink/20 bg-hs-paper p-3 ${index === 0 ? "border-hs-ink bg-hs-gold" : ""}`}
            >
              <p className="text-[10px] font-semibold tracking-wide text-hs-brown uppercase">
                {label}
              </p>
              <p className="font-sans text-2xl font-black tabular-nums">—</p>
            </div>
          ))}
        </div>
      );
    }
    case "insightsActivity": {
      return (
        <Frame title="Actividad">
          <Bars widths={[40, 70, 55, 90, 60, 80]} />
        </Frame>
      );
    }
    case "insightsHarness": {
      return (
        <Frame title="Harnesses">
          <div className="grid size-20 place-items-center rounded-full border-[8px] border-hs-sand border-t-hs-gold" />
        </Frame>
      );
    }
    case "insightsStacks": {
      return (
        <Frame title="Stacks">
          <Bars widths={[85, 70, 55, 40, 30]} />
        </Frame>
      );
    }
    case "insightsScatter": {
      return (
        <Frame title="Tokens vs commits">
          <div className="relative h-full border border-hs-ink/15">
            <span className="absolute top-1/3 left-1/4 size-2 bg-hs-navy" />
            <span className="absolute top-1/2 left-1/2 size-2 bg-hs-teal" />
            <span className="absolute top-2/3 left-2/3 size-2 bg-hs-gold" />
          </div>
        </Frame>
      );
    }
    case "insightsLeaderboard":
    case "liveLeaderboard": {
      return (
        <Frame title="Leaderboard">
          <div className="space-y-1.5">
            {["Equipo A", "Equipo B", "Equipo C"].map((name, index) => (
              <div
                key={name}
                className="flex items-center gap-2 border-b border-hs-ink/10 pb-1.5"
              >
                <span className="w-4 font-mono text-[11px] tabular-nums">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold">{name}</span>
              </div>
            ))}
          </div>
        </Frame>
      );
    }
    case "insightsEvolution": {
      return (
        <Frame title="Evolución">
          <Bars widths={[30, 45, 60, 80, 70]} />
        </Frame>
      );
    }
    case "liveCommits": {
      return (
        <Frame title="Commits en vivo">
          <div className="space-y-1.5">
            <span className="block h-8 bg-hs-sand/70" />
            <span className="block h-8 w-5/6 bg-hs-sand/50" />
            <span className="block h-8 w-2/3 bg-hs-sand/40" />
          </div>
        </Frame>
      );
    }
    case "liveAgents": {
      return (
        <Frame title="Agentes activos">
          <div className="flex flex-wrap gap-2">
            {["Claude", "Codex", "Cursor"].map((name) => (
              <span
                key={name}
                className="border border-hs-ink/20 px-2 py-1 text-xs font-semibold"
              >
                {name}
              </span>
            ))}
          </div>
        </Frame>
      );
    }
    case "liveTokens": {
      return (
        <div className="flex h-full flex-col justify-between bg-hs-gold p-3 text-hs-ink">
          <p className="font-bungee text-xs">Tokens</p>
          <p className="font-sans text-4xl font-black tabular-nums">—</p>
        </div>
      );
    }
    case "feed": {
      return (
        <Frame title="Feed">
          <div className="space-y-1.5">
            <span className="block h-12 bg-hs-sand/70" />
            <span className="block h-12 w-5/6 bg-hs-sand/50" />
          </div>
        </Frame>
      );
    }
    case "sponsorGrid": {
      return (
        <SponsorPreview
          names={(widget.sponsors ?? []).map((row) => row.name).filter(Boolean)}
        />
      );
    }
    case "sponsorTicker": {
      const sponsors = (widget.sponsors ?? []).filter((row) => row.name.trim());
      if (sponsors.length === 0) {
        return <SponsorPreview names={[]} />;
      }
      return (
        <SponsorTickerBox
          sponsors={sponsors}
          speed={widget.tickerSpeed}
        />
      );
    }
  }
});

export function widgetLabel(kind: TvWidget["kind"]) {
  return TV_PALETTE.find((item) => item.kind === kind)?.label ?? kind;
}
