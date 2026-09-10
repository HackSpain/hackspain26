import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Mentor } from "../../data/mentors";
import { MENTORS } from "../../data/mentors";
import { useOverlayLock } from "../overlay/overlay-lock";

const TITLE_ID = "mentors-overlay-title";

/** Logos are silhouettes; mask + bg tints them to the ink brand color. */
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

function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <article
      className="flex flex-col border-[3px] border-hs-ink bg-hs-paper"
      id={mentor.id}
    >
      <img
        alt={`Retrato de ${mentor.name}`}
        className="aspect-square w-full border-hs-ink border-b-[3px] object-cover"
        height={400}
        loading="lazy"
        src={mentor.photoSrc}
        width={400}
      />
      <div className="flex grow flex-col px-3 py-3 sm:px-4 sm:py-4">
        <h3 className="font-bungee text-[clamp(0.85rem,2vw,1.05rem)] text-hs-ink leading-tight">
          {mentor.name}
        </h3>
        <p className="mt-1 font-bold font-sans text-[clamp(0.7rem,1.7vw,0.85rem)] text-hs-brown leading-snug">
          {mentor.role}
        </p>
        <p className="mt-2 mb-3 font-sans font-semibold text-[clamp(0.75rem,1.8vw,0.9rem)] text-hs-ink leading-snug">
          {mentor.description}
        </p>
        {mentor.company && mentor.companyLogoSrc ? (
          <span
            aria-label={mentor.company}
            className={`mt-auto block w-full max-w-[7.5rem] bg-hs-ink/70 ${
              mentor.logoHeight ?? "h-[clamp(0.9rem,2vw,1.15rem)]"
            }`}
            role="img"
            style={logoMaskStyle(mentor.companyLogoSrc)}
          />
        ) : null}
      </div>
    </article>
  );
}

/**
 * Full-screen scrollable overlay behind the "Ver mentores" button, listing the
 * confirmed fundadores y mentores (data/mentors.ts). Same shell as
 * TracksOverlay: scrolls itself rather than the page and uses useOverlayLock
 * so the section-snapping wheel/swipe/key handlers stand down while it is open.
 */
export function MentorsOverlay({ onClose }: { onClose: () => void }) {
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
            FUNDADORES
            <br />
            <span className="text-hs-gold">Y MENTORES</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans font-semibold text-[clamp(0.9rem,2.2vw,1.1rem)] text-hs-paper/80 leading-snug">
            Estarán contigo durante el fin de semana: fundadores, operadores e
            ingenieros de las mejores compañías del ecosistema.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          {MENTORS.map((m) => (
            <MentorCard key={m.id} mentor={m} />
          ))}
        </div>

        <p className="mt-10 text-center font-sans font-semibold text-hs-paper/50 text-xs leading-snug sm:text-sm">
          Y más mentores muy pronto.
        </p>
      </div>
    </div>,
    document.body
  );
}
