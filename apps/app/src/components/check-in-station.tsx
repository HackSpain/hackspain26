"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, KeyRound, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { LoadingText, Page, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CheckInResult = {
  checkedInAt: number;
  email: string;
  name: string;
  passId: Id<"eventPasses">;
  status: "checked_in" | "already_checked_in";
};

export function CheckInStation() {
  const staffStatus = useQuery(api.passes.staffStatus);
  const staffScan = useMutation(api.passes.staffScan);
  const staffUndoCheckIn = useMutation(api.passes.staffUndoCheckIn);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ at: number; value: string } | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const live = Boolean(
    staffStatus &&
    (staffStatus.development || (staffStatus.phase === "live" && now >= staffStatus.opensAt)),
  );
  const closedMessage =
    staffStatus && now < staffStatus.opensAt
      ? "El check-in se activará el 18 de septiembre de 2026 a las 10:00."
      : "El responsable debe activar primero el evento en directo.";

  useEffect(() => {
    if (!staffStatus || staffStatus.development || now >= staffStatus.opensAt) {
      return;
    }
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(staffStatus.opensAt - now + 250, 60_000),
    );
    return () => window.clearTimeout(timeout);
  }, [now, staffStatus]);

  const processCode = useCallback(async () => {
    const value = code.trim();
    if (value.length !== 4 || busyRef.current) {
      return;
    }
    if (!live) {
      setError(closedMessage);
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
      const next = await staffScan({ value });
      setResult(next);
      setCode("");
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
  }, [closedMessage, code, live, staffScan]);

  async function undo() {
    if (!result) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await staffUndoCheckIn({ passId: result.passId });
      setResult(null);
      lastCodeRef.current = null;
      inputRef.current?.focus();
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No se ha podido deshacer el check-in"));
    } finally {
      setPending(false);
    }
  }

  if (staffStatus === undefined) {
    return <LoadingText />;
  }

  return (
    <Page
      className="mx-auto max-w-2xl px-4 py-6 sm:py-10"
      title="Entrada HackSpain"
      description="Introduce el código de cuatro caracteres que recibió el participante por email."
    >
      {!live ? (
        <Card className="border-hs-gold bg-hs-gold/15">
          <CardHeader>
            <CardTitle>El check-in está cerrado</CardTitle>
            <CardDescription>{closedMessage}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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
              disabled={!live}
              inputMode="text"
              maxLength={4}
            />
            <Button
              type="submit"
              variant="teal"
              className="min-h-12 w-full"
              disabled={!live || pending || code.length !== 4}
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
