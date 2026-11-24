"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export const ADMIN_TAB_PARAM = "tab";

export function useAdminTab(defaultTab: string): string {
  const searchParams = useSearchParams();
  return searchParams.get(ADMIN_TAB_PARAM) ?? defaultTab;
}

export function AdminTabs({
  tabs,
  defaultTab,
  className,
}: {
  tabs: readonly { value: string; label: string }[];
  defaultTab: string;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(ADMIN_TAB_PARAM) ?? defaultTab;

  return (
    <nav
      aria-label="Apartados"
      className={cn("flex flex-nowrap gap-3 overflow-x-auto", className)}
    >
      {tabs.map((tab) => {
        const next = new URLSearchParams(searchParams.toString());
        if (tab.value === defaultTab) {
          next.delete(ADMIN_TAB_PARAM);
        } else {
          next.set(ADMIN_TAB_PARAM, tab.value);
        }
        const query = next.toString();
        const href = query ? `${pathname}?${query}` : pathname;
        const active = current === tab.value;
        return (
          <Link
            key={tab.value}
            href={href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center font-bungee text-xs uppercase outline-none focus-visible:underline",
              active
                ? "text-hs-ink underline decoration-2 underline-offset-4"
                : "text-hs-brown hover:text-hs-ink"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
