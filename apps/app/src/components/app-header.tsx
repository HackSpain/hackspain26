import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Brand row with the live insights shortcut and account menu. The home page
 * carries the rest of the section tiles and every other page shows a back
 * button (app-shell.tsx). The venue screen (/tv) is not linked from the app:
 * admins reach it from /admin/tv.
 */
export function AppHeader({
  pathname,
  accountMenu,
}: {
  pathname: string;
  accountMenu?: ReactNode;
}) {
  return (
    <header className="border-b-[3px] border-hs-ink bg-hs-sand">
      <div
        className={cn(
          contentWidth(pathname),
          "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 py-3 sm:gap-x-5",
        )}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 w-fit shrink-0 items-center motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
        >
          <img
            src="/logo.svg"
            alt="HackSpain"
            width={125}
            height={41}
            className="h-auto w-20 sm:h-10 sm:w-auto"
          />
        </Link>
        <Link
          href="/insights"
          aria-current={pathname === "/insights" ? "page" : undefined}
          className="group inline-flex min-h-11 items-center justify-center gap-1.5 font-bungee text-[11px] uppercase text-hs-ink outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-sand sm:gap-2 sm:text-xs"
        >
          <span className="hidden min-[360px]:inline">Insights</span>
          <span className="inline-flex items-center gap-1.5 border-2 border-hs-ink bg-hs-red px-2 py-1 text-[9px] leading-none text-hs-paper shadow-[2px_2px_0_var(--color-hs-ink)] motion-safe:transition-[filter] motion-safe:duration-[var(--duration-press)] group-hover:brightness-95 sm:text-[10px]">
            <span className="size-1.5 bg-hs-paper" aria-hidden />
            En vivo
          </span>
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
        <div className="min-w-0 justify-self-end">{accountMenu}</div>
      </div>
    </header>
  );
}
