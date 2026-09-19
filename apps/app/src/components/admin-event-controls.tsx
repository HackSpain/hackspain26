"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, KeyRound, Mail, Radio, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FormError, FormNotice, LoadingText, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ScanResult = {
  checkedInAt: number;
  email: string;
  name: string;
  passId: Id<"eventPasses">;
  status: "checked_in" | "already_checked_in";
};

const PASS_CODE_CHARS = /[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g;

export function AdminEventControls() {
  const stats = useQuery(api.passes.stats);
  const issueAndEmailAccepted = useMutation(api.passes.issueAndEmailAccepted);
  const scan = useMutation(api.passes.scan);
  const undoCheckIn = useMutation(api.passes.undoCheckIn);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [sendingCodes, setSendingCodes] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!stats) {
    return <LoadingText />;
  }

  const total = Math.max(stats.expected ?? 0, stats.issued);
  const sent = stats.sent ?? 0;
  const codesReady = total > 0 && sent >= total;
  const completed = total > 0 && stats.checkedIn >= total;
  const currentStep = codesReady ? 1 : 0;
  const pace = (stats.checkInTimes ?? []).filter((at) => at >= now - 60_000).length;
  let finalStepText = `Faltan ${Math.max(total - stats.checkedIn, 0)} por llegar`;
  if (completed) {
    finalStepText = "Ya estamos todos";
  } else if (total === 0) {
    finalStepText = "Aún no hay participantes";
  } else if (!codesReady) {
    finalStepText = "Genera y envía los códigos para empezar";
  }
  const steps = [
    {
      title: "Enviar códigos de acceso",
      description: "Cada participante recibe su código personal por email.",
      icon: Mail,
    },
    {
      title: "Registrar llegadas",
      description: "Los admins pueden activar los códigos en cualquier momento.",
      icon: Radio,
    },
  ];

  async function activateCode() {
    const value = code.trim();
    if (value.length !== 4 || scanning) {
      return;
    }
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    setError(null);
    try {
      setScanResult(await scan({ value }));
      setCode("");
    } catch (caughtError) {
      setScanError(errorMessage(caughtError, "No se ha podido activar el código"));
    } finally {
      setScanning(false);
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
    }
  }

  async function undoLastCheckIn() {
    if (!scanResult || scanning) {
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      await undoCheckIn({ passId: scanResult.passId });
      setScanResult(null);
      codeInputRef.current?.focus();
    } catch (caughtError) {
      setScanError(errorMessage(caughtError, "No se ha podido deshacer el check-in"));
    } finally {
      setScanning(false);
    }
  }

  async function sendAccessCodes() {
    setSendingCodes(true);
    setError(null);
    setNotice(null);
    try {
      const result = await issueAndEmailAccepted({});
      setNotice(
        `${result.emailed} emails en cola. El progreso se actualizará al confirmar el envío.`,
      );
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No se han podido preparar los códigos"));
    } finally {
      setSendingCodes(false);
      setConfirmingSend(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gente dentro</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-bungee text-3xl tabular-nums text-hs-teal">
            {stats.checkedIn} / {total}
          </span>
          <span
            className="text-sm font-semibold tabular-nums text-hs-brown"
            title="Check-ins de los últimos 60 segundos"
          >
            Ritmo · {pace}/min
          </span>
        </CardContent>
      </Card>

      <FormError message={error} />
      <FormNotice message={notice} />

      <ol aria-label="Progreso de la entrada" className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => {
          const done = index < currentStep || (index === 1 && completed);
          const active = !completed && index === currentStep;
          const Icon = step.icon;
          let markerClass = "border-hs-ink/20 text-hs-brown";
          if (done) {
            markerClass = "border-hs-teal bg-hs-teal text-white";
          } else if (active) {
            markerClass = "border-hs-ink bg-hs-gold text-hs-ink";
          }
          let content: ReactNode;
          if (index === 0) {
            content = (
              <>
                <p className="text-sm tabular-nums text-hs-brown">
                  {sent} / {total} códigos enviados
                </p>
                {confirmingSend ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      Se enviarán los códigos pendientes a los participantes aceptados.
                    </p>
                    <Button
                      className="min-h-11 w-full"
                      disabled={sendingCodes}
                      onClick={() => void sendAccessCodes()}
                    >
                      {sendingCodes ? "Preparando…" : "Confirmar envío"}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={sendingCodes}
                      onClick={() => setConfirmingSend(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="min-h-11 w-full"
                    disabled={sendingCodes || codesReady || total === 0}
                    onClick={() => setConfirmingSend(true)}
                  >
                    {codesReady ? "Códigos enviados" : "Generar y enviar"}
                  </Button>
                )}
              </>
            );
          } else {
            content = (
              <p className="text-sm font-semibold tabular-nums text-hs-brown">{finalStepText}</p>
            );
          }
          return (
            <li
              key={step.title}
              className="relative flex min-w-0 flex-col"
              aria-current={active ? "step" : undefined}
            >
              <div className="mb-3 flex items-center gap-3" aria-hidden>
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums ${markerClass}`}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={`h-0.5 flex-1 ${done ? "bg-hs-teal" : "bg-hs-ink/15"}`} />
              </div>
              <Card className={`flex-1 ${active ? "border-hs-teal bg-hs-teal/5" : ""}`}>
                <CardHeader>
                  <Icon className="mb-2 size-6 text-hs-brown" strokeWidth={2} aria-hidden />
                  <CardTitle className="text-base text-balance">{step.title}</CardTitle>
                  <CardDescription className="text-pretty">{step.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">{content}</CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card className="border-hs-ink shadow-[6px_6px_0_#1d1a17]">
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-sm bg-hs-gold text-hs-ink">
            <KeyRound className="size-6" strokeWidth={2} aria-hidden />
          </div>
          <CardTitle>Activar código</CardTitle>
          <CardDescription className="text-pretty">
            Introduce el código de cuatro caracteres que recibió el participante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void activateCode();
            }}
          >
            <Input
              ref={codeInputRef}
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replaceAll(PASS_CODE_CHARS, "")
                    .slice(0, 4),
                )
              }
              placeholder="AB7K"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-20 text-center font-bungee text-4xl tracking-[0.22em] uppercase tabular-nums sm:text-5xl"
              aria-label="Código de check-in"
              inputMode="text"
              maxLength={4}
            />
            <Button
              type="submit"
              variant="teal"
              className="min-h-12 w-full"
              disabled={scanning || code.length !== 4}
            >
              {scanning ? "Activando…" : "Activar código"}
            </Button>
          </form>

          <div aria-live="polite" aria-atomic="true" className="space-y-3">
            {scanResult ? (
              <Card
                className={
                  scanResult.status === "checked_in"
                    ? "border-hs-teal bg-hs-teal/10"
                    : "border-hs-gold bg-hs-gold/15"
                }
              >
                <CardHeader>
                  <CardTitle>
                    {scanResult.status === "checked_in"
                      ? "Check-in completado"
                      : "Ya estaba dentro"}
                  </CardTitle>
                  <CardDescription>
                    <span className="font-semibold text-hs-ink">{scanResult.name}</span>
                    <br />
                    {scanResult.email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="min-h-11 w-full"
                    disabled={scanning}
                    onClick={() => void undoLastCheckIn()}
                  >
                    <RotateCcw aria-hidden />
                    Deshacer check-in
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {scanError ? (
              <Card className="border-hs-red bg-hs-red/10">
                <CardHeader>
                  <div className="flex size-12 items-center justify-center rounded-sm bg-hs-red text-white">
                    <X className="size-7" strokeWidth={2} aria-hidden />
                  </div>
                  <CardTitle>Código rechazado</CardTitle>
                  <CardDescription className="text-pretty text-hs-ink">
                    {scanError}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
