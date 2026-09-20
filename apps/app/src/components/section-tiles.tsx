"use client";

import Link from "next/link";
import {
  CircleUserRound,
  ClipboardList,
  Gavel,
  Gift,
  Network,
  Send,
  Terminal,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SectionKey } from "@convex/lib/userTypes";
import { Badge } from "@/components/ui/badge";
import { SECTION_NAV, SECTION_ORDER } from "@/lib/sections";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  teams: Users,
  tracks: Trophy,
  perks: Gift,
  participantes: Network,
  judging: Gavel,
  judgingSponsors: ClipboardList,
  cli: Terminal,
};

type Tile = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  private?: boolean;
};

/** Sections that stay open outside the hackathon window (src/lib/sections.ts). */
const CLOSED_SECTIONS: ReadonlySet<SectionKey> = new Set(["participantes", "perks"]);

/**
 * The launcher on the home page: one tile per section the user can open,
 * plus the profile. Replaces the old tab bar; every destination shows a
 * "Volver al inicio" button (app-shell.tsx). The venue screen (/tv) is
 * deliberately absent: only admins reach it, from /admin/tv.
 */
export function SectionTiles({
  sections,
  eventOpen = true,
  featuredSubmit = false,
  className,
}: {
  sections?: readonly SectionKey[];
  /** False outside the hackathon window: only the directory and perks survive. */
  eventOpen?: boolean;
  /** Sunday 08:00 Madrid: the Submit tile jumps out until the project is in. */
  featuredSubmit?: boolean;
  className?: string;
}) {
  const visible = (key: SectionKey) =>
    sections?.includes(key) && (eventOpen || CLOSED_SECTIONS.has(key));
  const tiles: Tile[] = [
    ...(eventOpen
      ? [
          {
            href: "/submit",
            label: "Submit",
            hint: featuredSubmit
              ? "Entrega a las 11: vídeo, repo y demo para San Francisco."
              : "Vídeo de 3 minutos, repo y, si aplica, una demo.",
            icon: Send,
          } satisfies Tile,
        ]
      : []),
    ...SECTION_ORDER.filter(visible).map((key) => ({
      ...SECTION_NAV[key],
      icon: SECTION_ICONS[key],
    })),
    { href: "/profile", label: "Perfil", hint: "Nombre, foto, ficha y teléfono.", icon: CircleUserRound },
  ];

  return (
    <nav aria-label="Secciones" className={className}>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const featured = featuredSubmit && tile.href === "/submit";
          return (
            <li
              key={tile.href}
              className={cn("min-w-0", featured && "col-span-2 sm:col-span-2")}
            >
              <Link
                href={tile.href}
                title={tile.hint}
                className={cn(
                  "flex min-h-24 flex-col items-center justify-center gap-1.5 border-[3px] border-hs-ink bg-hs-sand px-2 py-3 text-center outline-none",
                  "motion-safe:transition-[transform,background-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.96]",
                  "hover:bg-hs-gold focus-visible:bg-hs-gold focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-paper",
                  featured &&
                    "hs-submit-featured min-h-32 border-hs-red bg-hs-gold hover:bg-hs-gold",
                )}
              >
                <Icon className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="w-full truncate font-bungee text-[11px] uppercase leading-tight sm:text-xs">
                  {featured ? "Ahora · Submit" : tile.label}
                </span>
                {featured ? (
                  <span className="text-[10px] font-medium leading-tight text-hs-ink">
                    Entregar ahora
                  </span>
                ) : tile.private ? (
                  <Badge className="border-hs-ink bg-hs-navy px-1 py-px text-[8px] leading-none text-hs-paper">
                    Privada
                  </Badge>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
