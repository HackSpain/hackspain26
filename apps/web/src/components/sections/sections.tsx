import { Fragment, useState } from "react";
import { HACKSPAIN_SOCIAL_URLS } from "../../data/landing-meta";
import { areSignupsClosed } from "../../data/signup-deadline";
import { InlineSvg } from "../media/inline-svg";
import { ParticipantsCountUp } from "../media/participants-count-up";
import { SignupCountdown } from "../media/signup-countdown";
import {
  MOSAIC_BD,
  MOSAIC_DISPLAY,
  MOSAIC_FOOTER,
  MOSAIC_FOOTER_SM,
  MOSAIC_HEADLINE,
  MOSAIC_HEADLINE_SM,
  MOSAIC_HERO_LG,
  MOSAIC_LBL,
} from "../mosaic/mosaic-typography";
import {
  exponentialLogo,
  horseSvg,
  logoSvg,
  trophySvg,
  upmLogo,
  windmillSvg,
} from "../theme/assets";
import { GITHUB_SVG, INSTAGRAM_SVG, X_SVG } from "../theme/constants";
import { Button, ButtonLink } from "../ui/button";
import { P } from "../ui/panel";
import { JudgesOverlay } from "./judges-overlay";
import { MentorsOverlay } from "./mentors-overlay";
import {
  GRAND_PRIZE_SPONSORS,
  MENTOR_SPONSORS,
  PartnerLogoGrid,
  PartnerLogoReel,
  TRACK_SPONSORS,
} from "./partner-logos";
import { TracksOverlay } from "./tracks-overlay";

const B = "font-bungee";
const D = "font-sans";
const LBL = `${MOSAIC_LBL} mb-1`;
const BD = MOSAIC_BD;

const BOTTOM_CELLS = ["r5a", "r5b", "r5c", "r5d"] as const;

function MadeByCredit({
  className,
  copyright = false,
}: {
  className?: string;
  copyright?: boolean;
}) {
  return (
    <p className={className}>
      Hecho con ♥ por{" "}
      <a
        className="underline underline-offset-2"
        href="https://x.com/disamdev"
        rel="noopener noreferrer"
        target="_blank"
      >
        Samu
      </a>
      {" y "}
      <a
        className="underline underline-offset-2"
        href="https://x.com/mrloldev"
        rel="noopener noreferrer"
        target="_blank"
      >
        Leo
      </a>
      {copyright ? (
        <span className="text-hs-ink/40"> · © 2026 HackSpain</span>
      ) : null}
    </p>
  );
}

