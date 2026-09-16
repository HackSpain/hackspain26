"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { api } from "@convex/_generated/api";
import { GithubLinkBanner, GithubLinkResult } from "@/components/github-link-banner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "CRM" },
  { href: "/admin/types", label: "Tipos" },
  { href: "/admin/perks", label: "Perks" },
  { href: "/admin/tracks", label: "Retos" },
  { href: "/admin/notifications", label: "Avisos" },
  { href: "/admin/tv", label: "TV" },
  { href: "/judging", label: "Jueces" },
] as const;

function adminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/users/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountMenu({
  pathname,
  name,
  avatarUrl,
  userType,
}: {
  pathname: string;
  name?: string;
  avatarUrl?: string;
  userType?: string;
}) {
  const { signOut } = useAuthActions();
  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="overflow-hidden p-0 data-open:bg-hs-sand"
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
              profileActive && "bg-hs-gold text-hs-ink",
            )}
          >
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="font-bungee uppercase text-hs-red focus:text-hs-red"
          onSelect={() => void signOut()}
        >
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Every page except the home gets a way back to the tiles. */
function BackToHome() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2 font-bungee text-xs uppercase text-hs-brown underline-offset-4 outline-none hover:text-hs-ink hover:underline focus-visible:text-hs-ink focus-visible:underline motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
    >
      <ArrowLeft className="size-4" aria-hidden /> Volver al inicio
    </Link>
  );
}

function AdminStrip({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="border-b-[3px] border-hs-ink bg-hs-paper">
      <div className={cn(contentWidth(pathname), "flex flex-wrap items-center gap-x-4 gap-y-1")}>
        {ADMIN_NAV.map((item) => {
          const active =
            item.href === "/admin/perks"
              ? pathname === "/admin/perks" ||
                pathname.startsWith("/admin/perks/") ||
                pathname.startsWith("/admin/applications")
              : adminNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-11 items-center font-bungee text-xs uppercase",
                active ? "text-hs-ink underline decoration-2 underline-offset-4" : "text-hs-brown",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  // The public venue screen brings its own full-screen layout.
  if (pathname === "/tv") {
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

  const isAdmin = me?.role === "admin";
  const displayName = me?.name ?? me?.email;
  const askGithub =
    me !== undefined &&
    me !== null &&
    !me.githubLinked &&
    !pathname.startsWith("/admin") &&
    (isAdmin || (me.accepted && me.onboardingComplete));

  return (
    <div className="min-h-screen bg-hs-paper">
      <AppHeader
        pathname={pathname}
        accountMenu={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" className={cn("text-xs", pathname.startsWith("/admin") && "bg-hs-gold")}>
                <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>Admin panel</Link>
              </Button>
            )}
            <AccountMenu
              pathname={pathname}
              name={displayName ?? undefined}
              avatarUrl={me?.avatarUrl}
              userType={me?.userType?.label}
            />
          </div>
        }
      />
      {isAdmin && (pathname.startsWith("/admin") || pathname.startsWith("/judging")) ? (
        <AdminStrip pathname={pathname} />
      ) : null}
      {askGithub ? <GithubLinkBanner /> : null}
      <main className={cn(contentWidth(pathname), "min-w-0 py-6 sm:py-8")}>
        <Suspense fallback={null}>
          <GithubLinkResult />
        </Suspense>
        {pathname === "/" ? null : (
          <div className="hs-enter mb-4">
            <BackToHome />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
