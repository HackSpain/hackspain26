"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Role } from "@convex/lib/validators";
import { api } from "@convex/_generated/api";
import { HomeSplash } from "@/components/home-splash";
import {
  LoginTransition,
  LoginTransitionProvider,
} from "@/components/login-transition";
import { LoadingText } from "@/components/page";
import { Button } from "@/components/ui/button";
import { isPathAllowedWhenClosed, sectionForPath } from "@/lib/sections";

function destination(me: {
  role: Role;
  isRegistered: boolean;
  accepted: boolean;
  onboardingComplete: boolean;
  profileComplete: boolean;
}): string | null {
  if (!me.isRegistered) {
    return "/unregistered";
  }
  if (!me.accepted) {
    return "/pending";
  }
  if (!me.onboardingComplete) {
    return "/onboarding";
  }
  // Name, photo and directory card (convex/lib/profile.ts). Every role,
  // admins and judges included, fills these in the same wizard.
  if (!me.profileComplete) {
    return "/onboarding";
  }
  return null;
}

// /cli-auth approves a CLI login and carries a one-time ?code=. The code is
// preserved through the login redirect via sessionStorage, since neither the
// middleware nor this gate has a returnTo query.
const CLI_AUTH_PATH = "/cli-auth";
// /cli-auth/handoff signs the browser in with a token minted by the CLI
// (`hackspain open`). Like /tv it renders without a session; the page itself
// navigates onward once the cookies are set, and the gates apply there.
const CLI_HANDOFF_PATH = "/cli-auth/handoff";
const RETURN_TO_KEY = "hs-return-to";

function stashReturnTo(): void {
  try {
    sessionStorage.setItem(
      RETURN_TO_KEY,
      window.location.pathname + window.location.search,
    );
  } catch {
    // Storage blocked; the user can reopen the link from the terminal.
  }
}

// Peek, don't consume: the gate effect re-runs while the router is still on
// /login, and removing the stash on first read would let a re-run fall
// through to the participant-gate redirect. Cleared on arrival at /cli-auth.
function peekReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY);
    return value?.startsWith(`${CLI_AUTH_PATH}?`) ? value : null;
  } catch {
    return null;
  }
}