function bottomRow(sectionIdx: number): Record<string, React.ReactNode> {
  const copyEl = (
    <P bg="bg-hs-paper">
      <p
        className={`${D} text-center font-bold text-hs-ink/40 text-sm uppercase tracking-widest`}
      >
        © 2026 HackSpain
      </p>
    </P>
  );

  const actions: React.ReactNode[] = [
    <Fragment key="footer-social">
      <P bg="bg-hs-paper">
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-hs-ink sm:gap-3">
          <a
            aria-label="HackSpain en X (@hackspain26)"
            className="flex h-5 w-5 shrink-0 items-center justify-center"
            href={HACKSPAIN_SOCIAL_URLS.x}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              className="h-5 w-5"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG strings from ./constants
              dangerouslySetInnerHTML={{ __html: X_SVG }}
            />
          </a>
          <a
            aria-label="HackSpain en Instagram (@hackspain26)"
            className="flex h-5 w-5 shrink-0 items-center justify-center"
            href={HACKSPAIN_SOCIAL_URLS.instagram}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              className="h-5 w-5"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG strings from ./constants
              dangerouslySetInnerHTML={{ __html: INSTAGRAM_SVG }}
            />
          </a>
          <a
            className={`${D} ${MOSAIC_FOOTER} font-bold underline underline-offset-2`}
            href={HACKSPAIN_SOCIAL_URLS.x}
            rel="noopener noreferrer"
            target="_blank"
          >
            @hackspain26
          </a>
        </div>
      </P>
    </Fragment>,
    <Fragment key="footer-github">
      <P bg="bg-hs-paper">
        <div className="flex flex-col items-center gap-1 text-center text-hs-ink">
          <div
            className={`flex items-center justify-center gap-2 ${D} ${MOSAIC_FOOTER} font-black`}
          >
            <span
              aria-hidden
              className="h-5 w-5 shrink-0"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG strings from ./constants
              dangerouslySetInnerHTML={{ __html: GITHUB_SVG }}
            />
            <span>
              Esta página web es{" "}
              <a
                className="underline underline-offset-2"
                href={HACKSPAIN_SOCIAL_URLS.github}
                rel="noopener noreferrer"
                target="_blank"
              >
                open source
              </a>
            </span>
          </div>
        </div>
      </P>
    </Fragment>,
    <Fragment key="footer-email">
      <P bg="bg-hs-paper">
        <a
          className={`${D} ${MOSAIC_FOOTER} font-bold text-hs-ink underline underline-offset-2`}
          href="mailto:contact@hackspain.com"
        >
          contact@hackspain.com
        </a>
      </P>
    </Fragment>,
  ];

  const i = sectionIdx % actions.length;
  const actionCell = BOTTOM_CELLS[i];
  const copyCell = BOTTOM_CELLS[(i + 2) % BOTTOM_CELLS.length];

  return { [actionCell]: actions[i], [copyCell]: copyEl };
}

// Compact (mobile) typography — viewport-based, unchanged from original layout.
const CH = `${B} leading-tight`;
const CLBL = `${D} text-[clamp(0.7rem,3vw,1rem)] font-black uppercase tracking-widest`;
const CBD = `${D} text-[clamp(0.95rem,4vw,1.6rem)] font-semibold leading-snug`;
const CARD = "!gap-2 !p-4";
// Card variant that hosts a faint decorative illustration behind the text.
const CARDART = `${CARD} relative isolate overflow-hidden`;

