"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@convex/_generated/api";
import { AuthScreen, FormError, LoadingText, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CliAuthCard() {
  // Not `?code=`: the Convex Auth middleware consumes and strips a `code`
  // query param on every route (its own OAuth/magic-link verifier).
  const code = useSearchParams().get("hs-code")?.trim() ?? "";
  const approve = useMutation(api.cliAuth.approve);
  const [pending, setPending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    setError(null);
    setPending(true);
    try {
      await approve({ code });
      setApproved(true);
    } catch (err) {
      setError(errorMessage(err, "No se ha podido autorizar la CLI."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="hs-enter w-full max-w-md">
      <CardHeader>
        <p className="font-bungee text-xs text-hs-brown">HackSpain 2026</p>
        <CardTitle className="text-2xl sm:text-3xl">Autorizar la CLI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {approved ? (
          <>
            <p className="text-sm text-hs-brown">
              CLI autorizada. Vuelve a la terminal: la sesión se completa sola.
              Ya puedes cerrar esta pestaña.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Ir al panel</Link>
            </Button>
          </>
        ) : code ? (
          <>
            <p className="text-sm text-hs-brown">
              Una terminal con la CLI de HackSpain pide entrar con tu cuenta.
              Si no has ejecutado{" "}
              <code className="text-hs-ink">hackspain auth login</code> ahora
              mismo, no la autorices.
            </p>
            <p className="break-all rounded-md border-2 border-hs-ink bg-hs-sand px-3 py-2 text-center font-mono text-sm">
              {code}
            </p>
            <FormError message={error} />
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={() => void authorize()}
            >
              {pending ? "Autorizando…" : "Autorizar esta CLI"}
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Cancelar</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-hs-brown">
            Falta el código. Ejecuta{" "}
            <code className="text-hs-ink">hackspain auth login</code> en tu
            terminal y abre el enlace que imprime.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CliAuthPage() {
  return (
    <AuthScreen>
      <Suspense fallback={<LoadingText />}>
        <CliAuthCard />
      </Suspense>
    </AuthScreen>
  );
}
