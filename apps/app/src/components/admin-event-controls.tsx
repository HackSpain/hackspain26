"use client";

import { useMutation, useQuery } from "convex/react";
import { CalendarClock, Check, Flag, Mail, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { FormError, FormNotice, LoadingText, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminEventControls() {
  const event = useQuery(api.event.status);
  const stats = useQuery(api.passes.stats);
  const setPhase = useMutation(api.event.setPhase);
  const issueAndEmailAccepted = useMutation(api.passes.issueAndEmailAccepted);
  const [saving, setSaving] = useState(false);
  const [sendingCodes, setSendingCodes] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!event || !stats) {
    return <LoadingText />;
  }

  const total = Math.max(stats.expected ?? 0, stats.issued);
  const sent = stats.sent ?? 0;
  const codesReady = total > 0 && sent >= total;
  const completed = total > 0 && stats.checkedIn >= total;
  let currentStep = 0;
  if (completed) {
    currentStep = 3;
  } else if (event.phase === "live") {
    currentStep = 2;
  } else if (codesReady) {
    currentStep = 1;
  }
  const pace = (stats.checkInTimes ?? []).filter((at) => at >= now - 60_000).length;
  let openButtonLabel = "Abrir check-in";
  if (saving) {
    openButtonLabel = "Abriendo…";
  } else if (completed) {
    openButtonLabel = "Completado";
  } else if (event.phase === "live") {
    openButtonLabel = "Check-in abierto";
  }
  let finalStepText = `Faltan ${Math.max(total - stats.checkedIn, 0)} por llegar`;
  if (completed) {
    finalStepText = "Ya estamos todos";
  } else if (total === 0) {
    finalStepText = "Aún no hay participantes";
  }
  const steps = [
    {
      title: "Enviar códigos de acceso",
      description: "Cada participante recibe su código personal por email.",
      icon: Mail,
    },
    {
      title: "Antes del evento",
      description: "Todo preparado. Los participantes tienen su código y esperan a la apertura.",
      icon: CalendarClock,
    },
    {
      title: "Check-in abierto",
      description: "Cada llegada desbloquea la app para ese participante.",
      icon: Radio,
    },
    {
      title: "Check-in finalizado",
      description: "Todos dentro. La app sigue disponible y el hackathon continúa.",
      icon: Flag,
    },
  ];

  async function openCheckIn() {
    setSaving(true);
    setError(null);
    try {
      await setPhase({ phase: "live" });
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No se ha podido abrir el check-in"));
    } finally {
      setSaving(false);
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

      <ol aria-label="Progreso de la entrada" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const done = index < currentStep || (index === 3 && completed);
          const active = index === currentStep;
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
          } else if (index === 1) {
            content = (
              <p className="text-sm font-semibold text-hs-brown">
                {codesReady ? "Listos para recibir a todos" : "Pendiente del envío"}
              </p>
            );
          } else if (index === 2) {
            content = (
              <>
                <p className="text-xs text-pretty text-hs-brown">
                  Apertura: 18 de septiembre, 10:00 (Madrid). En local puedes probarlo antes.
                </p>
                <Button
                  variant="teal"
                  className="min-h-11 w-full"
                  disabled={saving || event.phase === "live" || completed}
                  onClick={() => void openCheckIn()}
                >
                  {openButtonLabel}
                </Button>
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
    </div>
  );
}