function cardArt(svg: string, corner: "tl" | "br") {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -z-10 aspect-square h-[55%] opacity-50 ${
        corner === "tl" ? "top-2 left-2" : "right-2 bottom-2"
      }`}
    >
      <InlineSvg className="h-full w-full" decorative svg={svg} />
    </span>
  );
}

/**
 * Last-section hero: "INSCRIPCIÓN ABIERTA" while applications are open,
 * "EMPIEZA EN" once they close so the cell frames the event countdown.
 */
function SignupHeroTitle({ compact = false }: { compact?: boolean }) {
  if (areSignupsClosed()) {
    return compact ? (
      <>
        EMPIEZA <span className="text-hs-gold">EN</span>
      </>
    ) : (
      <>
        EMPIEZA
        <br />
        <span className="text-hs-gold">EN</span>
      </>
    );
  }

  return compact ? (
    <>
      INSCRIPCIÓN <span className="text-hs-gold">ABIERTA</span>
    </>
  ) : (
    <>
      INSCRIPCIÓN
      <br />
      <span className="text-hs-gold">ABIERTA</span>
    </>
  );
}

/**
 * Signup CTA while applications are open. Once they close, renders nothing —
 * the event countdown takes its place instead of a disabled "closed" button.
 */
function SignupCta({
  ariaLabel,
  className,
  href,
  label,
}: {
  ariaLabel: string;
  className?: string;
  href: string;
  label: string;
}) {
  if (areSignupsClosed()) {
    return null;
  }

  return (
    <ButtonLink
      aria-label={ariaLabel}
      className={className}
      href={href}
      size="compact"
      variant="gold"
    >
      {label}
    </ButtonLink>
  );
}

function TracksInfoModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="Ver los tracks y las startups de HackSpain"
        className="shrink-0"
        onClick={() => setOpen(true)}
        size="compact"
        variant="gold"
      >
        Ver tracks
      </Button>

      {open && <TracksOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function JudgesInfoModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="Ver el jurado de HackSpain"
        className="shrink-0"
        onClick={() => setOpen(true)}
        size="compact"
        variant="gold"
      >
        Ver jurado
      </Button>

      {open && <JudgesOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function MentorsInfoModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="Ver los fundadores y mentores de HackSpain"
        className="shrink-0"
        onClick={() => setOpen(true)}
        size="compact"
        variant="gold"
      >
        Ver mentores
      </Button>

      {open && <MentorsOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

export function buildSections(
  signupHref = "/signup"
): Record<string, React.ReactNode>[] {
  return [
    {
      hero: (
        <P bg="bg-hs-paper">
          <InlineSvg
            className="h-auto w-full max-w-[380px]"
            label="HackSpain 2026"
            svg={logoSvg}
          />
        </P>
      ),
      r3a: (
        <P bg="bg-hs-orange">
          <p className={`${LBL} text-hs-paper/60`}>Weekend Hackathon</p>
          <span className={`${MOSAIC_HEADLINE} text-center text-hs-paper`}>
            18 al 20 de Septiembre
          </span>
        </P>
      ),
      r3b: (
        <P bg="bg-hs-gold">
          <ParticipantsCountUp
            ariaLabel="250 PARTICIPANTES"
            className={`${MOSAIC_DISPLAY} text-hs-ink`}
          />
          <p className={`mt-1 ${LBL} text-hs-ink`}>PARTICIPANTES</p>
        </P>
      ),
      r1c: (
        <P bg="bg-hs-paper">
          <span className="text-center font-bungee text-[min(13cqw,19cqh)] text-hs-ink leading-tight">
            MADRID '26
          </span>
          <a
            aria-label="Ubicación: UPM - ETSIT en Google Maps"
            className={`flex items-center justify-center gap-1.5 ${D} ${MOSAIC_FOOTER_SM} font-bold text-hs-ink underline underline-offset-2`}
            href="https://maps.app.goo.gl/4zVAyQjw1NSirnvE7"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" />
            </svg>
            <span>UPM - ETSIT</span>
          </a>
        </P>
      ),
      r4b: (
        <P bg="bg-hs-teal">
          <span className={`${MOSAIC_HEADLINE} text-center text-white`}>
            +10.000€
          </span>
          <p className={`${LBL} text-center text-white/60`}>en premios</p>
          <span className={`${MOSAIC_HEADLINE_SM} text-center text-hs-gold`}>
            5 TRACKS
          </span>
        </P>
      ),
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-2 !py-3">
          <p className={`${MOSAIC_HEADLINE} text-center text-hs-ink`}>
            El hackathon para unir a los mejores{" "}
            <span className="text-hs-red">builders</span> jóvenes de España.
          </p>
          <SignupCta
            ariaLabel="Solicitar plaza en HackSpain — abrir formulario"
            className="shrink-0"
            href={signupHref}
            label="Apúntate"
          />
          <SignupCountdown
            className="shrink-0 text-hs-ink"
            label="El evento empieza en"
            labelClassName={`${D} ${MOSAIC_FOOTER} font-black text-hs-ink/50 uppercase tracking-widest`}
            variant="mosaicSm"
          />
        </P>
      ),
      ...bottomRow(0),
      r5b: (
        <P bg="bg-hs-paper">
          <MadeByCredit
            className={`${D} ${MOSAIC_FOOTER} text-center font-bold text-hs-ink`}
          />
        </P>
      ),
      r5d: (
        <P bg="bg-hs-paper">
          <div className="flex items-center justify-center gap-3 text-hs-ink/45">
            <span
              className={`${D} ${MOSAIC_FOOTER_SM} mb-px font-bold leading-none`}
            >
              Powered by
            </span>
            <a
              aria-label="Exponential — patrocinador HackSpain"
              href="https://goexponential.org"
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt="Exponential"
                className="h-[clamp(1rem,52cqh,2.4rem)] w-auto object-contain opacity-60 brightness-0"
                height={96}
                src={exponentialLogo.src}
                width={240}
              />
            </a>
            <a
              aria-label="UPM — Universidad Politécnica de Madrid"
              href="https://www.upm.es"
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt="UPM"
                className="h-[clamp(1rem,52cqh,2.4rem)] w-auto object-contain opacity-60"
                height={96}
                src={upmLogo.src}
                width={240}
              />
            </a>
          </div>
        </P>
      ),
    },
    {
      hero: (
        <P bg="bg-hs-navy">
          <p className={`${LBL} text-hs-gold`}>MISIÓN</p>
          <h2 className={`text-center ${MOSAIC_HERO_LG} text-hs-paper`}>
            ESPAÑA TIENE <span className="text-hs-red">TALENTO.</span>
            <br />
            NOSOTROS VAMOS A <span className="text-hs-red">JUNTARLO.</span>
          </h2>
        </P>
      ),
      r3b: <P bg="bg-hs-paper" />,
      r4b: <P bg="bg-hs-teal" />,
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-10 !py-8">
          <p
            className={`${BD} text-center text-[clamp(0.8rem,min(12.5cqw,7.5cqh),1.75rem)] text-hs-ink`}
          >
            36 horas. 250 de los mejores{" "}
            <span className="text-hs-red">builders</span> menores de 30.
            HackSpain 2026 es el punto de encuentro de los jóvenes que van a
            posicionar a España como líder de talento tech joven.
          </p>
          <p
            className={`${BD} text-center text-[clamp(0.75rem,min(11cqw,6.5cqh),1.55rem)] text-hs-ink/60`}
          >
            Con los mejores fondos, startups y figuras del ecosistema español.
          </p>
        </P>
      ),
      ...bottomRow(1),
    },
    {
      hero: (
        <P bg="bg-hs-teal">
          <p className={`${LBL} text-white/60`}>HACKSPAIN 2026</p>
          <h2 className={`text-center ${MOSAIC_HERO_LG} text-white`}>
            5 TRACKS
            <br />
            <span className="text-hs-gold">ORIGINALES</span>
          </h2>
          <p className={`${LBL} text-white/60`}>Compute gratis para todos</p>
        </P>
      ),
      r1c: <P bg="bg-hs-paper" />,
      r3a: <P bg="bg-hs-paper" />,
      r3b: <P bg="bg-hs-paper" />,
      r4b: <P bg="bg-hs-paper" />,
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-10 !py-8">
          <p className={`${BD} text-center text-hs-ink`}>
            Cinco tracks con retos de las mejores{" "}
            <span className="text-hs-red">startups</span> de España.
          </p>
          <TracksInfoModal />
        </P>
      ),
      ...bottomRow(2),
    },
    {
      hero: (
        <P bg="bg-hs-red">
          <p className={`${LBL} text-hs-paper/70`}>HACKSPAIN 2026</p>
          <h2 className={`text-center ${MOSAIC_HERO_LG} text-hs-paper`}>
            1 <span className="text-hs-gold">GRAN</span>
            <br />
            PREMIO
          </h2>
          <p className={`${LBL} text-hs-paper/70`}>
            5.000 € para el equipo ganador
          </p>
        </P>
      ),
      r1c: <P bg="bg-hs-paper" />,
      r3a: <P bg="bg-hs-paper" />,
      r3b: <P bg="bg-hs-paper" />,
      r4b: <P bg="bg-hs-paper" />,
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-10 !py-8">
          <p className={`${BD} text-center text-hs-ink`}>
            Juzgado por los <span className="text-hs-red">mejores VCs</span> del
            panorama español.
          </p>
          <JudgesInfoModal />
        </P>
      ),
      ...bottomRow(3),
    },
    {
      hero: (
        <P bg="bg-hs-orange">
          <p className={`${LBL} text-hs-paper/70`}>HACKSPAIN 2026</p>
          <h2 className={`text-center ${MOSAIC_HERO_LG} text-hs-paper`}>
            COMIDA, BEBIDA
            <br />
            <span className="text-hs-gold">Y CHARLAS</span>
          </h2>
        </P>
      ),
      r1c: <P bg="bg-hs-paper" />,
      r3a: <P bg="bg-hs-paper" />,
      r3b: <P bg="bg-hs-paper" />,
      r4b: <P bg="bg-hs-paper" />,
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-10 !py-8">
          <p className={`${BD} text-center text-hs-ink`}>
            Conecta con los mejores{" "}
            <span className="text-hs-red">fundadores y mentores</span> del
            ecosistema de España.
          </p>
          <MentorsInfoModal />
        </P>
      ),
      ...bottomRow(4),
    },
    {
      hero: (
        <P bg="bg-hs-navy">
          <p className={`${LBL} text-hs-gold`}>HACKSPAIN 2026</p>
          <h2 className={`text-center ${MOSAIC_HERO_LG} text-hs-paper`}>
            <SignupHeroTitle />
          </h2>
        </P>
      ),
      r4c: (
        <P bg="bg-hs-paper" className="!justify-evenly !px-10 !py-6">
          <SignupCountdown
            className="text-hs-ink"
            label="El evento empieza en"
            labelClassName={`${LBL} text-center text-hs-ink/50`}
          />
          <SignupCta
            ariaLabel="Apúntate ya a HackSpain 2026"
            href={signupHref}
            label="Apúntate ya"
          />
        </P>
      ),
      ...bottomRow(5),
    },
  ];
}

function compactFooter(centered = false): React.ReactNode {
  return (
    <P
      align={centered ? "center" : "start"}
      bg="bg-hs-paper"
      className="!items-center !justify-evenly !p-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-hs-ink">
        <a
          aria-label="HackSpain en X (@hackspain26)"
          className="flex h-6 w-6 shrink-0 items-center justify-center"
          href={HACKSPAIN_SOCIAL_URLS.x}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span
            className="h-6 w-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG strings from ./constants
            dangerouslySetInnerHTML={{ __html: X_SVG }}
          />
        </a>
        <a
          aria-label="HackSpain en Instagram (@hackspain26)"
          className="flex h-6 w-6 shrink-0 items-center justify-center"
          href={HACKSPAIN_SOCIAL_URLS.instagram}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span
            className="h-6 w-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG strings from ./constants
            dangerouslySetInnerHTML={{ __html: INSTAGRAM_SVG }}
          />
        </a>
        <a
          className={`${D} font-bold text-base underline underline-offset-2`}
          href={HACKSPAIN_SOCIAL_URLS.x}
          rel="noopener noreferrer"
          target="_blank"
        >
          @hackspain26
        </a>
      </div>
      <MadeByCredit
        className={`${D} text-center font-bold text-hs-ink text-sm`}
        copyright
      />
    </P>
  );
}

/**
 * Diagonal ornament cell — coloured bg + triangular clip overlay + ink stroke.
 * "tl": coloured upper-left wedge, white lower-right.
 * "br": white upper-left, coloured lower-right wedge (mirror).
 * The SVG overlay replicates the background grid's diagonal stroke.
 */
function OrnDiag({
  bg,
  tri,
  corner,
}: {
  bg: string;
  tri: string;
  corner: "tl" | "br";
}) {
  const clip =
    corner === "tl"
      ? "polygon(0% 0%, 100% 0%, 0% 100%)"
      : "polygon(100% 0%, 100% 100%, 0% 100%)";
  return (
    <div className={`relative h-full w-full overflow-hidden ${bg}`}>
      <div className={`absolute inset-0 ${tri}`} style={{ clipPath: clip }} />
      {/* Ink diagonal stroke matching the background grid lines */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 288 200"
      >
        <title>{"diagonal"}</title>
        <line
          stroke="var(--color-hs-ink)"
          strokeWidth="4"
          x1="288"
          x2="0"
          y1="0"
          y2="200"
        />
      </svg>
    </div>
  );
}

/** Solid-colour ornament cell. */
function OrnSolid({ bg }: { bg: string }) {
  return <div className={`h-full w-full ${bg}`} />;
}

/**
 * Build the five ornament cells. orn2/orn4 are always paper.
 * flip1/flip5 independently swap each diagonal corner (tl↔br).
 */
function orn(
  orn1Bg: string,
  orn1Tri: string,
  centerBg: string,
  orn5Bg: string,
  orn5Tri: string,
  flip1 = false,
  flip5 = false
): Record<string, React.ReactNode> {
  return {
    orn1: <OrnDiag bg={orn1Bg} corner={flip1 ? "br" : "tl"} tri={orn1Tri} />,
    orn2: <OrnSolid bg="bg-hs-paper" />,
    orn3: <OrnSolid bg={centerBg} />,
    orn4: <OrnSolid bg="bg-hs-paper" />,
    orn5: <OrnDiag bg={orn5Bg} corner={flip5 ? "tl" : "br"} tri={orn5Tri} />,
  };
}

/**
 * Mobile layout — each section is a hero plus two big content cards and a
 * footer, merging the desktop section's scattered tiles into a few readable
 * cards. Keyed by the compact cell ids: `hero`, `b1`, `b2`, `foot`.
 */
export function buildSectionsCompact(
  signupHref = "/signup"
): Record<string, React.ReactNode>[] {
  const foot = compactFooter();

  return [
    {
      hero: (
        <P bg="bg-hs-paper" className={CARD}>
          <div className="flex w-full max-w-[320px] flex-col items-center gap-2">
            <InlineSvg
              className="h-auto w-full"
              label="HackSpain 2026"
              svg={logoSvg}
            />
            <span
              className={`${CH} text-center text-[clamp(1.2rem,6vw,2.2rem)] text-hs-ink`}
            >
              MADRID '26
            </span>
            <a
              aria-label="Ubicación: UPM - ETSIT en Google Maps"
              className={`flex items-center gap-1.5 ${D} font-bold text-[clamp(0.75rem,3vw,1rem)] text-hs-ink underline underline-offset-2`}
              href="https://maps.app.goo.gl/4zVAyQjw1NSirnvE7"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" />
              </svg>
              UPM - ETSIT
            </a>
            <MadeByCredit
              className={`${D} text-center font-bold text-[clamp(0.7rem,2.8vw,0.9rem)] text-hs-ink`}
            />
          </div>
        </P>
      ),
      b1: (
        <P bg="bg-hs-orange" className={CARDART}>
          {cardArt(windmillSvg, "br")}
          <p className={`${CLBL} text-hs-paper/70`}>Weekend Hackathon</p>
          <span
            className={`${CH} text-center text-[clamp(1.4rem,6.5vw,2.6rem)] text-hs-paper`}
          >
            18 al 20 de Septiembre
          </span>
          <div className="mt-2 flex flex-col items-center gap-0">
            <ParticipantsCountUp
              ariaLabel="250 PARTICIPANTES"
              className={`${CH} text-[clamp(2rem,10vw,4rem)] text-hs-paper`}
            />
            <p className={`${CLBL} text-hs-paper/70`}>PARTICIPANTES</p>
          </div>
        </P>
      ),
      b2: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-evenly`}>
          <p
            className={`${CH} text-center text-[clamp(1.1rem,5.5vw,2rem)] text-hs-ink`}
          >
            El hackathon para unir a los mejores{" "}
            <span className="text-hs-red">builders</span> jóvenes de España.
          </p>
          <p className={`${CLBL} text-center text-hs-ink/50`}>
            +10.000€ en premios. 5 tracks.
          </p>
          <SignupCta
            ariaLabel="Solicitar plaza en HackSpain — abrir formulario"
            className="!px-5 !py-2.5 !text-[clamp(0.85rem,3vw,1.1rem)] shrink-0"
            href={signupHref}
            label="Apúntate"
          />
          <SignupCountdown
            className="shrink-0 text-hs-ink"
            label="Empieza en"
            labelClassName={`${D} font-black text-[clamp(0.6rem,2.6vw,0.85rem)] text-hs-ink/50 uppercase tracking-widest`}
            layout="inline"
            variant="compactSm"
          />
        </P>
      ),
      ...orn(
        "bg-hs-teal",
        "bg-hs-paper",
        "bg-hs-red",
        "bg-hs-gold",
        "bg-hs-paper"
      ),
      // flip1=false, flip5=false → orn1 tl, orn5 br
      foot: (
        <P
          align="center"
          bg="bg-hs-paper"
          className="!justify-evenly !px-0 !py-2"
        >
          <PartnerLogoReel />
          <div className="flex items-center justify-center gap-2 text-hs-ink/45">
            <span className={`${D} mb-px font-bold text-xs leading-none`}>
              Powered by
            </span>
            <a
              aria-label="Exponential"
              href="https://goexponential.org"
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt="Exponential"
                className="h-[clamp(0.8rem,3.5vw,1.4rem)] w-auto object-contain opacity-60 brightness-0"
                height={96}
                src={exponentialLogo.src}
                width={240}
              />
            </a>
          </div>
        </P>
      ),
    },
    {
      hero: (
        <P bg="bg-hs-navy" className={CARD}>
          <p className={`${CLBL} text-hs-gold`}>MISIÓN</p>
          <h2
            className={`text-center ${CH} text-[clamp(1.35rem,6.2vw,2.6rem)] text-hs-paper`}
          >
            ESPAÑA TIENE <span className="text-hs-red">TALENTO.</span>
            <br />
            NOSOTROS VAMOS A <span className="text-hs-red">JUNTARLO.</span>
          </h2>
        </P>
      ),
      b1: (
        <P bg="bg-hs-paper" className={CARD}>
          <p
            className={`${CBD} text-center text-[clamp(1.05rem,4.8vw,1.9rem)] text-hs-ink`}
          >
            36 horas. 250 de los mejores{" "}
            <span className="text-hs-red">builders</span> menores de 30.
            HackSpain 2026 es el punto de encuentro de los jóvenes que van a
            posicionar a España como líder de talento tech joven.
          </p>
        </P>
      ),
      b2: (
        <P bg="bg-hs-teal" className={CARDART}>
          {cardArt(horseSvg, "br")}
          <p
            className={`${CBD} text-center text-[clamp(1.05rem,4.8vw,1.9rem)] text-white`}
          >
            Con los mejores fondos, startups y figuras del ecosistema español.
          </p>
        </P>
      ),
      ...orn(
        "bg-hs-orange",
        "bg-hs-paper",
        "bg-hs-gold",
        "bg-hs-red",
        "bg-hs-paper",
        true,
        false
      ),
      // flip1=true, flip5=false → orn1 br, orn5 br
      foot,
    },
    {
      hero: (
        <P bg="bg-hs-teal" className={CARD}>
          <p className={`${CLBL} text-white/60`}>HACKSPAIN 2026</p>
          <h2
            className={`text-center ${CH} text-[clamp(2rem,9vw,3.4rem)] text-white`}
          >
            5 TRACKS <span className="text-hs-gold">ORIGINALES</span>
          </h2>
          <p className={`${CLBL} text-white/60`}>Compute gratis para todos</p>
        </P>
      ),
      b1: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-evenly`}>
          <p className={`${CBD} text-center text-hs-ink`}>
            Cinco tracks con retos de las mejores{" "}
            <span className="text-hs-red">startups</span> de España.
          </p>
          <TracksInfoModal />
        </P>
      ),
      b2: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-center`}>
          <PartnerLogoGrid pinned={TRACK_SPONSORS} />
        </P>
      ),
      ...orn(
        "bg-hs-gold",
        "bg-hs-paper",
        "bg-hs-orange",
        "bg-hs-red",
        "bg-hs-paper",
        false,
        true
      ),
      // flip1=false, flip5=true → orn1 tl, orn5 tl
      foot,
    },
    {
      hero: (
        <P bg="bg-hs-red" className={CARD}>
          <p className={`${CLBL} text-hs-paper/70`}>HACKSPAIN 2026</p>
          <h2
            className={`text-center ${CH} text-[clamp(2rem,9vw,3.4rem)] text-hs-paper`}
          >
            1 <span className="text-hs-gold">GRAN</span> PREMIO
          </h2>
          <p className={`${CLBL} text-hs-paper/70`}>
            5.000 € para el equipo ganador
          </p>
        </P>
      ),
      b1: (
        <P bg="bg-hs-gold" className={CARDART}>
          {cardArt(trophySvg, "br")}
          <p className={`${CBD} text-center text-hs-ink`}>
            Juzgado por los <span className="text-hs-red">mejores VCs</span> del
            panorama español.
          </p>
          <JudgesInfoModal />
        </P>
      ),
      b2: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-center`}>
          <PartnerLogoGrid pinned={GRAND_PRIZE_SPONSORS} />
        </P>
      ),
      ...orn(
        "bg-hs-teal",
        "bg-hs-paper",
        "bg-hs-gold",
        "bg-hs-orange",
        "bg-hs-paper",
        true,
        false
      ),
      // flip1=true, flip5=false → orn1 br, orn5 br
      foot,
    },
    {
      hero: (
        <P bg="bg-hs-orange" className={CARD}>
          <p className={`${CLBL} text-hs-paper/70`}>HACKSPAIN 2026</p>
          <h2
            className={`text-center ${CH} text-[clamp(1.6rem,7.5vw,3rem)] text-hs-paper`}
          >
            COMIDA, BEBIDA <span className="text-hs-gold">Y CHARLAS</span>
          </h2>
        </P>
      ),
      b1: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-evenly`}>
          <p className={`${CBD} text-center text-hs-ink`}>
            Conecta con los mejores{" "}
            <span className="text-hs-red">fundadores y mentores</span> del
            ecosistema de España.
          </p>
          <MentorsInfoModal />
        </P>
      ),
      b2: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-center`}>
          <PartnerLogoGrid pinned={MENTOR_SPONSORS} />
        </P>
      ),
      ...orn(
        "bg-hs-gold",
        "bg-hs-paper",
        "bg-hs-teal",
        "bg-hs-red",
        "bg-hs-paper",
        false,
        true
      ),
      // flip1=false, flip5=true → orn1 tl, orn5 tl
      foot,
    },
    {
      hero: (
        <P bg="bg-hs-navy" className={CARD}>
          <p className={`${CLBL} text-hs-gold`}>HACKSPAIN 2026</p>
          <h2
            className={`text-center ${CH} text-[clamp(2rem,9vw,3.4rem)] text-hs-paper`}
          >
            <SignupHeroTitle compact />
          </h2>
        </P>
      ),
      b1: (
        <P bg="bg-hs-paper" className={`${CARD} !justify-evenly`}>
          <SignupCountdown
            className="text-hs-ink"
            label="El evento empieza en"
            labelClassName={`${CLBL} text-center text-hs-ink/50`}
            variant="compact"
          />
          <SignupCta
            ariaLabel="Apúntate ya a HackSpain 2026"
            className="!px-8 !py-4 !text-[clamp(1rem,4vw,1.4rem)]"
            href={signupHref}
            label="Apúntate ya"
          />
        </P>
      ),
      b2: (
        <P bg="bg-hs-paper" className={CARD}>
          <InlineSvg
            className="h-auto w-full max-w-[380px]"
            label="HackSpain 2026"
            svg={logoSvg}
          />
        </P>
      ),
      ...orn(
        "bg-hs-red",
        "bg-hs-paper",
        "bg-hs-orange",
        "bg-hs-teal",
        "bg-hs-paper"
      ),
      foot,
    },
  ];
}
