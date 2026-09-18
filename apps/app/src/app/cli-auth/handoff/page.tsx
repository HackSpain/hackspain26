"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthScreen, FormError, LoadingText } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/cli-handoff";
import { usePrivateUrlParameter } from "@/lib/private-url-parameter";

const EXPIRED_MESSAGE =
  "Este enlace ya se ha usado o ha caducado. Vuelve a ejecutar hackspain open en tu terminal.";

/**
 * `hackspain open` lands here with a single-use token minted by the CLI's
 * session. Signing in with the `cli-handoff` provider goes through the
 * Convex Auth proxy, which sets the normal dashboard cookies, so the browser
 * is logged in as the same person without a second code.
 *
 * New CLI versions keep the token in the URL fragment so it never reaches
 * server logs. The query fallback preserves links printed by older versions.
 */
function HandoffCard() {
  const params = useSearchParams();
  const queryToken = params.get("hs-token")?.trim() ?? "";
  const next = safeNextPath(params.get("next"));
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { ready: credentialsReady, value: token } = usePrivateUrlParameter(
    "hs-token",
    queryToken
  );

  useEffect(() => {
    if (!credentialsReady || isLoading || started.current) {
      return;
    }
    started.current = true;
    // Already signed in (a reopened link, a second tab): a failed redeem
    // would clear the cookies, so skip it and just go where the CLI asked.
    if (isAuthenticated) {
      router.replace(next);
      return;
    }
    if (!token) {
      setError(
        "Falta el token. Ejecuta hackspain open en tu terminal y abre el enlace que imprime.",
      );
      return;
    }
    async function redeem() {
      try {
        const result = await signIn("cli-handoff", { token });
        if (result.signingIn) {
          router.replace(next);
          return;
        }
      } catch {
        // Fall through: the token was already used, expired, or forged.
      }
      setError(EXPIRED_MESSAGE);
    }
    void redeem();
  }, [credentialsReady, isAuthenticated, isLoading, next, router, signIn, token]);

  return (
    <Card className="hs-enter w-full max-w-md">
      <CardHeader>
        <p className="font-bungee text-xs text-hs-brown">HackSpain 2026</p>
        <CardTitle className="text-2xl sm:text-3xl">
          {error ? "Enlace no válido" : "Entrando desde la CLI"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <>
            <FormError message={error} />
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Entrar con el email</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-hs-brown" role="status">
            Un momento: estamos abriendo tu sesión con la cuenta de la
            terminal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CliHandoffPage() {
  return (
    <AuthScreen>
      <Suspense fallback={<LoadingText />}>
        <HandoffCard />
      </Suspense>
    </AuthScreen>
  );
}
