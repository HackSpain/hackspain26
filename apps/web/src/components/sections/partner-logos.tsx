import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { shuffled } from "../../lib/shuffle";
import {
  acurioLogo,
  causaPrimaLogo,
  cognitionLogo,
  cursorLogo,
  embatLogo,
  enzoLogo,
  exaLogo,
  falLogo,
  happyrobotLogo,
  invopopLogo,
  jmeLogo,
  karumiLogo,
  kfundLogo,
  kiboLogo,
  maisaLogo,
  onecoworkLogo,
  prosperAiLogo,
  reveniLogo,
  revenuecatLogo,
  theckerLogo,
} from "../theme/assets";
import { P } from "../ui/panel";

export interface Partner {
  alt: string;
  /** Tailwind height class — sets the on-screen logo height. */
  size: string;
  src: string;
}

/** Shared logo height (container query units inside mosaic cells). */
const LOGO_SIZE = "h-[26cqh]";
/** Squarer or wider marks need more height than wordmarks. */
const LARGE_LOGO_SIZE = "h-[44cqh]";
/** Cursor mark reads smaller at the same clamp as OneCoWork. */
const CURSOR_LOGO_SIZE = "h-[54cqh]";
/** Maisa wordmark needs extra height to read at parity with other marks. */
const MAISA_LOGO_SIZE = "h-[52cqh]";
/** Prosper AI wordmark reads small at the default height. */
const PROSPER_AI_LOGO_SIZE = "h-[36cqh]";
/** Kibo's mark is a stacked three-line lockup, so height binds, not width. */
const KIBO_LOGO_SIZE = "h-[48cqh]";
/** Acurio stacks a wordmark over a subtitle. */
const ACURIO_LOGO_SIZE = "h-[38cqh]";
/** Enzo is a chunky script wordmark. */
const ENZO_LOGO_SIZE = "h-[32cqh]";

const LARGE_GRID_HEIGHT = "h-[clamp(2.1rem,10.5vw,4rem)]";
const DEFAULT_GRID_HEIGHT = "h-[clamp(1.75rem,9vw,3.25rem)]";
const CURSOR_GRID_HEIGHT = "h-[clamp(2.5rem,12.5vw,4.75rem)]";
const MAISA_GRID_HEIGHT = "h-[clamp(2.45rem,12vw,4.6rem)]";
const PROSPER_AI_GRID_HEIGHT = "h-[clamp(1.95rem,9.75vw,3.55rem)]";
const LARGE_REEL_HEIGHT = "h-[clamp(1.4rem,6.75vw,2.35rem)]";
const DEFAULT_REEL_HEIGHT = "h-[clamp(1.1rem,5.5vw,1.85rem)]";
const CURSOR_REEL_HEIGHT = "h-[clamp(1.65rem,8vw,2.75rem)]";
const MAISA_REEL_HEIGHT = "h-[clamp(1.6rem,7.75vw,2.7rem)]";
const PROSPER_AI_REEL_HEIGHT = "h-[clamp(1.25rem,6.25vw,2.05rem)]";

// OneCoWork is squarer/wider than wordmarks; Cursor and Maisa need an extra step up.
const LARGE_PARTNER_SRC = new Set([onecoworkLogo.src]);
const CURSOR_PARTNER_SRC = new Set([cursorLogo.src]);
const MAISA_PARTNER_SRC = new Set([maisaLogo.src]);
const PROSPER_AI_PARTNER_SRC = new Set([prosperAiLogo.src]);
/** Kibo's stacked three-line lockup is nearly square, so height binds. */
const STACKED_PARTNER_SRC = new Set([kiboLogo.src]);
/** Acurio (wordmark over subtitle) and Enzo (chunky script) sit in between. */
const MEDIUM_PARTNER_SRC = new Set([acurioLogo.src, enzoLogo.src]);

function partnerGridHeight(src: string): string {
  if (STACKED_PARTNER_SRC.has(src)) {
    return CURSOR_GRID_HEIGHT;
  }
  if (MEDIUM_PARTNER_SRC.has(src)) {
    return PROSPER_AI_GRID_HEIGHT;
  }
  if (CURSOR_PARTNER_SRC.has(src)) {
    return CURSOR_GRID_HEIGHT;
  }
  if (MAISA_PARTNER_SRC.has(src)) {
    return MAISA_GRID_HEIGHT;
  }
  if (PROSPER_AI_PARTNER_SRC.has(src)) {
    return PROSPER_AI_GRID_HEIGHT;
  }
  if (LARGE_PARTNER_SRC.has(src)) {
    return LARGE_GRID_HEIGHT;
  }
  return DEFAULT_GRID_HEIGHT;
}

function partnerReelHeight(src: string): string {
  if (CURSOR_PARTNER_SRC.has(src)) {
    return CURSOR_REEL_HEIGHT;
  }
  if (MAISA_PARTNER_SRC.has(src)) {
    return MAISA_REEL_HEIGHT;
  }
  if (PROSPER_AI_PARTNER_SRC.has(src)) {
    return PROSPER_AI_REEL_HEIGHT;
  }
  if (LARGE_PARTNER_SRC.has(src)) {
    return LARGE_REEL_HEIGHT;
  }
  return DEFAULT_REEL_HEIGHT;
}

