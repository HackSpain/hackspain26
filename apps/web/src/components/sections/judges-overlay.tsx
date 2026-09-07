import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Judge } from "../../data/judges";
import { FINAL_AWARD_JUDGES, GENERAL_JUDGES } from "../../data/judges";
import { useOverlayLock } from "../overlay/overlay-lock";

const TITLE_ID = "judges-overlay-title";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter((w) => w[0] === w[0]?.toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function JudgeCard({ judge }: { judge: Judge }) {
  return (
    <article
      className="flex h-full flex-col border-[3px] border-hs-ink bg-hs-paper"
      id={judge.id}
    >
      {judge.photoSrc ? (
        <img
          alt={`Retrato de ${judge.name}`}
          className="aspect-square w-full border-hs-ink border-b-[3px] object-cover"
          height={400}
          loading="lazy"
          src={judge.photoSrc}
          width={400}
        />
      ) : (
        <div
          aria-hidden
          className="flex aspect-square w-full items-center justify-center border-hs-ink border-b-[3px] bg-hs-gold"
        >
          <span className="font-bungee text-[clamp(1.6rem,5vw,2.6rem)] text-hs-ink">
            {initialsOf(judge.name)}
          </span>
        </div>
      )}
      <div className="grow px-2.5 py-2.5 sm:px-3 sm:py-3">
        {/* Reserve two lines so one- and two-line names produce equal cards. */}
        <h4 className="min-h-[2.5em] font-bungee text-[clamp(0.7rem,1.7vw,0.85rem)] text-hs-ink leading-tight">
          {judge.name}
        </h4>
        <p className="mt-0.5 font-bold font-sans text-[clamp(0.65rem,1.5vw,0.75rem)] text-hs-brown leading-snug">
          {judge.company}
        </p>
      </div>
    </article>
  );
}

function JudgeGroup({
  accent,
  accentColor,
  judges,
}: {
  /** Word after "JURADO", colored differently per category. */
  accent: string;
  accentColor: string;
  judges: Judge[];
}) {
  return (
    <section className="mt-10 sm:mt-12">
      <h3 className="text-center font-bungee text-[clamp(1.1rem,3.5vw,1.7rem)] text-hs-paper leading-none">
        JURADO <span className={accentColor}>{accent}</span>
      </h3>
      {/* Flex (not grid) so a partial last row centers — 5 per row on desktop. */}
      <div className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-4">
        {judges.map((j) => (
          <div
            className="w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
            key={j.id}
          >
            <JudgeCard judge={j} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Full-screen scrollable overlay behind the "Ver jurado" button on the gran
 * premio section, listing both judging panels (data/judges.ts). Same shell as
 * TracksOverlay: scrolls itself rather than the page and uses useOverlayLock
 * so the section-snapping wheel/swipe/key handlers stand down while it is open.
 */
export function JudgesOverlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useOverlayLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal to <body>: the mosaic cells animate with transforms, and a
  // transformed ancestor turns position:fixed into "fixed to that ancestor",
  // clipping the overlay to its cell (visible on mobile).
  return createPortal(
    <div
      aria-labelledby={TITLE_ID}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-hs-ink/97"
      role="dialog"
    >
      <button
        aria-label="Cerrar"
        className="fixed top-4 right-4 z-10 border-[3px] border-hs-paper/40 bg-hs-ink px-3 pb-1 font-bungee text-3xl text-hs-paper/70 leading-none hover:border-hs-paper hover:text-hs-paper focus-visible:border-hs-gold focus-visible:outline-none sm:top-6 sm:right-8"
        onClick={onClose}
        ref={closeRef}
        type="button"
      >
        ×
      </button>

      <div className="mx-auto max-w-4xl px-3 py-10 sm:px-4 sm:py-16">
        <header className="text-center">
          <p className="font-bungee text-[clamp(0.6rem,1.8vw,0.8rem)] text-hs-gold tracking-widest">
            HACKSPAIN 2026
          </p>
          <h2
            className="mt-2 font-bungee text-[clamp(1.8rem,7vw,3.5rem)] text-hs-paper leading-none"
            id={TITLE_ID}
          >
            EL <span className="text-hs-gold">JURADO</span>
          </h2>
        </header>

        <JudgeGroup
          accent="FINAL"
          accentColor="text-hs-gold"
          judges={FINAL_AWARD_JUDGES}
        />

        <JudgeGroup
          accent="GENERAL"
          accentColor="text-hs-orange"
          judges={GENERAL_JUDGES}
        />
      </div>
    </div>,
    document.body
  );
}
