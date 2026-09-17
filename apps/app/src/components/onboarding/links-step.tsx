"use client";

import { useMutation } from "convex/react";
import { ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Feedback, useActionFeedback } from "@/components/action-feedback";
import { useGithubLink } from "@/components/github-link-banner";
import { Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Me } from "./steps";

/**
 * GitHub and X. Both optional: not everyone has the accounts, so the step
 * can be skipped and the profile page keeps both editable.
 */
export function LinksStep({ me, onDone }: { me: Me; onDone: () => void }) {
  const github = useGithubLink("/onboarding");
  const setTwitterHandle = useMutation(api.users.setTwitterHandle);
  const action = useActionFeedback();
  const [handleDraft, setHandleDraft] = useState<string | undefined>();
  const handle =
    handleDraft ?? me.twitterHandle ?? me.suggestedTwitterHandle ?? "";

  function next() {
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
      <div className="space-y-3">
        <div className="flex min-w-0 items-center justify-between gap-3 border-[3px] border-hs-ink/15 bg-hs-sand/40 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">GitHub</p>
            <p className="min-w-0 break-all text-sm text-hs-brown">
              {me.githubLinked && me.githubUsername
                ? `@${me.githubUsername}`
                : "Tus pushes aparecen en el feed y tu equipo te encuentra."}
            </p>
          </div>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-2 py-1 text-xs font-semibold",
              me.githubLinked
                ? "bg-hs-teal/15 text-hs-navy"
                : "bg-hs-sand text-hs-brown"
            )}
          >
            {me.githubLinked ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : null}
            {me.githubLinked ? "Vinculada" : "Sin vincular"}
          </span>
        </div>
        {me.githubLinked ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={github.pending || action.pending}
            onClick={() => void github.link()}
          >
            {github.pending ? "Abriendo GitHub…" : "Vincular GitHub"}
            <ArrowUpRight aria-hidden />
          </Button>
        )}
        {github.error ? <p className="text-sm text-hs-red">{github.error}</p> : null}
      </div>

      <Field label="Usuario de X" htmlFor="onboarding-x" hint="Sin la @. Déjalo vacío si no tienes cuenta.">
        <Input
          id="onboarding-x"
          autoComplete="off"
          placeholder="hackspain"
          maxLength={80}
          value={handle}
          disabled={action.pending}
          onChange={(event) => setHandleDraft(event.target.value)}
        />
      </Field>

      <Feedback action={action} hideMessage />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={action.pending}>
          {action.pending ? "Guardando…" : "Continuar"}
          <ArrowRight aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={action.pending}
          onClick={onDone}
        >
          Saltar por ahora
        </Button>
      </div>
    </form>
  );
}
