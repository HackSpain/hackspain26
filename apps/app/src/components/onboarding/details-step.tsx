"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { errorMessage, Field, FormError, LoadingText } from "@/components/page";
import type { PhoneState } from "@/components/phone-input";
import { PhoneInput } from "@/components/phone-input";
import { StepNav } from "./step-nav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const SHAKE = [0, -7, 7, -5, 5, 0] as const;

/**
 * Phone, terms and notification consent: the step that sets
 * `users.onboardingComplete`. The number is stored as typed, not verified. Its functions are `accepted*`, so the wizard
 * only mounts this for users with an accepted signup.
 */
export function DetailsStep({
  onDone,
  onBack,
}: {
  onDone: () => void;
  onBack?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const status = useQuery(api.onboarding.status);
  const confirmDetails = useMutation(api.onboarding.confirmDetails);

  const [phoneDraft, setPhoneDraft] = useState<PhoneState | undefined>();
  const [consentDraft, setConsentDraft] = useState<boolean | undefined>();
  const [termsDraft, setTermsDraft] = useState<boolean | undefined>();
  const [consentWarned, setConsentWarned] = useState(false);
  const [consentShake, setConsentShake] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Until the field is touched, the stored number (already E.164) stands.
  const phone = phoneDraft?.e164 ?? status?.phone ?? "";
  const phoneError = phoneDraft ? phoneDraft.error : phone ? null : "Escribe tu número.";
  const consent = consentDraft ?? status?.notificationConsent ?? false;
  // Coming back to this step after finishing it, the terms are already accepted.
  const termsAccepted = termsDraft ?? status?.onboardingComplete ?? false;

  if (status === undefined) {
    return <LoadingText />;
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
      await confirmDetails({ consent, phone, termsAccepted });
      onDone();
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No hemos podido guardar tus datos"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormError message={error} />

      <Field
        label="Teléfono de contacto"
        htmlFor="phone"
        hint="Solo para localizarte en el evento."
      >
        <PhoneInput
          id="phone"
          value={status.phone}
          disabled={pending}
          onChange={setPhoneDraft}
        />
      </Field>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={termsAccepted}
            onCheckedChange={(value) => setTermsDraft(value === true)}
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
            Quiero avisos operativos de HackSpain (horario, perks y novedades
            del evento).
            {consentWarned && !consent ? (
              <span className="mt-1 block text-hs-navy">
                ¿Seguro? Sin esto no te llega el horario ni las novedades.
                Confirma otra vez si no los quieres.
              </span>
            ) : null}
          </span>
        </motion.label>
      </div>

      <StepNav onBack={onBack} disabled={pending}>
        <Button
          disabled={pending || !termsAccepted || phoneError !== null}
          onClick={() => void finish()}
        >
          {pending ? "Guardando…" : status.onboardingComplete ? "Continuar" : "Confirmar"}
          <ArrowRight aria-hidden />
        </Button>
      </StepNav>
    </div>
  );
}
