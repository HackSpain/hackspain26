import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader({
  pathname,
  accountMenu,
}: {
  pathname: string;
  accountMenu?: ReactNode;
}) {
  return (
    <header className="border-b-[3px] border-hs-ink bg-hs-sand">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-self-start motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
        >
          <img
            src="/logo.svg"
            alt="HackSpain"
            width={125}
            height={40}
            className="h-auto w-20 sm:h-10 sm:w-auto"
          />
        </Link>
        <div className="flex items-center justify-center gap-3 sm:gap-5">
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
          <Link
            href="/cli"
            aria-current={pathname === "/cli" ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap text-hs-teal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-teal sm:gap-2 sm:text-sm",
              pathname === "/cli" && "underline",
            )}
          >
            CLI
          </Link>
        </div>
        <div className="justify-self-end">
          {accountMenu}
        </div>
      </div>
    </header>
  );
}
