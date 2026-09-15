"use client";

import { useState } from "react";
import {
  TICKER_DURATION,
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
  const rows = sponsors.length > 0 ? sponsors : [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-hs-paper p-3 text-hs-brown">
        <p className="text-sm">
          {editor ? "Doble clic para añadir sponsors" : "Sponsors"}
        </p>
      </div>
    );
  }
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

export function SponsorTickerBox({
  sponsors,
  speed = "normal",
  editor = false,
}: {
  sponsors: TvSponsor[];
  speed?: TvTickerSpeed;
  editor?: boolean;
}) {
  const items = sponsors.length > 0 ? sponsors : [];
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
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
