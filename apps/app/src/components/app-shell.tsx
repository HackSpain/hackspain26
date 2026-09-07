"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { CircleUser } from "lucide-react";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
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
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "CRM" },
  { href: "/admin/perks", label: "Perks" },
  { href: "/admin/applications", label: "Solicitudes" },
  { href: "/admin/tracks", label: "Retos" },
  { href: "/admin/notifications", label: "Avisos" },
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
  isAdmin,
}: {
  pathname: string;
  name?: string;
  isAdmin: boolean;
}) {
  const { signOut } = useAuthActions();
  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");
  const adminActive = pathname.startsWith("/admin");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="data-open:bg-hs-sand"
          aria-label="Cuenta"
        >
          <CircleUser />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {name ? (
          <>
            <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
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
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link
              href="/admin"
              className={cn(
                "font-bungee uppercase",
                adminActive && "bg-hs-gold text-hs-ink",
              )}
            >
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className="font-bungee uppercase"
          onSelect={() => void signOut()}
        >
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminStrip({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="border-b-[3px] border-hs-ink bg-hs-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4">
        {ADMIN_NAV.map((item) => {
          const active = adminNavActive(pathname, item.href);
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
  const hideChrome =
    pathname === "/login" ||
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
    (isAdmin || (me.accepted && me.onboardingComplete));

  return (
    <div className="min-h-screen bg-hs-paper">
      <AppHeader
        pathname={pathname}
        accountMenu={
          <AccountMenu
            pathname={pathname}
            name={displayName ?? undefined}
            isAdmin={isAdmin}
          />
        }
      />
      {isAdmin && pathname.startsWith("/admin") ? (
        <AdminStrip pathname={pathname} />
      ) : null}
      {askGithub ? <GithubLinkBanner /> : null}
      <main className={cn(
        "mx-auto py-6 sm:py-8",
        pathname === "/participantes" ? "w-full" : "max-w-6xl px-4",
      )}>
        <Suspense fallback={null}>
          <GithubLinkResult />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
