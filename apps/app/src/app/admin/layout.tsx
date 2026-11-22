"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_NAV, adminNavActive } from "@/components/admin/admin-nav";
import {
  AdminEditionProvider,
  useAdminEdition,
} from "@/components/admin/use-admin-edition";
import { cn } from "@/lib/utils";

function EditionSwitcher() {
  const { editions, selected, select } = useAdminEdition();
  if (editions.length === 0) {
    return null;
  }
  return (
    <label className="flex min-h-11 shrink-0 items-center gap-2 lg:mb-2">
      <span className="sr-only">Edición</span>
      <select
        value={selected?.slug ?? ""}
        onChange={(event) => select(event.target.value)}
        className="max-w-[11rem] min-h-11 border-[3px] border-hs-ink bg-hs-paper px-2 font-bungee text-xs uppercase text-hs-ink outline-none focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2"
      >
        {editions.map((edition) => (
          <option key={edition._id} value={edition.slug}>
            {edition.label}
            {edition.current ? " · actual" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="shrink-0 overflow-x-auto lg:sticky lg:top-4 lg:w-44 lg:overflow-visible"
    >
      <div className="flex flex-nowrap items-center gap-x-4 lg:flex-col lg:items-stretch lg:gap-0">
        <EditionSwitcher />
        <ul className="flex flex-nowrap gap-x-4 lg:flex-col lg:gap-0">
          {ADMIN_NAV.map((item) => {
            const active = adminNavActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center font-bungee text-xs uppercase outline-none focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2",
                    active
                      ? "bg-hs-gold px-2 text-hs-ink"
                      : "text-hs-brown hover:text-hs-ink"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
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
    <p className="border-[3px] border-hs-ink bg-hs-sand px-3 py-2 text-sm font-medium text-hs-brown">
      Estás viendo {selected.label}. Las altas están cerradas; el calendario sí
      se puede editar.
    </p>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <AdminSidebar />
      <div className="min-w-0 flex-1 space-y-4">
        <PastEditionBanner />
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminEditionProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminEditionProvider>
  );
}
