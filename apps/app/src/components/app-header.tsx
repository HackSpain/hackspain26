import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Brand row with granted section links, Insights, and the account menu.
 * Admins get their sidebar from AdminFrame instead of this nav.
 */
export function AppHeader({
  pathname,
  accountMenu,
  homeHref = "/",
  nav,
}: {
  pathname: string;
  accountMenu?: ReactNode;
  homeHref?: string;
  nav?: ReactNode;
}) {
  return (
    <header className="border-b-3 border-hs-ink bg-hs-sand">
      <div
        className={cn(
          contentWidth(pathname),
          "flex items-center gap-x-2 py-3 sm:gap-x-5"
        )}
      >
        <Link
          href={homeHref}
          className="inline-flex min-h-11 w-fit shrink-0 items-center motion-safe:transition-transform motion-safe:duration-press motion-safe:ease-out motion-safe:active:scale-[0.97]"
        >
          <Image
            src="/logo.svg"
            alt="HackSpain"
            width={125}
            height={41}
            className="h-auto w-20 sm:h-10 sm:w-auto"
          />
        </Link>
        {nav ? (
          <div className="min-w-0 flex-1">{nav}</div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <Link
          href="/insights"
          aria-current={pathname === "/insights" ? "page" : undefined}
          className="group inline-flex min-h-11 items-center justify-center gap-1.5 font-bungee text-2xs uppercase text-hs-ink outline-none motion-safe:transition-transform motion-safe:duration-press motion-safe:ease-out motion-safe:active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-sand sm:gap-2 sm:text-xs"
        >
          <span className="hidden min-[360px]:inline">Insights</span>
          <span className="inline-flex items-center gap-1.5 border-2 border-hs-ink bg-hs-red px-2 py-1 text-4xs leading-none text-hs-paper shadow-hard-sm motion-safe:transition-press motion-safe:duration-press group-hover:brightness-95 sm:text-3xs">
            <span className="size-1.5 bg-hs-paper" aria-hidden />
            En vivo
          </span>
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
        <div className="shrink-0">{accountMenu}</div>
      </div>
    </header>
  );
}
