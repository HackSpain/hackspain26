import type { ReactNode } from "react";
import Link from "next/link";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Brand row only: logo and the account menu. There is no navigation here;
 * the home page carries the section tiles and every other page shows a back
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
        <div className="shrink-0">{accountMenu}</div>
      </div>
    </header>
  );
}
