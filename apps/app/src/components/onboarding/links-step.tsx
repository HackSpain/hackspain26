"use client";

import { useMutation } from "convex/react";
import { ArrowRight, ArrowUpRight, CheckCircle2, Github } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Feedback, useActionFeedback } from "@/components/action-feedback";
import { useGithubLink } from "@/components/github-link-banner";
import { Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StepNav } from "./step-nav";
import type { Me } from "./steps";

const TWITTER_HANDLE = /^[a-z0-9_]{1,15}$/;

/** Empty is fine. Same rule as `users.setTwitterHandle`. */
function twitterHandleError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("@")) {
    return "Sin la @, solo el usuario.";
  }
  const handle = trimmed.split(/[/?#\s]/)[0]?.toLowerCase() ?? "";
  if (!TWITTER_HANDLE.test(handle)) {
    return "Solo letras, números y _ (máximo 15).";
  }
  return null;
}

/**
 * GitHub and X. Both optional: not everyone has the accounts, so the step
 * can be skipped and the profile page keeps both editable.
 */
export function LinksStep({
  me,
  onDone,
  onBack,
}: {
  me: Me;
  onDone: () => void;
  onBack?: () => void;
}) {
  const github = useGithubLink("/onboarding");
  const setTwitterHandle = useMutation(api.users.setTwitterHandle);
  const action = useActionFeedback();
  const [handleDraft, setHandleDraft] = useState<string | undefined>();
  const handle = handleDraft ?? me.twitterHandle ?? me.suggestedTwitterHandle ?? "";
  const handleError = twitterHandleError(handle);
  // First "Continuar" without GitHub only shakes the card and asks; the
  // second one goes through.
  const [nudged, setNudged] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const askGithub = nudged && !me.githubLinked;
  const continueLabel = askGithub ? "Continuar sin GitHub" : "Continuar";

  function next() {
    if (handleError) {
      return;
    }
    if (!me.githubLinked && !nudged) {
      setNudged(true);
      cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    void action.run(async () => {
      const value = handle.trim();
      if (value && value !== me.twitterHandle) {
        await setTwitterHandle({ handle: value });
      }
      onDone();
      return "";
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        next();
      }}
    >
      <div className="space-y-2">
        <div
          ref={cardRef}
          className={cn(
            "flex items-center gap-4 border-[3px] border-hs-ink bg-hs-paper p-3",
            askGithub && "hs-shake",
          )}
        >
          <span
            className="flex size-14 shrink-0 items-center justify-center border-[3px] border-hs-ink bg-hs-gold"
            aria-hidden
          >
            <Github className="size-7" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bungee text-sm tracking-wide">GitHub</p>
            <p className="text-sm text-hs-brown">
              {me.githubLinked && me.githubUsername
                ? `@${me.githubUsername}`
                : "Tus pushes salen en el feed."}
            </p>
          </div>
          {me.githubLinked ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-hs-navy">
              <CheckCircle2 className="size-4" aria-hidden />
              Vinculado
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={github.pending || action.pending}
              onClick={() => void github.link()}
            >
              {github.pending ? "Abriendo…" : "Vincular"}
              <ArrowUpRight aria-hidden />
            </Button>
          )}
        </div>
        {github.error ? <p className="text-sm text-hs-red">{github.error}</p> : null}
        {askGithub && !github.error ? (
          <p className="hs-enter text-sm font-medium text-hs-red" role="status">
            ¿Seguro que no quieres vincular GitHub? El análisis de tus commits
            ayudará a tu puntuación final.
          </p>
        ) : null}
      </div>

      <Field label="Usuario de X" htmlFor="onboarding-x">
        <Input
          id="onboarding-x"
          autoComplete="off"
          placeholder="hackspain"
          maxLength={80}
          spellCheck={false}
          value={handle}
          disabled={action.pending}
          aria-invalid={handleError ? true : undefined}
          aria-describedby={handleError ? "onboarding-x-error" : undefined}
          className={
            handleError
              ? "border-hs-red focus-visible:border-hs-red focus-visible:ring-hs-red/25"
              : undefined
          }
          onChange={(event) => setHandleDraft(event.target.value)}
        />
        {handleError ? (
          <p id="onboarding-x-error" className="text-sm text-hs-red">
            {handleError}
          </p>
        ) : null}
      </Field>

      <Feedback action={action} hideMessage />

      <StepNav onBack={onBack} disabled={action.pending}>
        <Button
          type="submit"
          variant={askGithub ? "outline" : "default"}
          disabled={action.pending || Boolean(handleError)}
        >
          {action.pending ? "Guardando…" : continueLabel}
          <ArrowRight aria-hidden />
        </Button>
      </StepNav>
    </form>
  );
}
