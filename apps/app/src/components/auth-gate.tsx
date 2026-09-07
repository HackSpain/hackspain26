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
  if (!me.isRegistered) {
    return "/unregistered";
  }
  if (!me.accepted) {
    return "/pending";
  }
  if (!me.onboardingComplete) {
    return "/onboarding";
  }
  return null;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const attachAfterLogin = useMutation(api.users.attachAfterLogin);

  useEffect(() => {
    if (!isAuthenticated || !me) {
      return;
    }
    void attachAfterLogin({});
  }, [attachAfterLogin, isAuthenticated, me]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }
    if (!me) {
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

  if (me && me.role !== "admin") {
    if (pathname.startsWith("/admin")) {
      return null;
    }
    const next = destination(me);
    if (next && pathname !== next) {
      return null;
    }
  }

  if (me?.role === "admin") {
    const canConfirm = me.accepted && !me.onboardingComplete;
    if (pathname === "/onboarding" && !canConfirm) {
      return null;
    }
    if (pathname === "/pending" || pathname === "/unregistered") {
      return null;
    }
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
