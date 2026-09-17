"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { GithubLinkResult } from "@/components/github-link-banner";
import { DetailsStep } from "@/components/onboarding/details-step";
import { DirectoryStep } from "@/components/onboarding/directory-step";
import { IdentityStep } from "@/components/onboarding/identity-step";
import { LinksStep } from "@/components/onboarding/links-step";
import { planSteps, STEP_COPY } from "@/components/onboarding/steps";
import type { StepId } from "@/components/onboarding/steps";
import { AuthScreen, LoadingText } from "@/components/page";
import {
  EASE_OUT,
  reducedStepVariants,
  stepVariants,
  useMeasuredHeight,
} from "@/components/step-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Everything an account must fill before the dashboard opens, as one wizard.
 * `AuthGate` sends people here while `users.me` reports a missing phone
 * or terms (accepted signups) or a missing profile field (everyone). The list of
 * steps is planned once from that state, so saving a step does not reshuffle
 * the ones after it; a GitHub round-trip reloads the page and re-plans.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const me = useQuery(api.users.me);
  const [steps, setSteps] = useState<StepId[] | null>(null);
  const [index, setIndex] = useState(0);
  const [bodyRef, bodyHeight] = useMeasuredHeight();

  if (me && steps === null) {
    setSteps(planSteps(me));
  }

  const done = steps !== null && index >= steps.length;
  useEffect(() => {
    if (done) {
      router.replace("/");
    }
  }, [done, router]);

  const step = steps?.[index];
  if (!me || !steps || !step) {
    return (
      <AuthScreen>
        <LoadingText />
      </AuthScreen>
    );
  }

  const copy = STEP_COPY[step];
  const advance = () => setIndex((n) => n + 1);
  const transition = reducedMotion
    ? { duration: 0.16 }
    : { duration: 0.24, ease: EASE_OUT };

  return (
    <AuthScreen>
      <div className="w-full max-w-lg">
        <Suspense fallback={null}>
          <GithubLinkResult />
        </Suspense>
        <Card className="hs-enter w-full overflow-hidden">
          <CardHeader>
            <p className="font-bungee text-xs text-hs-brown">
              Paso {index + 1} de {steps.length}
            </p>
            <CardTitle className="text-2xl sm:text-3xl">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
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
              <AnimatePresence mode="popLayout" initial={false} custom={1}>
                <motion.div
                  key={step}
                  custom={1}
                  variants={reducedMotion ? reducedStepVariants : stepVariants}
                  initial="initial"
                  animate="active"
                  exit="exit"
                  transition={transition}
                >
                  <CardContent>
                    {step === "details" ? (
                      <DetailsStep onDone={advance} />
                    ) : step === "identity" ? (
                      <IdentityStep me={me} onDone={advance} />
                    ) : step === "links" ? (
                      <LinksStep me={me} onDone={advance} />
                    ) : (
                      <DirectoryStep onDone={advance} />
                    )}
                  </CardContent>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </Card>
      </div>
    </AuthScreen>
  );
}
