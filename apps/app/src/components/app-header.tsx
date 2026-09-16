import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Brand row only: logo, venue screen link and the account menu. There is no
 * navigation here; the home page carries the section tiles and every other
 * page shows a back button (app-shell.tsx).
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
      <div className={cn(contentWidth(pathname), "flex items-center gap-x-5 py-3")}>
        <Link
          href="/"
          className="mr-auto inline-flex min-h-11 shrink-0 items-center motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
        >
          <img
            src="/logo.svg"
            alt="HackSpain"
            width={125}
            height={40}
            className="h-auto w-20 sm:h-10 sm:w-auto"
          />
        </Link>
        <Link
          href="/tv?from=app"
          aria-current={pathname === "/tv" ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap text-hs-red underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-red sm:gap-2 sm:text-sm",
            pathname === "/tv" && "underline",
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          TV en vivo
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <div className="shrink-0">{accountMenu}</div>
      </div>
    </header>
  );
}
