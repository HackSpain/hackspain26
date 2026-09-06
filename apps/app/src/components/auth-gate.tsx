"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@convex/_generated/api";
import { LoadingText } from "@/components/page";
import { Button } from "@/components/ui/button";

function destination(me: {
  role: "user" | "admin";
  isRegistered: boolean;
  accepted: boolean;
  onboardingComplete: boolean;
}): string | null {
  if (!me.isRegistered) return "/unregistered";
  if (!me.accepted) return "/pending";
  if (!me.onboardingComplete) return "/onboarding";
  return null;
}

// /cli-auth approves a CLI login and carries a one-time ?code=. The code is
// preserved through the login redirect via sessionStorage, since neither the
// middleware nor this gate has a returnTo query.
const CLI_AUTH_PATH = "/cli-auth";
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

  useEffect(() => {
    if (!isAuthenticated || !me) return;
    void attachAfterLogin({});
  }, [attachAfterLogin, isAuthenticated, me]);

  useEffect(() => {
    if (pathname === "/tv") return;
    if (isLoading) return;
    if (!isAuthenticated) {
      if (pathname !== "/login") {
        if (pathname === CLI_AUTH_PATH) stashReturnTo();
        router.replace("/login");
      }
      return;
    }
    if (!me) return;

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
      if (pathname === "/login") {
        router.replace("/");
        return;
      }
      const canConfirm = me.accepted && !me.onboardingComplete;
      if (pathname === "/onboarding" && !canConfirm) {
        router.replace("/");
      }
      if (pathname === "/pending" || pathname === "/unregistered") {
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

  // /tv is a public screen; render it without waiting on auth.
  if (pathname === "/tv") {
    return <>{children}</>;
  }

  if (isLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hs-paper px-4">
        <LoadingText />
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  if (me && me.role !== "admin" && pathname !== CLI_AUTH_PATH) {
    if (pathname.startsWith("/admin")) return null;
    const next = destination(me);
    if (next && pathname !== next) return null;
  }

  if (me?.role === "admin") {
    const canConfirm = me.accepted && !me.onboardingComplete;
    if (pathname === "/onboarding" && !canConfirm) return null;
    if (pathname === "/pending" || pathname === "/unregistered") return null;
  }

  return <>{children}</>;
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
