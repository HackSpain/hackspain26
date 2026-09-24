import { useMemo } from "react";
import type { TrackSponsor } from "../../data/track-sponsors";
import { TRACK_SPONSORS_DETAIL } from "../../data/track-sponsors";
import { shuffled } from "../../lib/shuffle";
import { OverlayDialog } from "../overlay/overlay-dialog";
import { hsButtonClass } from "../ui/button-styles";

const TITLE_ID = "tracks-overlay-title";

/** Logos are white silhouettes; mask + bg tints them to any brand color. */
function logoMaskStyle(src: string): React.CSSProperties {
  return {
    WebkitMaskImage: `url(${src})`,
    WebkitMaskPosition: "left center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskImage: `url(${src})`,
    maskPosition: "left center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
  };
}

function SponsorCard({ sponsor }: { sponsor: TrackSponsor }) {
  return (
    <article className="border-[3px] border-hs-ink bg-hs-paper" id={sponsor.id}>
      <header
        className={`flex flex-wrap items-center justify-between gap-4 border-hs-ink border-b-[3px] px-4 py-4 sm:px-6 ${sponsor.accent}`}
      >
        <span
          aria-label={sponsor.name}
          className={`block w-[clamp(7rem,22vw,11rem)] ${sponsor.logoHeight} ${
            sponsor.accentText === "text-hs-ink" ? "bg-hs-ink" : "bg-hs-paper"
          }`}
          role="img"
          style={logoMaskStyle(sponsor.logoSrc)}
        />
        <span
          className={`flex shrink-0 items-baseline gap-1.5 border-[3px] px-3 py-1 ${
            sponsor.accentText === "text-hs-ink"
              ? "border-hs-ink bg-hs-paper"
              : "border-hs-paper bg-hs-ink"
          }`}
        >
          <span
            className={`font-bungee text-[clamp(0.9rem,2.4vw,1.15rem)] leading-none ${
              sponsor.accentText === "text-hs-ink"
                ? "text-hs-ink"
                : "text-hs-gold"
            }`}
          >
            {sponsor.raised}
          </span>
          <span
            className={`font-bungee text-[0.55rem] tracking-wide ${
              sponsor.accentText === "text-hs-ink"
                ? "text-hs-brown"
                : "text-hs-paper/60"
            }`}
          >
            LEVANTADOS
          </span>
        </span>
      </header>

      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <h3 className="font-bungee text-[clamp(1.1rem,3vw,1.5rem)] text-hs-ink leading-tight">
          {sponsor.name}
        </h3>
        <p className="mt-1 font-bold font-sans text-[clamp(0.8rem,2vw,0.95rem)] text-hs-brown leading-snug">
          {sponsor.tagline}
        </p>
        <p className="mt-3 font-sans font-semibold text-[clamp(0.85rem,2vw,1rem)] text-hs-ink leading-relaxed">
          {sponsor.description}
        </p>
        <a
          aria-label={`Ver ofertas de empleo en ${sponsor.name} (se abre en una pestaña nueva)`}
          className={hsButtonClass("gold", "compact", "mt-5")}
          href={sponsor.careersUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Trabaja con ellos →
        </a>
      </div>
    </article>
  );
}

/**
 * Full-screen scrollable overlay listing the five startups behind the tracks.
 * Scrolls itself rather than the page — the landing page is fixed to the
 * viewport — and uses useOverlayLock so the section-snapping wheel/swipe/key
 * handlers stand down while it is open.
 */
export function TracksOverlay({ onClose }: { onClose: () => void }) {
  // Reshuffled on every open — the cards are peers, so none of the five should
  // always lead. Safe to randomize at render time: the overlay only ever mounts
  // client-side, after a click, so there is no SSR order to mismatch.
  const sponsors = useMemo(() => shuffled(TRACK_SPONSORS_DETAIL), []);

  return (
    <OverlayDialog onClose={onClose} titleId={TITLE_ID} width="max-w-3xl">
      <header className="text-center">
        <p className="font-bungee text-[clamp(0.6rem,1.8vw,0.8rem)] text-hs-gold tracking-widest">
          HACKSPAIN 2026
        </p>
        <h2
          className="mt-2 font-bungee text-[clamp(1.8rem,7vw,3.5rem)] text-hs-paper leading-none"
          id={TITLE_ID}
        >
          5 TRACKS,
          <br />
          <span className="text-hs-gold">5 STARTUPS</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-sans font-semibold text-[clamp(0.9rem,2.2vw,1.1rem)] text-hs-paper/80 leading-snug">
          Cada track lo trae una de las startups que están definiendo el
          ecosistema español. Estos fueron los equipos que acompañaron a los participantes
          de HackSpain 2026.
        </p>
      </header>

      <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
        {sponsors.map((s) => (
          <SponsorCard key={s.id} sponsor={s} />
        ))}
      </div>

      <p className="mt-10 text-center font-sans font-semibold text-hs-paper/50 text-xs leading-snug sm:text-sm">
        Conoce las startups y la edición de 2026 en la página de tracks.
      </p>
    </OverlayDialog>
  );
}
