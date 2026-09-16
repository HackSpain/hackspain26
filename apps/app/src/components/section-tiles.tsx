"use client";

import Link from "next/link";
import {
  CircleUserRound,
  Gavel,
  Gift,
  Network,
  Terminal,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SectionKey } from "@convex/lib/userTypes";
import { SECTION_NAV, SECTION_ORDER } from "@/lib/sections";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  teams: Users,
  tracks: Trophy,
  perks: Gift,
  participantes: Network,
  judging: Gavel,
  cli: Terminal,
};

type Tile = { href: string; label: string; hint: string; icon: LucideIcon; external?: boolean };

/**
 * The launcher on the home page: one tile per section the user can open,
 * plus the profile and the venue screen. Replaces the old tab bar; every
 * destination shows a "Volver al inicio" button (app-shell.tsx).
 */
export function SectionTiles({
  sections,
  className,
}: {
  sections?: readonly SectionKey[];
  className?: string;
}) {
  const tiles: Tile[] = [
    ...SECTION_ORDER.filter((key) => sections?.includes(key)).map((key) => ({
      ...SECTION_NAV[key],
      icon: SECTION_ICONS[key],
    })),
    { href: "/profile", label: "Perfil", hint: "Nombre, foto y teléfono.", icon: CircleUserRound },
    { href: "/tv?from=app", label: "TV en vivo", hint: "La pantalla del venue.", icon: Tv },
  ];

  return (
    <nav aria-label="Secciones" className={className}>
      <ul className="hs-stagger grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <li key={tile.href} className="min-w-0">
              <Link
                href={tile.href}
                title={tile.hint}
                className={cn(
                  "flex min-h-24 flex-col items-center justify-center gap-2 border-[3px] border-hs-ink bg-hs-sand px-2 py-3 text-center outline-none",
                  "motion-safe:transition-[transform,background-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.96]",
                  "hover:bg-hs-gold focus-visible:bg-hs-gold focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-paper",
                )}
              >
                <Icon className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="w-full truncate font-bungee text-[11px] uppercase leading-tight sm:text-xs">
                  {tile.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
