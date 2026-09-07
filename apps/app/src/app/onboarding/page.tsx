"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  AuthScreen,
  Field,
  FormError,
  LoadingText,
  errorMessage,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { phoneVerifyMessage } from "@/lib/utils";

const SHAKE = [0, -7, 7, -5, 5, 0] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const status = useQuery(api.onboarding.status);
  const requestPhoneCode = useMutation(api.onboarding.requestPhoneCode);
  const verifyPhoneCode = useMutation(api.onboarding.verifyPhoneCode);
  const confirmDetails = useMutation(api.onboarding.confirmDetails);

  const [phoneDraft, setPhoneDraft] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [phoneToast, setPhoneToast] = useState<{
    body: string;
    code?: string;
  } | null>(null);
  const [travelDraft, setTravelDraft] = useState<string | undefined>();
  const [consentDraft, setConsentDraft] = useState<boolean | undefined>();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentWarned, setConsentWarned] = useState(false);
  const [consentShake, setConsentShake] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const phone = phoneDraft ?? status?.phone ?? "";
  const travelOrigin = travelDraft ?? status?.travelOrigin ?? "";
  const consent = consentDraft ?? status?.notificationConsent ?? false;

  useEffect(() => {
    if (!phoneToast || phoneToast.code) {
      return;
    }
    const timer = window.setTimeout(() => setPhoneToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [phoneToast]);

  if (status === undefined) {
    return (
      <AuthScreen>
        <LoadingText />
      </AuthScreen>
    );
  }

  const { smsConfigured } = status;

  async function sendPhone() {
    setError(null);
    setPending(true);
    try {
      const result = await requestPhoneCode({ phone });
      setAwaitingCode(true);
      setPhoneToast({
        body: smsConfigured
          ? "Te está llegando un SMS."
          : "El SMS no está configurado. En local el código aparece aquí y en los logs de Convex. No se confirma solo.",
        code: result.debugCode,
      });
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No hemos podido enviar el código"));
    } finally {
      setPending(false);
    }
  }

  async function confirmPhone() {
    setError(null);
    setPending(true);
    try {
      const result = await verifyPhoneCode({ code });
      if (result.ok) {
        setPhoneToast(null);
        setAwaitingCode(false);
        setCode("");
      } else {
        setError(phoneVerifyMessage(result.reason));
        if (result.reason !== "incorrect") {
          setAwaitingCode(false);
          setCode("");
          setPhoneToast(null);
        }
      }
    } catch (caughtError) {
      setError(
        errorMessage(caughtError, "No hemos podido verificar el teléfono")
      );
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    if (!consent && !consentWarned) {
      setConsentWarned(true);
      setConsentShake((n) => n + 1);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await confirmDetails({
        consent,
        termsAccepted,
        travelOrigin,
      });
      router.replace("/");
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No hemos podido guardar tus datos"));
    } finally {
      setPending(false);
    }
  }

  const { phoneConfirmed } = status;

  return (
    <AuthScreen>
      <Card className="hs-enter w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl">
            Confirma tus datos
          </CardTitle>
          <CardDescription>
            Teléfono y desde dónde viajas. La dieta ya la tenemos de la
            inscripción; puedes cambiarla en tu perfil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormError message={error} />

          <div className="space-y-4">
            {phoneConfirmed ? (
              <Field label="Teléfono (E.164)" htmlFor="phone">
                <Input id="phone" value={status.phone ?? phone} disabled />
              </Field>
            ) : awaitingCode ? (
              <Field label="Código" htmlFor="phone-code">
                <div className="flex gap-2">
                  <Input
                    id="phone-code"
                    className="min-w-0 flex-1"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <Button
                    className="shrink-0"
                    onClick={() => void confirmPhone()}
                    disabled={pending}
                  >
                    {pending ? "Comprobando…" : "Verificar"}
                  </Button>
                </div>
                <p className="text-sm text-hs-brown">
                  Enviado a {phone}.{" "}
                  <button
                    type="button"
                    className="text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
                    onClick={() => {
                      setAwaitingCode(false);
                      setCode("");
                      setPhoneToast(null);
                    }}
                  >
                    Cambiar teléfono
                  </button>
                </p>
              </Field>
            ) : (
              <Field label="Teléfono (E.164)" htmlFor="phone">
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    className="min-w-0 flex-1"
                    placeholder="+34600111222"
                    value={phone}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                  />
                  <Button
                    className="shrink-0"
                    onClick={() => void sendPhone()}
                    disabled={pending}
                  >
                    {pending ? "Enviando…" : "Enviar código"}
                  </Button>
                </div>
              </Field>
            )}
          </div>

          <Field label="¿Desde dónde viajas?" htmlFor="travel-origin">
            <Input
              id="travel-origin"
              placeholder="Ciudad o región"
              value={travelOrigin}
              onChange={(event) => setTravelDraft(event.target.value)}
            />
          </Field>

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(value) => setTermsAccepted(value === true)}
              />
              <span>
                Acepto los{" "}
                <a
                  href="https://hackspain.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  términos
                </a>{" "}
                y la{" "}
                <a
                  href="https://hackspain.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  política de privacidad
                </a>{" "}
                de HackSpain y de la Asociación Exponential Fellowship, y me
                comprometo a cumplir el{" "}
                <a
                  href="https://hackspain.com/conduct"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  código de conducta
                </a>
                .
              </span>
            </label>
            <motion.label
              className="flex items-start gap-3 text-sm"
              animate={
                consentShake > 0 && !reduceMotion ? { x: [...SHAKE] } : { x: 0 }
              }
              transition={{
                duration: 0.32,
                ease: [0.23, 1, 0.32, 1],
              }}
              key={consentShake}
            >
              <Checkbox
                checked={consent}
                onCheckedChange={(value) => {
                  setConsentDraft(value === true);
                  if (value === true) {
                    setConsentWarned(false);
                  }
                }}
              />
              <span>
                Quiero avisos operativos de HackSpain (horario, perks y
                novedades del evento).
                {consentWarned && !consent ? (
                  <span className="mt-1 block text-hs-navy">
                    ¿Seguro? Sin esto no te llega el horario ni las novedades.
                    Confirma otra vez si no los quieres.
                  </span>
                ) : null}
              </span>
            </motion.label>
          </div>

          <Button
            className="w-full sm:w-auto"
            disabled={pending || !termsAccepted}
            onClick={() => void finish()}
          >
            {pending ? "Guardando…" : "Confirmar"}
          </Button>
        </CardContent>
      </Card>
      <AnimatePresence>
        {phoneToast ? (
          <motion.div
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md border-[3px] border-hs-ink bg-hs-sand px-3 py-2.5 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-hs-brown">{phoneToast.body}</p>
                {phoneToast.code ? (
                  <p className="font-bungee text-hs-navy">
                    Código de prueba: {phoneToast.code}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 font-bungee text-xs underline underline-offset-2"
                onClick={() => setPhoneToast(null)}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AuthScreen>
  );
}
