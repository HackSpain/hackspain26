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
    hint: "Directorio y grafos. Mentores, sponsors y organización.",
    private: true,
  },
  judging: {
    href: "/judging",
    label: "Juzgar",
    hint: "Panel del jurado. Solo jueces.",
    private: true,
  },
  cli: { href: "/cli", label: "CLI", hint: "Instalación y comandos." },
};

export const SECTION_ORDER: readonly SectionKey[] = SECTION_KEYS;

export function sectionForPath(pathname: string): SectionKey | null {
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
 * the profile, directory and perks. Mirrors the server: gated features throw
 * EVENT_CLOSED, so AuthGate bounces those paths home before they mount.
 */
const OPEN_WHEN_CLOSED = [
  "/",
  "/profile",
  "/participantes",
  "/perks",
  "/tv",
  "/cli-auth",
  "/login",
  "/onboarding",
  "/pending",
  "/unregistered",
];

export function isPathAllowedWhenClosed(pathname: string): boolean {
  return OPEN_WHEN_CLOSED.some(
    (href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
  );
}
