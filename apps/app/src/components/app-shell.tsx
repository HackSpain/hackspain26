"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { Suspense, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { CliGuideSheet } from "@/components/cli-guide";
import { api } from "@convex/_generated/api";
import {
  EventClosedBanner,
  isEventOpen,
} from "@/components/event-closed-banner";
import {
  GithubLinkBanner,
  GithubLinkResult,
} from "@/components/github-link-banner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contentWidth, fullBleed } from "@/lib/layout";
import { isPublicAppPath } from "@/lib/public-paths";
import {
  DIRECTORY_PATH,
  judgingDashboardHome,
  SECTION_NAV,
  SECTION_ORDER,
} from "@/lib/sections";
import { cn } from "@/lib/utils";

function AccountMenu({
  pathname,
  name,
  avatarUrl,
  userType,
  isAdmin,
}: {
  pathname: string;
  name?: string;
  avatarUrl?: string;
  userType?: string;
  isAdmin: boolean;
}) {
  const { signOut } = useAuthActions();
  const [cliOpen, setCliOpen] = useState(false);
  const profileActive =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const inAdmin = pathname.startsWith("/admin");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="overflow-hidden"
            aria-label="Cuenta"
          >
            <Avatar
              name={name}
              src={avatarUrl}
              className="size-full border-0 bg-transparent text-sm"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {name ? (
            <>
              <DropdownMenuLabel className="truncate font-semibold">
                {name}
                {userType ? (
                  <span className="block text-xs font-normal text-hs-brown">
                    {userType}
                  </span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem asChild>
            <Link
              href="/profile"
              className={cn(
                "font-bungee uppercase",
                profileActive && "bg-hs-gold text-hs-ink"
              )}
            >
              Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="font-bungee uppercase"
            onSelect={(event) => {
              event.preventDefault();
              setCliOpen(true);
            }}
          >
            CLI
          </DropdownMenuItem>
          {isAdmin && !inAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="font-bungee uppercase">
                Admin
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="font-bungee uppercase text-hs-red focus:text-hs-red"
            onSelect={() => void signOut()}
          >
            Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CliGuideSheet open={cliOpen} onOpenChange={setCliOpen} />
    </>
  );
}

const BACK_LINK_CLASS =
  "inline-flex min-h-11 items-center gap-2 font-bungee text-xs uppercase text-hs-brown underline-offset-4 outline-none hover:text-hs-ink hover:underline focus-visible:text-hs-ink focus-visible:underline motion-safe:transition-transform motion-safe:duration-press motion-safe:ease-out motion-safe:active:scale-[0.97]";

function ParticipantNav({
  sections,
  pathname,
}: {
  sections: readonly string[];
  pathname: string;
}) {
  const links = SECTION_ORDER.filter((key) => sections.includes(key)).map(
    (key) => ({ key, ...SECTION_NAV[key] })
  );
  if (links.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Secciones" className="min-w-0 overflow-x-auto">
      <ul className="flex flex-nowrap items-center gap-x-4">
        {links.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center font-bungee text-xs uppercase outline-none focus-visible:underline",
                  active
                    ? "text-hs-ink underline decoration-2 underline-offset-4"
                    : "text-hs-brown hover:text-hs-ink"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  if (isPublicAppPath(pathname)) {
    return <>{children}</>;
  }

  const hideChrome =
    pathname === "/login" ||
    pathname === "/cli-auth" ||
    pathname === "/onboarding" ||
    pathname === "/unregistered" ||
    pathname === "/pending";

  if (hideChrome) {
    return <div className="min-h-screen bg-hs-paper">{children}</div>;
  }

  const isAdmin = me?.admin === true || me?.role === "admin";
  const bleed = fullBleed(pathname);
  const displayName = me?.name ?? me?.email;
  const homeHref =
    me && judgingDashboardHome(me) === DIRECTORY_PATH ? DIRECTORY_PATH : "/";
  const inAdmin = pathname.startsWith("/admin");
  const trackBrief = pathname.startsWith("/tracks/") && pathname !== "/tracks";
  const askGithub =
    me !== undefined &&
    me !== null &&
    !me.githubLinked &&
    !inAdmin &&
    pathname !== "/profile" &&
    !pathname.startsWith("/profile/") &&
    (isAdmin || (me.accepted && me.onboardingComplete));

  return (
    <div className="min-h-screen bg-hs-paper">
      <AppHeader
        pathname={pathname}
        homeHref={homeHref}
        nav={
          inAdmin || !me ? null : (
            <ParticipantNav sections={me.sections} pathname={pathname} />
          )
        }
        accountMenu={
          <AccountMenu
            pathname={pathname}
            name={displayName ?? undefined}
            avatarUrl={me?.avatarUrl}
            userType={me?.userType?.label}
            isAdmin={isAdmin}
          />
        }
      />
      {me?.event && !isEventOpen(me.event) ? (
        <EventClosedBanner event={me.event} />
      ) : null}
      {askGithub ? <GithubLinkBanner /> : null}
      <main
        className={cn(
          bleed
            ? "w-full pt-6 sm:pt-8"
            : cn(
                contentWidth(pathname),
                "min-w-0",
                pathname.startsWith("/admin") ? "py-3" : "py-6 sm:py-8"
              )
        )}
      >
        <div className={cn(bleed && contentWidth(pathname))}>
          <Suspense fallback={null}>
            <GithubLinkResult />
          </Suspense>
          {trackBrief ? (
            <div className="hs-enter mb-4">
              <Link href="/tracks" className={BACK_LINK_CLASS}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver a retos
              </Link>
            </div>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
