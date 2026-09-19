"use client";

import { useState } from "react";
import {
  TICKER_DURATION,
  resolveTvSponsors,
  sponsorLogoSources,
  type TvSponsor,
  type TvTickerSpeed,
} from "@/lib/tv";
import { cn } from "@/lib/utils";
import { usePageVisible, usePrefersReducedMotion } from "./motion";

const TIER_LABEL: Record<TvSponsor["tier"], string> = {
  gold: "Gold",
  silver: "Silver",
  community: "Community",
};

function SponsorLogo({
  sources,
  name,
  editor,
}: {
  sources: string[];
  name: string;
  editor?: boolean;
}) {
  const [failed, setFailed] = useState(0);
  const src = sources[failed];
  if (!src) {
    return <span className="font-bungee text-sm uppercase">{name}</span>;
  }
  return (
    <>
      {/* External sponsor URLs; next/image would need a remote pattern per host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          "h-8 w-auto max-w-24 object-contain outline outline-1 -outline-offset-1 outline-black/10",
          src.startsWith("/sponsors/") && "brightness-0",
          editor &&
            "grayscale motion-safe:transition-[filter] motion-safe:duration-150 group-hover:grayscale-0",
        )}
        onError={() => setFailed((count) => count + 1)}
      />
      <span className="text-xs font-semibold">{name}</span>
    </>
  );
}

function SponsorMark({
  sponsor,
  editor,
}: {
  sponsor: TvSponsor;
  editor?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <SponsorLogo
        key={`${sponsor.logoUrl}|${sponsor.href}`}
        sources={sponsorLogoSources(sponsor)}
        name={sponsor.name}
        editor={editor}
      />
    </span>
  );
}

export function SponsorGridBox({
  sponsors,
  editor = false,
}: {
  sponsors: TvSponsor[];
  editor?: boolean;
}) {
  const rows = resolveTvSponsors(sponsors);
  return (
    <div className="grid h-full grid-cols-2 content-start gap-2 bg-hs-paper p-3 text-hs-ink sm:grid-cols-3">
      {rows.map((sponsor) => (
        <div
          key={`${sponsor.name}-${sponsor.href}`}
          className="flex flex-col justify-center border-[3px] border-hs-ink/15 px-2 py-2"
        >
          <SponsorMark sponsor={sponsor} editor={editor} />
          <p className="mt-1 text-[10px] text-hs-brown">
            {TIER_LABEL[sponsor.tier]}
            {sponsor.href ? ` · ${sponsor.href.replace(/^https?:\/\//, "")}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * The v1 panel strip: label, black logos on paper, no names.
 */
function SponsorLogoStrip({
  items,
  speed,
  reduced,
  visible,
}: {
  items: TvSponsor[];
  speed: TvTickerSpeed;
  reduced: boolean;
  visible: boolean;
}) {
  const logos = (copy: number) =>
    items.map((sponsor) => (
      <span
        key={`${copy}-${sponsor.name}`}
        className="flex h-full shrink-0 items-center px-[1.6cqw]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="h-[45%] w-auto max-w-[8cqw] object-contain brightness-0"
        />
      </span>
    ));
  return (
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] gap-[0.3cqw] bg-hs-ink">
      <p className="flex items-center bg-hs-orange px-[1.2cqw] font-bungee text-[clamp(0.7rem,1.1cqw,1.5rem)] uppercase text-hs-paper">
        Patrocinan
      </p>
      <div className="flex min-w-0 overflow-hidden bg-hs-paper">
        {reduced ? (
          <div className="flex h-full w-full items-center justify-around">{logos(0)}</div>
        ) : (
          <div
            className="tv-ticker flex h-full w-max"
            style={{
              animationDuration: TICKER_DURATION[speed],
              animationPlayState: visible ? "running" : "paused",
            }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex h-full shrink-0">
                {logos(copy)}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="flex flex-col items-center justify-center bg-hs-navy px-[1.2cqw] leading-none text-hs-paper">
        <span className="text-[clamp(0.45rem,0.6cqw,0.8rem)] font-bold tracking-[0.12em] uppercase">
          Powered by
        </span>
        <span className="mt-[0.3cqw] font-bungee text-[clamp(0.7rem,1.1cqw,1.5rem)]">RawTree</span>
      </p>
    </div>
  );
}

export function SponsorTickerBox({
  sponsors,
  speed = "normal",
  editor = false,
  logosOnly = false,
}: {
  sponsors: TvSponsor[];
  speed?: TvTickerSpeed;
  editor?: boolean;
  logosOnly?: boolean;
}) {
  const items = resolveTvSponsors(sponsors);
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  if (logosOnly) {
    return <SponsorLogoStrip items={items} speed={speed} reduced={reduced} visible={visible} />;
  }
  if (reduced) {
    return (
      <div className="flex h-full flex-wrap items-center gap-6 overflow-hidden bg-hs-gold px-4">
        {items.map((sponsor) => (
          <SponsorMark key={sponsor.name} sponsor={sponsor} editor={editor} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-full items-center overflow-hidden bg-hs-gold",
        editor && "group",
      )}
    >
      <div
        className="tv-ticker flex w-max group-hover:[animation-play-state:paused]"
        style={{
          animationDuration: TICKER_DURATION[speed],
          animationPlayState: visible ? "running" : "paused",
        }}
      >
        {[0, 1].map((copy) => (
          <p
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center whitespace-nowrap font-bungee text-[clamp(0.9rem,2.4cqw,1.8rem)] text-hs-ink uppercase"
          >
            {items.map((sponsor) => (
              <span key={`${copy}-${sponsor.name}`} className="inline-flex items-center px-8">
                <SponsorMark sponsor={sponsor} editor={editor} />
                <span aria-hidden className="ml-3">
                  ✦
                </span>
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
