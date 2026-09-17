"use client";

import { useMutation } from "convex/react";
import { ArrowRight, Github, Lock } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Feedback, useActionFeedback } from "@/components/action-feedback";
import { AvatarPicker } from "@/components/avatar-picker";
import { useGithubLink } from "@/components/github-link-banner";
import { Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepNav } from "./step-nav";
import type { Me } from "./steps";

/**
 * Name and photo, both required. The name is saved as soon as the field is
 * left, and before the GitHub round-trip, so leaving the page never loses
 * it. The GitHub avatar counts as the photo, so linking from here is the
 * quickest way through; the callback comes back to /onboarding and the
 * wizard re-plans from the saved state.
 */
export function IdentityStep({
  me,
  onDone,
  onBack,
}: {
  me: Me;
  onDone: () => void;
  onBack?: () => void;
}) {
  const setName = useMutation(api.users.setName);
  const github = useGithubLink("/onboarding");
  const action = useActionFeedback();
  const [nameDraft, setNameDraft] = useState<string | undefined>();
  const [nameHelpOpen, setNameHelpOpen] = useState(false);
  const name = nameDraft ?? me.name ?? "";
  const trimmed = name.trim();
  const nameLocked = Boolean(me.name?.trim());
  const nameValid = trimmed.length >= 2 && trimmed.length <= 80;
  const hasPhoto = Boolean(me.avatarUrl);
  // `me.name` may be the signup's name, not yet on `users`; save it too.
  const nameDue = nameDraft !== undefined || me.profileMissing.includes("name");
  // The blur save runs outside `action` so the click that caused the blur
  // is not dropped as "already pending"; Continue awaits it instead.
  const inflight = useRef<Promise<void> | null>(null);

  function saveName(): Promise<void> {
    if (!nameValid || !nameDue) {
      return inflight.current ?? Promise.resolve();
    }
    const saving = setName({ name })
      .then(() => setNameDraft(undefined))
      .finally(() => {
        if (inflight.current === saving) {
          inflight.current = null;
        }
      });
    inflight.current = saving;
    return saving;
  }

  function run(then: () => void | Promise<void>) {
    void action.run(async () => {
      await saveName();
      await then();
      return "";
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        run(onDone);
      }}
    >
      <Field
        label="Nombre"
        htmlFor="onboarding-name"
        hint={
          nameLocked
            ? "El de tu inscripción. Pulsa el campo si hay que cambiarlo."
            : "Como quieres aparecer en el feed, el directorio y la acreditación."
        }
      >
        <div className="relative">
          {nameLocked ? (
            <Input
              id="onboarding-name"
              readOnly
              value={name}
              className="cursor-pointer bg-hs-sand/60 pr-10 focus-visible:border-hs-ink/25 focus-visible:ring-0"
              onClick={() => setNameHelpOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setNameHelpOpen(true);
                }
              }}
            />
          ) : (
            <Input
              id="onboarding-name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              autoFocus
              value={name}
              disabled={action.pending}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => {
                // Errors surface on Continue, which saves again.
                void saveName().catch(() => null);
              }}
            />
          )}
          {nameLocked ? (
            <Lock
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-hs-brown"
              aria-hidden
            />
          ) : null}
        </div>
      </Field>

      <Dialog open={nameHelpOpen} onOpenChange={setNameHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nombre de inscripción</DialogTitle>
            <DialogDescription>
              Este nombre es el de tu plaza. Si está mal, contacta a la organización.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setNameHelpOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <Label>Foto</Label>
        <AvatarPicker name={trimmed || me.name} avatarUrl={me.avatarUrl} action={action}>
          {hasPhoto ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8 px-3 text-xs"
              disabled={github.pending || action.pending}
              onClick={() => run(() => github.link())}
            >
              <Github className="size-3.5" aria-hidden />
              {github.pending ? "Abriendo GitHub…" : "Usar mi avatar de GitHub"}
            </Button>
          )}
        </AvatarPicker>
        {github.error ? <p className="text-sm text-hs-red">{github.error}</p> : null}
        {hasPhoto ? null : (
          <p className="text-sm text-hs-brown">
            Necesitamos una foto para que la gente te reconozca en el evento.
          </p>
        )}
      </div>

      <Feedback action={action} hideMessage />

      <StepNav onBack={onBack} disabled={action.pending}>
        <Button type="submit" disabled={action.pending || !nameValid || !hasPhoto}>
          {action.pending ? "Guardando…" : "Continuar"}
          <ArrowRight aria-hidden />
        </Button>
      </StepNav>
    </form>
  );
}
