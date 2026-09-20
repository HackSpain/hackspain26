import { SECTION_KEYS } from "@convex/lib/userTypes";
import type { SectionKey } from "@convex/lib/userTypes";

/**
 * Header tabs. The feed lives on `/` and is always visible; everything else
 * is a section a CRM user type can switch on or off (convex/lib/userTypes.ts).
 */
export const SECTION_NAV: Record<
  SectionKey,
  { href: string; label: string; hint: string; private?: boolean }
> = {
  teams: { href: "/teams", label: "Equipo", hint: "Ver el equipo y su repo." },
  tracks: { href: "/tracks", label: "Retos", hint: "Proyecto y retos." },
  perks: { href: "/perks", label: "Perks", hint: "Beneficios de partners." },
  participantes: {
    href: "/participantes",
    label: "Participantes",
    hint: "Directorio de la comunidad. Solo quien tiene acceso.",
    private: true,
  },
  judging: {
    href: "/judging",
    label: "Juzgar",
    hint: "Panel del jurado.",
    private: true,
  },
  judgingSponsors: {
    href: "/judging-sponsors",
    label: "Entregas",
    hint: "Submissions por reto. Sin puntuar.",
    private: true,
  },
  cli: { href: "/cli", label: "CLI", hint: "Instalación y comandos." },
};

export const SECTION_ORDER: readonly SectionKey[] = SECTION_KEYS;

export const JUDGING_PATH = "/judging";
export const JUDGING_SPONSORS_PATH = "/judging-sponsors";

export function isJudgingPath(pathname: string): boolean {
  if (isSponsorJudgingPath(pathname)) {
    return false;
  }
  return pathname === JUDGING_PATH || pathname.startsWith(`${JUDGING_PATH}/`);
}

export function isSponsorJudgingPath(pathname: string): boolean {
  return (
    pathname === JUDGING_SPONSORS_PATH ||
    pathname.startsWith(`${JUDGING_SPONSORS_PATH}/`)
  );
}

export function isAnyJudgingPath(pathname: string): boolean {
  return isSponsorJudgingPath(pathname) || isJudgingPath(pathname);
}

export function hasSponsorCatalog(sections: readonly string[]): boolean {
  return sections.includes("judgingSponsors");
}

export function isTracksPath(pathname: string): boolean {
  return pathname === "/tracks" || pathname.startsWith("/tracks/");
}

export function judgingDashboardHome(me: {
  canJudge: boolean;
  sections: readonly string[];
}): string {
  if (me.canJudge) {
    return JUDGING_PATH;
  }
  return JUDGING_SPONSORS_PATH;
}

export function sectionForPath(pathname: string): SectionKey | null {
  if (isSponsorJudgingPath(pathname)) {
    return "judgingSponsors";
  }
  for (const key of SECTION_ORDER) {
    const { href } = SECTION_NAV[key];
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      return key;
    }
  }
  return null;
}

/**
 * Outside the hackathon window (convex/lib/eventWindow.ts) participants keep
 * the profile, directory and perks. Judging stays too: scoring happens after
 * submit closes. Judges also keep /tracks (challenge briefs). Mirrors the
 * server — gated features throw EVENT_CLOSED, so AuthGate bounces those paths
 * home before they mount.
 */
const OPEN_WHEN_CLOSED = [
  "/",
  "/profile",
  "/participantes",
  "/perks",
  "/insights",
  "/tv",
  "/cli-auth",
  "/login",
  "/onboarding",
  "/pending",
  "/unregistered",
  JUDGING_PATH,
  JUDGING_SPONSORS_PATH,
];

export function isPathAllowedWhenClosed(
  pathname: string,
  canJudge = false
): boolean {
  if (canJudge && isTracksPath(pathname)) {
    return true;
  }
  return OPEN_WHEN_CLOSED.some(
    (href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
  );
}