// The five track sponsors are named so the tracks section can pin them without
// duplicating their alt text and per-logo sizing.
const HAPPYROBOT: Partner = {
  alt: "HappyRobot — partner de HackSpain",
  size: LOGO_SIZE,
  src: happyrobotLogo.src,
};
const EMBAT: Partner = {
  alt: "Embat — partner de HackSpain",
  size: LOGO_SIZE,
  src: embatLogo.src,
};
const THEKER: Partner = {
  alt: "THEKER Robotics — partner de HackSpain",
  size: LOGO_SIZE,
  src: theckerLogo.src,
};
const PROSPER_AI: Partner = {
  alt: "Prosper AI — partner de HackSpain",
  size: PROSPER_AI_LOGO_SIZE,
  src: prosperAiLogo.src,
};
const MAISA: Partner = {
  alt: "Maisa — partner de HackSpain",
  size: MAISA_LOGO_SIZE,
  src: maisaLogo.src,
};

/** The list order doubles as the rotation order. */
const PARTNERS: Partner[] = [
  {
    alt: "Cursor — partner de HackSpain",
    size: CURSOR_LOGO_SIZE,
    src: cursorLogo.src,
  },
  {
    alt: "fal.ai — partner de HackSpain",
    size: LOGO_SIZE,
    src: falLogo.src,
  },
  {
    alt: "Cognition — partner de HackSpain",
    size: LOGO_SIZE,
    src: cognitionLogo.src,
  },
  HAPPYROBOT,
  // {
  //   alt: "K Fund — partner de HackSpain",
  //   size: LOGO_SIZE,
  //   src: kfundLogo.src,
  // },
  { alt: "Exa — partner de HackSpain", size: LOGO_SIZE, src: exaLogo.src },
  {
    alt: "OneCoWork — partner de HackSpain",
    size: LARGE_LOGO_SIZE,
    src: onecoworkLogo.src,
  },
  EMBAT,
  THEKER,
  PROSPER_AI,
  MAISA,
];

/**
 * The five sponsors backing the tracks. Pinned in place — and frozen — while
 * the tracks section is on screen, so the logo row reads as "these are the
 * track sponsors" rather than a rotating partner wall.
 */
export const TRACK_SPONSORS: Partner[] = [
  MAISA,
  HAPPYROBOT,
  PROSPER_AI,
  EMBAT,
  THEKER,
];

/**
 * The five funds backing the grand prize, pinned the same way on the gran
 * premio section. Deliberately not part of PARTNERS — they back the prize
 * rather than the event, so they never enter the general rotation.
 */
export const GRAND_PRIZE_SPONSORS: Partner[] = [
  {
    alt: "JME Ventures — patrocinador del gran premio de HackSpain",
    size: LOGO_SIZE,
    src: jmeLogo.src,
  },
  {
    alt: "Kfund — patrocinador del gran premio de HackSpain",
    size: LOGO_SIZE,
    src: kfundLogo.src,
  },
  {
    alt: "Kibo Ventures — patrocinador del gran premio de HackSpain",
    size: KIBO_LOGO_SIZE,
    src: kiboLogo.src,
  },
  {
    alt: "Enzo Ventures — patrocinador del gran premio de HackSpain",
    size: ENZO_LOGO_SIZE,
    src: enzoLogo.src,
  },
  {
    alt: "Acurio Ventures — patrocinador del gran premio de HackSpain",
    size: ACURIO_LOGO_SIZE,
    src: acurioLogo.src,
  },
];

/**
 * The five sponsors of comida, bebida y charlas, pinned the same way on the
 * mentores section. Like the grand prize funds, they back that part of the
 * event rather than the event itself, so they stay out of the general
 * rotation.
 */
export const MENTOR_SPONSORS: Partner[] = [
  {
    alt: "RevenueCat — patrocinador de comida, bebida y charlas de HackSpain",
    size: LOGO_SIZE,
    src: revenuecatLogo.src,
  },
  {
    alt: "Reveni — patrocinador de comida, bebida y charlas de HackSpain",
    size: LOGO_SIZE,
    src: reveniLogo.src,
  },
  {
    alt: "Karumi — patrocinador de comida, bebida y charlas de HackSpain",
    size: LOGO_SIZE,
    src: karumiLogo.src,
  },
  {
    alt: "Invopop — patrocinador de comida, bebida y charlas de HackSpain",
    size: LOGO_SIZE,
    src: invopopLogo.src,
  },
  {
    alt: "Causa Prima — patrocinador de comida, bebida y charlas de HackSpain",
    size: LOGO_SIZE,
    src: causaPrimaLogo.src,
  },
];

/** Number of open-row cells (o1..o5) the logos rotate through. */
export const PARTNER_CELL_COUNT = 5;
const SWAP_INTERVAL_MS = 2800;

