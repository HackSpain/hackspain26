import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMMUNITY_SECTION_INDEX,
  GRAND_PRIZE_SECTION_INDEX,
  INFRA_SECTION_INDEX,
  MENTORS_SECTION_INDEX,
  pathRootFromSectionIndex,
  TRACKS_SECTION_INDEX,
} from "../../data/section-routes";
import { InlineSvg } from "../media/inline-svg";
import { artboardFor } from "../mosaic/artboard";
import { cellsForProfile } from "../mosaic/cells";
import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { isOverlayOpen } from "../overlay/overlay-lock";
import { CommunityTimeline } from "../sections/community-timeline";
import { illustrationsForSection } from "../sections/illustration-themes";
import {
  GRAND_PRIZE_SPONSORS,
  INFRA_SPONSORS,
  MENTOR_SPONSORS,
  PARTNER_CELL_COUNT,
  PartnerLogoCell,
  TRACK_SPONSORS,
  usePartnerRotation,
} from "../sections/partner-logos";
import { buildSections, buildSectionsCompact } from "../sections/sections";
import { INK, NUM_SECTIONS, SPRING, slideVariants } from "../theme/constants";
import { vp } from "../ui/panel";

const SECTION_NAV = [
  "Inicio",
  "Vuestras historias",
  "Misión",
  "Tracks originales",
  "Infraestructura",
  "Gran premio",
  "Comida, bebida y charlas",
  "Así fue",
] as const;

const REGION_ARIA =
  "HackSpain 2026 — cambia de sección con la rueda del ratón, deslizamiento o flechas";

interface Props {
  initialSection?: number;
}

