import type { Judge } from "../../data/judges";
import { FINAL_AWARD_JUDGES, GENERAL_JUDGES } from "../../data/judges";
import { OverlayDialog } from "../overlay/overlay-dialog";

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
        {judge.company ? (
          <p className="mt-0.5 font-bold font-sans text-[clamp(0.65rem,1.5vw,0.75rem)] text-hs-brown leading-snug">
            {judge.company}
          </p>
        ) : null}
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
  return (
    <OverlayDialog onClose={onClose} titleId={TITLE_ID}>
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
    </OverlayDialog>
  );
}
