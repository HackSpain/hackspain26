"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LoginErrorCode } from "@/app/api/login/otp/route";
import { AuthScreen, Field, FormError, FormNotice } from "@/components/page";
import {
  EASE_OUT,
  reducedStepVariants,
  stepVariants,
  useMeasuredHeight,
} from "@/components/step-motion";
import type { Direction } from "@/components/step-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const CODE_LENGTH = 8;
/** Seconds before "Reenviar" works again, so a nervous tap does not queue emails. */
const RESEND_COOLDOWN_S = 30;

const NETWORK_MESSAGE = "No hay conexión. Comprueba tu red e inténtalo otra vez.";

/**
 * Copy for every way the send step can fail. `code` comes from
 * /api/login/otp; NETWORK is the fetch itself failing, UNKNOWN an answer
 * the page does not understand. Signups are closed, so the unregistered
 * copy points at the organisers rather than at the form.
 */
const SEND_ERROR_MESSAGE: Record<LoginErrorCode | "NETWORK" | "UNKNOWN", string> = {
  BOT: "No hemos podido comprobar que eres una persona. Recarga la página e inténtalo otra vez.",
  INVALID_EMAIL: "Ese email no parece válido. Revísalo e inténtalo otra vez.",
  NETWORK: NETWORK_MESSAGE,
  SEND_FAILED: "No hemos podido enviar el código ahora mismo. Inténtalo en un minuto.",
  UNKNOWN: "No hemos podido enviar el código. Inténtalo otra vez.",
  UNREGISTERED:
    "No encontramos ninguna inscripción con ese email. Prueba con el email que usaste al apuntarte; si crees que falta tu solicitud, escribe a la organización.",
};

/** Swallow a rejection so the caller can branch on it without a catch parameter. */
async function attempt(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Copy for a rejected code. `auth:signIn` (convex/auth.ts) throws a
 * ConvexError whose data carries one of these codes and Spanish copy; the
 * copy is used as is so the server stays the single source of wording.
 */
function verifyErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }
  if (error instanceof TypeError) {
    return NETWORK_MESSAGE;
  }
  return "No hemos podido comprobar el código. Inténtalo otra vez.";
}

function useCountdown(): [number, (seconds: number) => void] {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  return [secondsLeft, setSecondsLeft];
}

type Step = "email" | "code";

function TextLink({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline font-medium text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px] outline-none motion-safe:transition-[text-decoration-color] motion-safe:duration-[var(--duration-press)] hover:decoration-hs-navy focus-visible:decoration-hs-navy disabled:cursor-default disabled:text-hs-brown disabled:no-underline"
    >
      {children}
    </button>
  );
}

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [direction, setDirection] = useState<Direction>(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, startResendCooldown] = useCountdown();
  const [bodyRef, bodyHeight] = useMeasuredHeight();

  const normalizedEmail = email.trim().toLowerCase();

  function goTo(next: Step) {
    setDirection(next === "code" ? 1 : -1);
    setStep(next);
    setCode("");
    setError(null);
    setNotice(null);
  }

  async function requestCode(): Promise<boolean> {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      let response: Response;
      try {
        response = await fetch("/api/login/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });
      } catch {
        setError(SEND_ERROR_MESSAGE.NETWORK);
        return false;
      }
      const body: unknown = await response.json().catch(() => null);
      const failure =
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        typeof body.code === "string" &&
        body.code in SEND_ERROR_MESSAGE
          ? (body.code as LoginErrorCode)
          : null;
      if (response.ok && failure === null) {
        startResendCooldown(RESEND_COOLDOWN_S);
        return true;
      }
      setError(SEND_ERROR_MESSAGE[failure ?? "UNKNOWN"]);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (await requestCode()) {
      goTo("code");
    }
  }

  async function resendCode() {
    if (resendIn > 0 || pending) {
      return;
    }
    setCode("");
    if (await requestCode()) {
      setNotice("Código nuevo enviado. El anterior ya no vale.");
    }
  }

  async function verifyCode(value: string) {
    if (value.length !== CODE_LENGTH || pending) {
      return;
    }
    setError(null);
    setNotice(null);
    setPending(true);
    const failure = await attempt(() =>
      signIn("resend-otp", { code: value, email: normalizedEmail })
    );
    if (failure !== null) {
      setError(verifyErrorMessage(failure));
      setCode("");
    }
    setPending(false);
  }

  const transition = reducedMotion
    ? { duration: 0.16 }
    : { duration: 0.24, ease: EASE_OUT };

  return (
    <AuthScreen>
      <Card className="hs-enter w-full max-w-md overflow-hidden">
        <CardHeader>
          <p className="font-bungee text-xs text-hs-brown">HackSpain 2026</p>
          <CardTitle className="text-2xl sm:text-3xl">Entrar</CardTitle>
        </CardHeader>
        <motion.div
          animate={bodyHeight === null ? undefined : { height: bodyHeight }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { bounce: 0, duration: 0.4, type: "spring" }
          }
        >
          <div ref={bodyRef}>
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={direction}
            >
              <motion.div
                key={step}
                custom={direction}
                variants={reducedMotion ? reducedStepVariants : stepVariants}
                initial="initial"
                animate="active"
                exit="exit"
                transition={transition}
              >
                <CardContent className="space-y-4">
                  {step === "email" ? (
                    <p className="text-sm text-hs-brown">
                      Usa el email con el que te apuntaste. Te enviamos un
                      código.
                    </p>
                  ) : (
                    <div className="space-y-1 text-sm text-hs-brown">
                      <p>
                        Código enviado a{" "}
                        <span className="break-all text-hs-ink">
                          {normalizedEmail}
                        </span>
                        .
                      </p>
                      <p className="flex gap-4">
                        <TextLink onClick={() => goTo("email")}>
                          Cambiar email
                        </TextLink>
                        <TextLink
                          onClick={() => void resendCode()}
                          disabled={resendIn > 0 || pending}
                        >
                          {resendIn > 0 ? `Reenviar (${resendIn}s)` : "Reenviar"}
                        </TextLink>
                      </p>
                    </div>
                  )}
                  <FormError message={error} />
                  <FormNotice message={notice} />
                  {step === "email" ? (
                    <form
                      onSubmit={(event) => void sendCode(event)}
                      className="space-y-4"
                    >
                      <Field label="Email" htmlFor="email">
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          autoFocus
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </Field>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={pending}
                      >
                        {pending ? "Enviando…" : "Enviarme un código"}
                      </Button>
                    </form>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void verifyCode(code);
                      }}
                      className="space-y-4"
                    >
                      <Field label="Código" htmlFor="code">
                        <InputOTP
                          id="code"
                          maxLength={CODE_LENGTH}
                          pattern={REGEXP_ONLY_DIGITS}
                          autoFocus
                          autoComplete="one-time-code"
                          value={code}
                          disabled={pending}
                          onChange={(value) => {
                            setCode(value);
                            if (error) {
                              setError(null);
                            }
                          }}
                          onComplete={(value) => void verifyCode(value)}
                          containerClassName="w-full"
                        >
                          <InputOTPGroup className="flex-1">
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup className="flex-1">
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                            <InputOTPSlot index={6} />
                            <InputOTPSlot index={7} />
                          </InputOTPGroup>
                        </InputOTP>
                      </Field>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={pending || code.length !== CODE_LENGTH}
                      >
                        {pending ? "Comprobando…" : "Entrar"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </Card>
    </AuthScreen>
  );
}