export function LandingPage({ initialSection = 0 }: Props) {
  const [section, setSection] = useState(initialSection);
  const [dir, setDir] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const locked = useRef(false);
  const stageRef = useRef<HTMLElement>(null);

  const layoutProfile = useLayoutProfile();

  // profile is non-null after the early return below.
  const profile = (layoutProfile ?? "desktop") as NonNullable<
    typeof layoutProfile
  >;

  const artboard = useMemo(() => artboardFor(profile), [profile]);
  const cells = useMemo(() => cellsForProfile(profile), [profile]);

  const sections = useMemo(
    () => (profile === "compact" ? buildSectionsCompact() : buildSections()),
    [profile]
  );
  const ills = useMemo(
    () => illustrationsForSection(section, profile),
    [section, profile]
  );
  // Sponsor-led sections hand the open row to their own partners.
  const pinnedSponsors = useMemo(() => {
    if (section === TRACKS_SECTION_INDEX) {
      return TRACK_SPONSORS;
    }
    if (section === INFRA_SECTION_INDEX) {
      return INFRA_SPONSORS;
    }
    if (section === GRAND_PRIZE_SECTION_INDEX) {
      return GRAND_PRIZE_SPONSORS;
    }
    if (section === MENTORS_SECTION_INDEX) {
      return MENTOR_SPONSORS;
    }
  }, [section]);
  const partners = usePartnerRotation(PARTNER_CELL_COUNT, pinnedSponsors);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const variants = useMemo(
    () =>
      reducedMotion
        ? {
            center: { opacity: 1 },
            enter: { opacity: 0 },
            exit: { opacity: 0 },
          }
        : slideVariants,
    [reducedMotion]
  );

  const goToSection = useCallback(
    (next: number, d: 1 | -1, opts?: { unlockMs?: number }) => {
      if (locked.current) {
        return;
      }
      locked.current = true;
      setDir(d);
      setSection(next);
      const unlockMs = opts?.unlockMs ?? 700;
      setTimeout(() => {
        locked.current = false;
      }, unlockMs);
    },
    []
  );

  useEffect(() => {
    const onEnter = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-enter-hackspain]")
      ) {
        goToSection(COMMUNITY_SECTION_INDEX, 1);
      }
    };
    document.addEventListener("click", onEnter);
    return () => document.removeEventListener("click", onEnter);
  }, [goToSection]);

  const advance = useCallback(
    (d: 1 | -1) => {
      const next = Math.max(0, Math.min(NUM_SECTIONS - 1, section + d));
      if (next === section) {
        return;
      }
      goToSection(next, d);
    },
    [section, goToSection]
  );

  const isCompact = profile === "compact";

  useEffect(() => {
    // A full-screen overlay scrolls its own content, so section snapping — and
    // in particular the wheel preventDefault below — has to stand down.
    const onWheel = (e: WheelEvent) => {
      if (isOverlayOpen() || !stageRef.current?.contains(e.target as Node)) {
        return;
      }
      if (Math.abs(e.deltaY) <= 5) {
        return;
      }
      if (section === NUM_SECTIONS - 1 && e.deltaY > 0) {
        return;
      }
      e.preventDefault();
      advance(e.deltaY > 0 ? 1 : -1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isOverlayOpen() || !stageRef.current?.contains(e.target as Node)) {
        return;
      }
      const movingTowardContent =
        section === NUM_SECTIONS - 1 && touchY > e.touches[0].clientY;
      if (!movingTowardContent) {
        e.preventDefault();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (isOverlayOpen() || !stageRef.current?.contains(e.target as Node)) {
        return;
      }
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) <= 40) {
        return;
      }
      advance(dy > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        isOverlayOpen() ||
        (stageRef.current?.getBoundingClientRect().bottom ?? 0) <= 0
      ) {
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest(
          "button, a, input, textarea, select, video, [contenteditable]"
        )
      ) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        advance(1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        advance(-1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [advance, section]);

  // Render a useful fallback until the viewport-specific mosaic can hydrate.
  if (layoutProfile === null) {
    return (
      <div
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: INK }}
      >
        <p className="font-bungee text-4xl text-hs-gold leading-none">
          HackSpain 2026
        </p>
        <p className="max-w-lg font-bold font-sans text-hs-paper leading-relaxed">
          El hackathon de jóvenes builders celebrado del 18 al 20 de septiembre
          en Madrid.
        </p>
        <a
          className="font-bold font-sans text-hs-paper underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-hs-gold"
          href="#edicion-2026"
        >
          Explorar la edición ↓
        </a>
      </div>
    );
  }

  const baseCurrent = sections[section] ?? {};
  // Partner logos fill any empty open-row cells (o1..o5) on every desktop section.
  // Cells already defined by the section are preserved.
  const current: Record<string, ReactNode> =
    profile === "compact" || section === COMMUNITY_SECTION_INDEX
      ? baseCurrent
      : {
          o1: <PartnerLogoCell delay={0} partner={partners[0]} />,
          o2: <PartnerLogoCell delay={0.05} partner={partners[1]} />,
          o3: <PartnerLogoCell delay={0.1} partner={partners[2]} />,
          o4: <PartnerLogoCell delay={0.15} partner={partners[3]} />,
          o5: <PartnerLogoCell delay={0.2} partner={partners[4]} />,
          ...baseCurrent,
        };
  if (!isCompact && section === INFRA_SECTION_INDEX) {
    // Frame the central headline and copy with all ten infra sponsors.
    for (const id of ["o1", "o2", "o3", "o4", "o5"]) {
      delete current[id];
    }
    const sponsorCells = [
      "r1b",
      "r1c",
      "r1d",
      "r3a",
      "r3b",
      "r4b",
      "r4d",
      "o2",
      "o3",
      "o4",
    ];
    sponsorCells.forEach((id, index) => {
      current[id] = <PartnerLogoCell partner={INFRA_SPONSORS[index]} />;
    });
  }
  const liveLabel = SECTION_NAV[section] ?? SECTION_NAV[0];

  const tileMotionClass = "absolute inset-0";

  const renderIll = (ill: (typeof ills)[number]) =>
    ill.svg || ill.src ? (
      <div
        aria-hidden
        className="pointer-events-none absolute z-10 overflow-hidden"
        key={ill.id}
        style={{
          ...vp(ill.x, ill.y, ill.w, ill.h, artboard),
          ...(ill.clip && !isCompact ? { clipPath: ill.clip } : {}),
        }}
      >
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            animate="center"
            className={`absolute inset-0 flex min-h-0 ${ill.box}`}
            custom={dir}
            exit="exit"
            initial="enter"
            key={`${ill.id}-${section}`}
            transition={
              reducedMotion
                ? { delay: ill.delay * 0.2, duration: 0.2, type: "tween" }
                : { ...SPRING, delay: ill.delay }
            }
            variants={variants}
          >
            {ill.src && (
              <img
                alt=""
                className="h-full w-full object-contain"
                decoding="async"
                height={640}
                src={ill.src}
                width={640}
              />
            )}
            {!ill.src && ill.svg && (
              <InlineSvg
                className={ill.img}
                decorative
                fill={ill.fill}
                svg={ill.svg}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    ) : null;

  const stageContent = (
    <>
      <MosaicBackground
        aria-hidden
        className="absolute inset-0 h-full w-full"
        variant={layoutProfile}
      />

      {!isCompact && ills.map(renderIll)}

      {cells.map((cell) => {
        if (isCompact && !current[cell.id]) {
          return null;
        }

        const mosaicCell = layoutProfile === "compact" ? "" : "hs-mosaic-cell ";
        const cellFrameClass =
          cell.id === "r2c"
            ? `${mosaicCell}absolute z-10 overflow-visible @container`
            : `${mosaicCell}absolute overflow-hidden @container`;

        const cellInner = (
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            {current[cell.id] ? (
              <motion.div
                animate="center"
                className={tileMotionClass}
                custom={dir}
                exit="exit"
                initial="enter"
                key={
                  cell.id.startsWith("o") ? cell.id : `${cell.id}-${section}`
                }
                transition={
                  reducedMotion
                    ? { delay: cell.delay * 0.3, duration: 0.2, type: "tween" }
                    : { ...SPRING, delay: cell.delay }
                }
                variants={variants}
              >
                {current[cell.id]}
              </motion.div>
            ) : null}
          </AnimatePresence>
        );

        return (
          <div
            className={cellFrameClass}
            key={cell.id}
            style={{
              ...vp(cell.x, cell.y, cell.w, cell.h, artboard),
              ...(cell.clip ? { clipPath: cell.clip } : {}),
            }}
          >
            {cellInner}
          </div>
        );
      })}

      <MosaicBackground
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        strokeOnly
        variant={layoutProfile}
      />
      <CommunityTimeline
        isActive={section === COMMUNITY_SECTION_INDEX}
        onNext={() => advance(1)}
        onPrevious={() => advance(-1)}
        reducedMotion={reducedMotion}
      />
    </>
  );

  return (
    <section
      aria-label={REGION_ARIA}
      className="relative min-h-0 w-full flex-1 font-sans"
      ref={stageRef}
      style={{ background: INK }}
    >
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {liveLabel}
      </p>
      <div className="absolute inset-0 overflow-hidden">{stageContent}</div>
      <a
        className="absolute right-3 bottom-28 z-30 border border-hs-paper/30 bg-hs-ink px-4 py-3 font-extrabold font-sans text-hs-paper text-sm underline underline-offset-4 hover:text-hs-gold focus-visible:outline-2 focus-visible:outline-hs-gold focus-visible:outline-offset-2"
        href={`${pathRootFromSectionIndex(section)}#edicion-2026`}
      >
        Leer sobre la edición ↓
      </a>
      {section === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(2.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center">
          <button
            aria-label="Abrir HackSpain — ver el vídeo y la comunidad"
            className="pointer-events-auto flex min-h-11 items-center gap-3 rounded-full border border-hs-paper/20 bg-hs-ink px-5 py-2.5 font-bungee text-hs-paper text-xs tracking-[0.18em] shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-hs-gold focus-visible:outline-offset-4 active:scale-[0.96] motion-reduce:transition-none"
            onClick={() => advance(1)}
            type="button"
          >
            SCROLL
            <svg
              aria-hidden="true"
              className="h-7 w-5 shrink-0 text-hs-gold"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 20 28"
            >
              <rect height="25" rx="8.5" width="17" x="1.5" y="1.5" />
              <motion.path
                animate={
                  reducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: [0, 1, 1, 0], y: [0, 0, 7, 7] }
                }
                d="M10 7v4"
                initial={{ opacity: 1, y: 0 }}
                strokeWidth="3"
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        duration: 1.8,
                        ease: "easeInOut",
                        repeat: Number.POSITIVE_INFINITY,
                        repeatDelay: 0.4,
                        times: [0, 0.15, 0.7, 1],
                      }
                }
              />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