interface RotationState {
  nextCell: number;
  onScreen: Partner[];
  queue: Partner[];
}

/**
 * Round-robin sliding window over PARTNERS. Each tick the next cell (round
 * robin) swaps its logo for the one waiting at the front of the off-screen
 * queue and sends its own to the back. On-screen logos and the queue always
 * partition PARTNERS, so the same logo can never appear twice at once. Fully
 * deterministic — no randomness, repeats on a fixed cycle.
 *
 * Passing `pinned` shows exactly that list and stops the clock. The rotation
 * state is kept (not reset) while pinned, so unpinning resumes the cycle from
 * where it left off instead of snapping back to the top of PARTNERS.
 *
 * A pinned list is shown in a random order, reshuffled whenever it is handed
 * back in, so no sponsor is permanently first — the fixed order of the
 * unpinned rotation is deliberate, but pinned sponsors are peers.
 */
export function usePartnerRotation(
  count = PARTNER_CELL_COUNT,
  pinned?: Partner[]
): Partner[] {
  const [state, setState] = useState<RotationState>(() => ({
    nextCell: 0,
    onScreen: PARTNERS.slice(0, count),
    queue: PARTNERS.slice(count),
  }));
  const pinnedOrder = useMemo(
    () => (pinned === undefined ? undefined : shuffled(pinned)),
    [pinned]
  );
  const frozen = pinned !== undefined;

  useEffect(() => {
    if (frozen || PARTNERS.length <= count) {
      return;
    }
    const id = setInterval(() => {
      setState((s) => {
        const incoming = s.queue[0];
        if (!incoming) {
          return s;
        }
        const onScreen = [...s.onScreen];
        const outgoing = onScreen[s.nextCell];
        onScreen[s.nextCell] = incoming;
        const queue = outgoing
          ? [...s.queue.slice(1), outgoing]
          : s.queue.slice(1);
        return {
          nextCell: (s.nextCell + 1) % count,
          onScreen,
          queue,
        };
      });
    }, SWAP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [count, frozen]);

  return pinnedOrder ?? state.onScreen;
}

/**
 * Two-column grid of partner logos with round-robin rotation, for mobile
 * sections. With `pinned` it shows that exact list, frozen; an odd final logo
 * spans the row so it centers instead of hanging off to the left.
 */
export function PartnerLogoGrid({ pinned }: { pinned?: Partner[] }) {
  const partners = usePartnerRotation(6, pinned);
  const oddLast = partners.length % 2 === 1;
  return (
    <div className="grid w-full grid-cols-2 gap-6 px-4">
      {partners.map((p, i) => (
        <AnimatePresence initial={false} key={p.src} mode="wait">
          <motion.span
            animate={{ opacity: 1 }}
            aria-label={p.alt}
            className={`block bg-hs-ink/60 ${partnerGridHeight(p.src)} ${
              oddLast && i === partners.length - 1
                ? "col-span-2 mx-auto w-1/2"
                : "w-full"
            }`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="img"
            style={{
              WebkitMaskImage: `url(${p.src})`,
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
              maskImage: `url(${p.src})`,
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "contain",
            }}
            transition={{ duration: 0.3 }}
          />
        </AnimatePresence>
      ))}
    </div>
  );
}

/**
 * Infinite scrolling logo reel for mobile. Renders all logos twice in a flat
 * flex row and uses a CSS translate animation to scroll left continuously —
 * when the first copy exits the left edge, the second copy is already in place,
 * creating a seamless loop. No JS state needed.
 */
export function PartnerLogoReel() {
  const logoRow = PARTNERS.map((p) => (
    <span
      aria-label={p.alt}
      className={`mx-4 block w-[clamp(3.5rem,16vw,6rem)] shrink-0 bg-hs-ink/60 ${partnerReelHeight(p.src)}`}
      key={p.src}
      role="img"
      style={{
        WebkitMaskImage: `url(${p.src})`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskImage: `url(${p.src})`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
      }}
    />
  ));

  return (
    <div aria-hidden className="w-full overflow-hidden">
      <div className="hs-logo-reel flex items-center">
        {logoRow}
        {/* Duplicate for seamless loop */}
        {logoRow}
      </div>
    </div>
  );
}

export function PartnerLogoCell({
  partner,
  delay = 0,
}: {
  partner: Partner;
  /** Staggers this cell's crossfade, so a whole-row swap reads as a wave. */
  delay?: number;
}) {
  // The logos are white silhouettes; mask + bg tints them to the warm brand
  // ink (instead of harsh pure black) and keeps the tint color easy to change.
  return (
    <P bg="bg-hs-paper">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          animate={{ opacity: 1 }}
          aria-label={partner.alt}
          className={`block w-full bg-hs-ink ${partner.size}`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={partner.src}
          role="img"
          style={{
            WebkitMaskImage: `url(${partner.src})`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskImage: `url(${partner.src})`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
          }}
          transition={{ delay, duration: 0.3 }}
        />
      </AnimatePresence>
    </P>
  );
}
