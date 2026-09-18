"use client";

import { Check, KeyRound, Monitor, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingText, Page, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CheckInResult = {
  checkedInAt: number;
  email: string;
  name: string;
  passId: string;
  status: "checked_in" | "already_checked_in";
};

type StaffStatus = {
  checkedIn: number;
  issued: number;
};

type ReceptionAction =
  | { action: "scan"; value: string }
  | { action: "undo"; passId: string };

async function receptionRequest<T>(action?: ReceptionAction): Promise<T> {
  const response = await fetch("/api/reception", {
    body: action ? JSON.stringify(action) : undefined,
    cache: "no-store",
    headers: action ? { "Content-Type": "application/json" } : undefined,
    method: action ? "POST" : "GET",
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "No se ha podido conectar con el check-in";
    throw new Error(message);
  }
  return body as T;
}

export function CheckInStation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ at: number; value: string } | null>(null);
  const [staffStatus, setStaffStatus] = useState<StaffStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loadStatus = useCallback(async () => {
    try {
      const next = await receptionRequest<StaffStatus>();
      setStaffStatus(next);
      setStatusError(null);
    } catch (caughtError) {
      setStatusError(
        errorMessage(caughtError, "No se ha podido cargar el check-in")
      );
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const processCode = useCallback(async () => {
    const value = code.trim();
    if (value.length !== 4 || busyRef.current) {
      return;
    }
    const previous = lastCodeRef.current;
    if (previous?.value === value && Date.now() - previous.at < 5000) {
      return;
    }
    busyRef.current = true;
    lastCodeRef.current = { at: Date.now(), value };
    setPending(true);
    setError(null);
    try {
      const next = await receptionRequest<CheckInResult>({
        action: "scan",
        value,
      });
      setResult(next);
      setCode("");
      void loadStatus();
      navigator.vibrate?.(80);
    } catch (caughtError) {
      setResult(null);
      setError(errorMessage(caughtError, "No se ha podido validar el código"));
      navigator.vibrate?.([80, 50, 80]);
    } finally {
      busyRef.current = false;
      setPending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [code, loadStatus]);

  async function undo() {
    if (!result) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await receptionRequest({ action: "undo", passId: result.passId });
      setResult(null);
      lastCodeRef.current = null;
      void loadStatus();
      inputRef.current?.focus();
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No se ha podido deshacer el check-in"));
    } finally {
      setPending(false);
    }
  }

  if (!staffStatus && !statusError) {
    return <LoadingText />;
  }

  if (!staffStatus) {
    return (
      <Page
        className="mx-auto max-w-2xl px-4 py-6 sm:py-10"
        title="Entrada HackSpain"
        description="Introduce el código de cuatro caracteres que recibió el participante por email."
      >
        <Card className="border-hs-red bg-hs-red/10">
          <CardHeader>
            <CardTitle>No se puede cargar el check-in</CardTitle>
            <CardDescription className="text-hs-ink">
              {statusError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void loadStatus()}>Reintentar</Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      className="mx-auto max-w-2xl px-4 py-6 sm:py-10"
      title="Entrada HackSpain"
      description="Introduce el código de cuatro caracteres que recibió el participante por email."
    >
      <Button asChild variant="outline">
        <a href="/tv?view=entradas" target="_blank" rel="noreferrer">
          <Monitor aria-hidden /> Abrir pantalla de bienvenida
        </a>
      </Button>

      <Card>
        <CardHeader className="gap-1">
          <CardDescription>Check-ins completados</CardDescription>
          <CardTitle className="text-3xl tabular-nums text-hs-teal">
            {staffStatus.checkedIn} / {staffStatus.issued}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="border-hs-ink shadow-[6px_6px_0_#1d1a17]">
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-sm bg-hs-gold text-hs-ink">
            <KeyRound className="size-6" strokeWidth={2} aria-hidden />
          </div>
          <CardTitle>Validar código</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void processCode();
            }}
          >
            <Input
              ref={inputRef}
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replaceAll(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
                    .slice(0, 4),
                )
              }
              placeholder="AB7K"
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              className="h-20 text-center font-bungee text-4xl tracking-[0.22em] uppercase tabular-nums sm:text-5xl"
              aria-label="Código de acceso"
              inputMode="text"
              maxLength={4}
            />
            <Button
              type="submit"
              variant="teal"
              className="min-h-12 w-full"
              disabled={pending || code.length !== 4}
            >
              {pending ? "Validando…" : "Marcar como dentro"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div aria-live="polite" aria-atomic="true">
        {result ? (
          <Card
            className={
              result.status === "checked_in"
                ? "border-hs-teal bg-hs-teal/10"
                : "border-hs-gold bg-hs-gold/15"
            }
          >
            <CardHeader>
              <div
                className={
                  result.status === "checked_in"
                    ? "flex size-12 items-center justify-center rounded-sm bg-hs-teal text-white"
                    : "flex size-12 items-center justify-center rounded-sm bg-hs-gold text-hs-ink"
                }
              >
                <Check className="size-7" strokeWidth={2} aria-hidden />
              </div>
              <CardTitle>
                {result.status === "checked_in" ? "Check-in completado" : "Ya estaba dentro"}
              </CardTitle>
              <CardDescription>
                <span className="font-semibold text-hs-ink">{result.name}</span>
                <br />
                {result.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-hs-brown">
                Registrado a las{" "}
                <span className="font-semibold tabular-nums text-hs-ink">
                  {new Date(result.checkedInAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </p>
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={pending}
                onClick={() => void undo()}
              >
                <RotateCcw aria-hidden />
                Deshacer check-in
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-hs-red bg-hs-red/10">
            <CardHeader>
              <div className="flex size-12 items-center justify-center rounded-sm bg-hs-red text-white">
                <X className="size-7" strokeWidth={2} aria-hidden />
              </div>
              <CardTitle>Código rechazado</CardTitle>
              <CardDescription className="text-pretty text-hs-ink">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </Page>
  );
}
