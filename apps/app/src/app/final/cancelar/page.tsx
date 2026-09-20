"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { FormError, LoadingText, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";

type View = "confirm" | "canceled" | "already" | "invalid";

function helloLine(firstName: string) {
  if (!firstName || firstName === "hacker") {
    return "Hola.";
  }
  return `Hola, ${firstName}.`;
}

function thanksLine(firstName: string) {
  if (!firstName || firstName === "hacker") {
    return "Gracias por avisarnos.";
  }
  return `Gracias por avisarnos, ${firstName}.`;
}

function CancelCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-hs-paper px-4 py-10">
      <section
        aria-labelledby="cancel-title"
        className="w-full max-w-xl border-[3px] border-hs-ink bg-hs-paper p-6 shadow-[8px_8px_0_var(--color-hs-ink)] sm:p-10"
      >
        <a
          href="https://hackspain.com"
          aria-label="Ir a la página de inicio de HackSpain"
          className="inline-block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-navy"
        >
          <img src="/logo.svg" width="176" height="56" alt="HackSpain" />
        </a>
        <h1
          id="cancel-title"
          className="mt-8 font-bungee text-3xl leading-tight text-balance text-hs-ink sm:text-4xl"
        >
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}

function viewFrom(
  done: View | null,
  lookup: { firstName: string; status: "in" | "canceled" } | null | undefined,
): View {
  if (done) {
    return done;
  }
  if (lookup === null || lookup === undefined) {
    return "invalid";
  }
  if (lookup.status === "canceled") {
    return "already";
  }
  return "confirm";
}

function CancelFlow() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const lookup = useQuery(api.finalists.lookup, token ? { token } : "skip");
  const cancel = useMutation(api.finalists.cancel);
  const [done, setDone] = useState<View | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!token) {
    return (
      <CancelCard title="Enlace no válido">
        <p className="mt-5 text-lg leading-relaxed text-pretty">
          Este enlace no corresponde a una plaza de la final. Comprueba que lo
          has copiado completo desde el correo.
        </p>
      </CancelCard>
    );
  }

  if (lookup === undefined && done === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-hs-paper px-4">
        <LoadingText />
      </main>
    );
  }

  const view = viewFrom(done, lookup);
  const firstName = lookup?.firstName ?? "";

  async function confirm() {
    if (pending) {
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const result = await cancel({ token });
      setDone(result === "invalid" ? "invalid" : result);
    } catch (error) {
      setFormError(errorMessage(error, "No se ha podido cancelar"));
    } finally {
      setPending(false);
    }
  }

  if (view === "invalid") {
    return (
      <CancelCard title="Enlace no válido">
        <p className="mt-5 text-lg leading-relaxed text-pretty">
          Este enlace no corresponde a una plaza de la final. Comprueba que lo
          has copiado completo desde el correo.
        </p>
      </CancelCard>
    );
  }

  if (view === "already") {
    return (
      <CancelCard title="Ya estaba cancelada">
        <p className="mt-5 text-lg leading-relaxed text-pretty">
          No tienes que hacer nada más. Ya habíamos registrado esta cancelación.
        </p>
      </CancelCard>
    );
  }

  if (view === "canceled") {
    return (
      <CancelCard title="Plaza cancelada">
        <p className="mt-5 text-lg leading-relaxed text-pretty">
          {thanksLine(firstName)} Liberamos tu plaza de la final.
        </p>
      </CancelCard>
    );
  }

  return (
    <CancelCard title="¿Seguro que quieres cancelar?">
      <p className="mt-5 text-lg leading-relaxed text-pretty">
        {helloLine(firstName)} Si confirmas, sales de la final y podemos dar el
        hueco a otra persona.
      </p>
      <p className="mt-3 font-bold">Esta acción no se puede deshacer desde este enlace.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          aria-busy={pending}
          className="border-hs-ink bg-hs-red text-hs-paper"
          onClick={() => void confirm()}
        >
          {pending ? "Cancelando…" : "Sí, cancelar mi plaza"}
        </Button>
        <Button asChild variant="outline">
          <a href="https://hackspain.com">No cancelar</a>
        </Button>
      </div>
      <FormError message={formError} />
    </CancelCard>
  );
}

export default function FinalCancelPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-hs-paper px-4">
          <LoadingText />
        </main>
      }
    >
      <CancelFlow />
    </Suspense>
  );
}