function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // Nothing stashed without storage.
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const attachAfterLogin = useMutation(api.users.attachAfterLogin);

  // Set by the login page once its code is accepted; the curtain stays up
  // until the page the user lands on is rendered underneath (see below).
  const [transition, setTransition] = useState<{
    email: string | null;
    startedAt: number;
  } | null>(null);
  const beginLoginTransition = useCallback((email: string | null) => {
    setTransition({ email, startedAt: Date.now() });
  }, []);
  const endLoginTransition = useCallback(() => setTransition(null), []);

  useEffect(() => {
    if (!isAuthenticated || !me) {
      return;
    }
    void attachAfterLogin({});
  }, [attachAfterLogin, isAuthenticated, me]);

  // Safety net for the curtain: if the session never materialises (a
  // rejected token) or the redirect stalls, hand the screen back rather than
  // leaving "Entrando…" up for good. The provider needs a moment to pick the
  // new token up, hence the grace before trusting "not signed in".
  useEffect(() => {
    if (!transition) {
      return;
    }
    const unauthenticated = !isLoading && !isAuthenticated;
    const deadline = transition.startedAt + (unauthenticated ? 1500 : 12_000);
    const timer = setTimeout(
      () => setTransition(null),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, transition]);

  useEffect(() => {
    if (pathname === "/tv" || pathname === CLI_HANDOFF_PATH) {
      return;
    }
    if (isLoading) {
      return;
    }
    if (!isAuthenticated) {
      if (pathname === "/login" || pathname === "/") {
        return;
      }
      if (pathname === CLI_AUTH_PATH) {
        stashReturnTo();
      }
      router.replace("/login");
      return;
    }
    if (!me) {
      return;
    }

    if (pathname === "/login") {
      const returnTo = peekReturnTo();
      if (returnTo) {
        router.replace(returnTo);
        return;
      }
    }
    // Any signed-in user may approve a CLI login; the participant gates
    // (pending / onboarding) apply to the CLI session itself, not here.
    if (pathname === CLI_AUTH_PATH) {
      clearReturnTo();
      return;
    }

    if (me.role === "admin") {
      // Admins must fill their profile like everyone else; the phone step is
      // only offered to those with an accepted signup, never forced.
      const profileDue = !me.profileComplete;
      const detailsDue = me.accepted && !me.onboardingComplete;
      if (profileDue) {
        if (pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
        return;
      }
      if (pathname === "/login") {
        router.replace("/");
        return;
      }
      if (pathname === "/onboarding" && !detailsDue) {
        router.replace("/");
      }
      if (pathname === "/pending" || pathname === "/unregistered") {
        router.replace("/");
      }
      return;
    }

    // Outside the hackathon window only the profile and the directory stay.
    if (!me.event.open && !isPathAllowedWhenClosed(pathname)) {
      router.replace("/");
      return;
    }

    // Hidden sections (CRM user type) bounce home; a judge without a signup
    // then continues to /judging through the ladder below.
    const section = sectionForPath(pathname);
    if (section && !me.sections.includes(section)) {
      router.replace("/");
      return;
    }

    // Judges by role or by user type may judge without a signup.
    if (me.canJudge) {
      if (pathname.startsWith("/admin")) {
        router.replace("/");
        return;
      }
      // Name, photo and card come before the judging panel; a judge without
      // a signup skips only the phone step inside the wizard.
      if (!me.profileComplete) {
        if (pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
        return;
      }
      if (pathname === "/judging" || pathname.startsWith("/judging")) {
        return;
      }
      if (pathname === "/login") {
        const next = destination(me);
        router.replace(next ?? "/");
        return;
      }
      const next = destination(me);
      if (next && pathname !== next) {
        if (
          next === "/pending" ||
          next === "/unregistered" ||
          next === "/onboarding"
        ) {
          router.replace("/judging");
          return;
        }
        router.replace(next);
        return;
      }
      if (
        !next &&
        (pathname === "/onboarding" ||
          pathname === "/unregistered" ||
          pathname === "/pending" ||
          pathname === "/login")
      ) {
        router.replace("/");
      }
      return;
    }

    const next = destination(me);
    if (next && pathname !== next) {
      router.replace(next);
      return;
    }
    if (
      !next &&
      (pathname === "/onboarding" ||
        pathname === "/unregistered" ||
        pathname === "/pending" ||
        pathname === "/login")
    ) {
      router.replace("/");
    }
    if (pathname.startsWith("/admin")) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, me, pathname, router]);

  // /tv is a public screen and /cli-auth/handoff creates the session itself;
  // render both without waiting on auth.
  if (pathname === "/tv" || pathname === CLI_HANDOFF_PATH) {
    return <>{children}</>;
  }

  const view = resolveView({ isAuthenticated, isLoading, me, pathname });
  // The curtain lifts only once the landing page itself is on screen, never
  // over "Cargando…" or the login card the gate remounts on the way.
  const revealReady =
    transition !== null && pathname !== "/login" && view === "page";

  return (
    <LoginTransitionProvider value={beginLoginTransition}>
      {view === "page" ? (
        children
      ) : view === "loading" ? (
        <div className="flex min-h-screen items-center justify-center bg-hs-paper px-4">
          <LoadingText />
        </div>
      ) : view === "splash" ? (
        <HomeSplash />
      ) : null}
      {transition ? (
        <LoginTransition
          email={transition.email}
          ready={revealReady}
          onDone={endLoginTransition}
        />
      ) : null}
    </LoginTransitionProvider>
  );
}

type Me = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;

/**
 * What the gate shows at this path: the page itself, the loading screen,
 * the public splash or nothing while the effect above redirects.
 */
function resolveView({
  isAuthenticated,
  isLoading,
  me,
  pathname,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  me: Me | null | undefined;
  pathname: string;
}): "page" | "loading" | "splash" | "blank" {
  if (isLoading || (isAuthenticated && me === undefined)) {
    return "loading";
  }

  if (!isAuthenticated && pathname === "/") {
    return "splash";
  }

  if (!isAuthenticated && pathname !== "/login") {
    return "blank";
  }

  if (me && me.role !== "admin" && pathname !== CLI_AUTH_PATH) {
    if (pathname.startsWith("/admin")) {
      return "blank";
    }
    if (!me.event.open && !isPathAllowedWhenClosed(pathname)) {
      return "blank";
    }
    const section = sectionForPath(pathname);
    if (section && !me.sections.includes(section)) {
      return "blank";
    }
    if (!me.profileComplete) {
      if (pathname !== "/onboarding") {
        return "blank";
      }
      // The effect keeps a judge here even without a signup; everyone else
      // still has to be registered and accepted first (ladder below).
      if (me.canJudge) {
        return "page";
      }
    }
    const judgingAllowed = me.canJudge && pathname.startsWith("/judging");
    if (!judgingAllowed) {
      const next = destination(me);
      if (
        me.canJudge &&
        next &&
        (next === "/pending" ||
          next === "/unregistered" ||
          next === "/onboarding")
      ) {
        if (pathname !== "/judging") {
          return "blank";
        }
      } else if (next && pathname !== next) {
        return "blank";
      }
    }
  }

  if (me?.role === "admin") {
    const profileDue = !me.profileComplete;
    const detailsDue = me.accepted && !me.onboardingComplete;
    if (profileDue && pathname !== "/onboarding") {
      return "blank";
    }
    if (pathname === "/onboarding" && !profileDue && !detailsDue) {
      return "blank";
    }
    if (pathname === "/pending" || pathname === "/unregistered") {
      return "blank";
    }
  }

  return "page";
}

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void signOut()}
    >
      Salir
    </Button>
  );
}
