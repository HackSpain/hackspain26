"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_NAV, adminNavActive } from "@/components/admin/admin-nav";
import {
  AdminEditionProvider,
  useAdminEdition,
} from "@/components/admin/use-admin-edition";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "flex min-h-11 items-center px-2 font-bungee text-xs uppercase outline-none select-none focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 motion-safe:transition-surface motion-safe:duration-press motion-safe:ease-out motion-safe:active:scale-[0.97]";

function editionOptionLabel(edition: { current: boolean; slug: string }) {
  return edition.current ? `${edition.slug} · actual` : edition.slug;
}

function EditionSwitcher() {
  const { editions, selected, select } = useAdminEdition();
  if (editions.length === 0) {
    return null;
  }
  return (
    <label className="flex min-h-11 shrink-0 items-center lg:mb-1 lg:w-full">
      <span className="sr-only">Edición</span>
      <select
        value={selected?.slug ?? ""}
        onChange={(event) => select(event.target.value)}
        className="min-h-11 w-full max-w-[8.5rem] border-0 border-b-3 border-hs-ink bg-transparent px-1 font-bungee text-base uppercase text-hs-ink outline-none lg:max-w-none lg:text-xs focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2"
      >
        {editions.map((edition) => (
          <option key={edition._id} value={edition.slug}>
            {editionOptionLabel(edition)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminNavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {ADMIN_NAV.map((item) => {
        const active = adminNavActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                NAV_LINK,
                "w-full",
                active
                  ? "bg-hs-gold text-hs-ink"
                  : "text-hs-brown hover:bg-hs-sand hover:text-hs-ink"
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AdminMobileNav() {
  const pathname = usePathname();
  const current =
    ADMIN_NAV.find((item) => adminNavActive(pathname, item.href)) ??
    ADMIN_NAV[0];

  return (
    <div className="flex min-w-0 flex-1 items-center lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            aria-label="Sección"
            className="flex-1 justify-between"
          >
            {current.label}
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(16rem,calc(100vw-2rem))]"
        >
          {ADMIN_NAV.map((item) => {
            const active = adminNavActive(pathname, item.href);
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "font-bungee text-xs uppercase",
                    active && "bg-hs-gold text-hs-ink"
                  )}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <nav aria-label="Admin" className="shrink-0 lg:sticky lg:top-3 lg:w-36">
      <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0">
        <EditionSwitcher />
        <AdminMobileNav />
        <AdminNavLinks className="hidden w-full lg:flex lg:flex-col" />
      </div>
    </nav>
  );
}

function PastEditionBanner() {
  const { isCurrent, ready, selected } = useAdminEdition();
  if (!ready || isCurrent || !selected) {
    return null;
  }
  return (
    <p className="border-3 border-hs-ink bg-hs-sand px-3 py-1.5 text-sm font-medium text-hs-brown">
      Estás viendo {selected.label}. Las altas están cerradas; el calendario sí
      se puede editar.
    </p>
  );
}

export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <AdminEditionProvider>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
        <AdminSidebar />
        <div className="min-w-0 flex-1 space-y-3">
          <PastEditionBanner />
          {children}
        </div>
      </div>
    </AdminEditionProvider>
  );
}
