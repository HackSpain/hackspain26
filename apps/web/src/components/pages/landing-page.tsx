import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  keywordsForSectionIndex,
  seoForSectionIndex,
} from "../../data/landing-meta";
import {
  GRAND_PRIZE_SECTION_INDEX,
  MENTORS_SECTION_INDEX,
  parsePath,
  pathRootFromSectionIndex,
  TRACKS_SECTION_INDEX,
} from "../../data/section-routes";
import { InlineSvg } from "../media/inline-svg";
import { artboardFor } from "../mosaic/artboard";
import { cellsForProfile } from "../mosaic/cells";
import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { isOverlayOpen } from "../overlay/overlay-lock";
import { useReferralAwareHref } from "../referral/use-referral-href";
import { illustrationsForSection } from "../sections/illustration-themes";
import {
  GRAND_PRIZE_SPONSORS,
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
  "Misión",
  "Tracks originales",
  "Gran premio",
  "Comida, bebida y charlas",
  "Apúntate",
] as const;

const REGION_ARIA =
  "HackSpain 2026 — cambia de sección con la rueda del ratón, deslizamiento o flechas";

function applySeoToDocument(sectionIdx: number) {
  if (typeof document === "undefined") {
    return;
  }
  const { title, description, ogImageAlt } = seoForSectionIndex(sectionIdx);
  const keywords = keywordsForSectionIndex(sectionIdx);
  document.title = title;
  document.documentElement.lang = "es";
  const setMeta = (sel: string, attr: string, val: string) => {
    const el = document.querySelector(sel);
    if (el) {
      el.setAttribute(attr, val);
    }
  };
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[name="keywords"]', "content", keywords);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  const path = pathRootFromSectionIndex(sectionIdx);
  const pageUrl = `${window.location.origin}${path}`;
  setMeta('meta[property="og:url"]', "content", pageUrl);
  setMeta('meta[property="og:image:alt"]', "content", ogImageAlt);
  setMeta('meta[property="og:locale"]', "content", "es_ES");
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image:alt"]', "content", ogImageAlt);
  const link = document.querySelector('link[rel="canonical"]');
  if (link) {
    link.setAttribute("href", pageUrl);
  }
}

interface Props {
  initialSection?: number;
}

export function LandingPage({ initialSection = 0 }: Props) {
  const [section, setSection] = useState(initialSection);
  const [dir, setDir] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const locked = useRef(false);

  const layoutProfile = useLayoutProfile();

  // profile is non-null after the early return below.
  const profile = (layoutProfile ?? "desktop") as NonNullable<
    typeof layoutProfile
  >;

  const artboard = useMemo(() => artboardFor(profile), [profile]);
  const cells = useMemo(() => cellsForProfile(profile), [profile]);
  const signupHref = useReferralAwareHref("/signup");

  const sections = useMemo(
    () =>
      profile === "compact"
        ? buildSectionsCompact(signupHref)
        : buildSections(signupHref),
    [profile, signupHref]
  );
  const ills = useMemo(
    () => illustrationsForSection(section, profile),
    [section, profile]
  );
  // The tracks, gran premio, and mentores sections each hand the open row over
  // to their own five sponsors and hold it there; everywhere else it rotates
  // through all partners.
  const pinnedSponsors = useMemo(() => {
    if (section === TRACKS_SECTION_INDEX) {
      return TRACK_SPONSORS;
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
    applySeoToDocument(initialSection);
  }, [initialSection]);

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
      const path = pathRootFromSectionIndex(next);
      if (typeof window !== "undefined" && window.location.pathname !== path) {
        window.history.pushState({ section: next }, "", path);
      }
      applySeoToDocument(next);
      const unlockMs = opts?.unlockMs ?? 700;
      setTimeout(() => {
        locked.current = false;
      }, unlockMs);
    },
    []
  );

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
      if (isOverlayOpen()) {
        return;
      }
      e.preventDefault();
      if (Math.abs(e.deltaY) <= 5) {
        return;
      }
      advance(e.deltaY > 0 ? 1 : -1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (isOverlayOpen()) {
        return;
      }
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) <= 40) {
        return;
      }
      advance(dy > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isOverlayOpen()) {
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
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [advance]);

  useEffect(() => {
    const onPop = () => {
      locked.current = false;
      const parsed = parsePath(window.location.pathname);
      setDir(1);
      setSection(parsed.sectionIndex);
      applySeoToDocument(parsed.sectionIndex);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // All hooks are above this line. Show a plain ink screen while the viewport
  // size is being determined — avoids showing the desktop layout on mobile.
  if (layoutProfile === null) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: INK }}
      >
        <div className="flex items-end gap-1 font-bungee text-4xl text-hs-gold leading-none">
          <span>LOADING</span>
          <span style={{ animation: "hs-blink 1.2s ease-in-out 0ms infinite" }}>
            .
          </span>
          <span
            style={{ animation: "hs-blink 1.2s ease-in-out 400ms infinite" }}
          >
            .
          </span>
          <span
            style={{ animation: "hs-blink 1.2s ease-in-out 800ms infinite" }}
          >
            .
          </span>
        </div>
      </div>
    );
  }

  const baseCurrent = sections[section] ?? {};
  // Partner logos fill any empty open-row cells (o1..o5) on every desktop section.
  // Cells already defined by the section are preserved.
  const current =
    profile === "compact"
      ? baseCurrent
      : {
          o1: <PartnerLogoCell delay={0} partner={partners[0]} />,
          o2: <PartnerLogoCell delay={0.05} partner={partners[1]} />,
          o3: <PartnerLogoCell delay={0.1} partner={partners[2]} />,
          o4: <PartnerLogoCell delay={0.15} partner={partners[3]} />,
          o5: <PartnerLogoCell delay={0.2} partner={partners[4]} />,
          ...baseCurrent,
        };
  const liveLabel = SECTION_NAV[section] ?? SECTION_NAV[0];

  const tileMotionClass = "absolute inset-0";

  const renderIll = (ill: (typeof ills)[number]) =>
    ill.svg ? (
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
            <InlineSvg
              className={ill.img}
              decorative
              fill={ill.fill}
              svg={ill.svg}
            />
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
    </>
  );

  return (
    <section
      aria-label={REGION_ARIA}
      className="fixed inset-0 font-sans"
      style={{ background: INK }}
    >
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {liveLabel}
      </p>
      <div className="absolute inset-0 overflow-hidden">{stageContent}</div>
    </section>
  );
}
