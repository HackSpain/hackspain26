"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthScreen, Field, FormError, FormNotice } from "@/components/page";
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
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SLIDE_PX = 24;

type Step = "email" | "code";
type Direction = 1 | -1;

const stepVariants = {
  active: { opacity: 1, x: 0 },
  exit: (direction: Direction) => ({ x: -direction * SLIDE_PX, opacity: 0 }),
  initial: (direction: Direction) => ({ x: direction * SLIDE_PX, opacity: 0 }),
};

const reducedStepVariants = {
  active: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
};

function useMeasuredHeight(): [
  (node: HTMLElement | null) => void,
  number | null,
] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, height];
}

function TextLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline font-medium text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px] outline-none motion-safe:transition-[text-decoration-color] motion-safe:duration-[var(--duration-press)] hover:decoration-hs-navy focus-visible:decoration-hs-navy"
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
      const check = await fetch("/api/login-check", { method: "POST" });
      if (!check.ok) {
        throw new Error("login-check failed");
      }
      await signIn("resend-otp", { email: normalizedEmail });
      return true;
    } catch {
      setError("No hemos podido enviar el código. Inténtalo otra vez.");
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
    setCode("");
    if (await requestCode()) {
      setNotice("Código nuevo enviado.");
    }
  }

  async function verifyCode(value: string) {
    if (value.length !== CODE_LENGTH || pending) {
      return;
    }
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await signIn("resend-otp", { code: value, email: normalizedEmail });
    } catch {
      setError("Ese código no es válido.");
      setCode("");
    } finally {
      setPending(false);
    }
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
                        <TextLink onClick={() => void resendCode()}>
                          Reenviar
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
