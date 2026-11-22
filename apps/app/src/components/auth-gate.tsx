"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { isEventOpen } from "@/components/event-closed-banner";
import { HomeSplash } from "@/components/home-splash";
import { LoginTransitionProvider } from "@/components/login-transition-context";
import { LoadingText } from "@/components/page";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/auth-route";
import type { AuthMe } from "@/lib/auth-route";
import {
  CLI_AUTH_PATH,
  cliAuthReturnTo,
  safeCliAuthReturnTo,
} from "@/lib/cli-handoff";
import { isPublicAppPath } from "@/lib/public-paths";

const LoginTransition = dynamic(
  () =>
    import("@/components/login-transition").then((mod) => mod.LoginTransition),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-hs-paper">
        <p
          role="status"
          className="font-bungee text-xs tracking-wide text-hs-brown"
        >
          Entrando…
        </p>
      </div>
    ),
  }
);

type Me = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;

function toAuthMe(me: Me): AuthMe {
  return {
    accepted: me.accepted,
    admin: me.admin,
    canJudge: me.canJudge,
    event: { open: isEventOpen(me.event) },
    isRegistered: me.isRegistered,
    onboardingComplete: me.onboardingComplete,
    profileComplete: me.profileComplete,
    role: me.role,
    sections: me.sections,
  };
}

const CLI_HANDOFF_PATH = "/cli-auth/handoff";
const RETURN_TO_KEY = "hs-return-to";

function stashReturnTo(): void {
  const returnTo = cliAuthReturnTo(window.location);
  if (!returnTo) {
    return;
  }
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } catch {
    // Storage blocked; the user can reopen the link from the terminal.
  }
}

function peekReturnTo(): string | null {
  try {
    return safeCliAuthReturnTo(sessionStorage.getItem(RETURN_TO_KEY));
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

  useEffect(() => {
    if (!transition) {
      return;
    }
    const unauthenticated = !isLoading && !isAuthenticated;
    const deadline = transition.startedAt + (unauthenticated ? 1500 : 12_000);
    const timer = setTimeout(
      () => setTransition(null),
      Math.max(0, deadline - Date.now())
    );
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, transition]);

  useEffect(() => {
    if (isPublicAppPath(pathname) || pathname === CLI_HANDOFF_PATH) {
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
    if (pathname === CLI_AUTH_PATH) {
      clearReturnTo();
    }

    const next = route(toAuthMe(me), pathname);
    if (next) {
      router.replace(next);
    }
  }, [isAuthenticated, isLoading, me, pathname, router]);

  if (isPublicAppPath(pathname) || pathname === CLI_HANDOFF_PATH) {
    return <>{children}</>;
  }

  const view = resolveView({ isAuthenticated, isLoading, me, pathname });
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
  if (isLoading) {
    return "loading";
  }

  if (!isAuthenticated && pathname === "/") {
    return "splash";
  }

  if (!isAuthenticated && pathname !== "/login") {
    return "blank";
  }

  if (isAuthenticated && me === undefined) {
    return "page";
  }

  if (me) {
    const next = route(toAuthMe(me), pathname);
    if (next) {
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
