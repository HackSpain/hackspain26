"use client";

import { useMutation } from "convex/react";
import { ArrowRight, Github } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Feedback, useActionFeedback } from "@/components/action-feedback";
import { AvatarPicker } from "@/components/avatar-picker";
import { useGithubLink } from "@/components/github-link-banner";
import { Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Me } from "./steps";

/**
 * Name and photo, both required. The name is saved as soon as the field is
 * left, and before the GitHub round-trip, so leaving the page never loses
 * it. The GitHub avatar counts as the photo, so linking from here is the
 * quickest way through; the callback comes back to /onboarding and the
 * wizard re-plans from the saved state.
 */
export function IdentityStep({ me, onDone }: { me: Me; onDone: () => void }) {
  const setName = useMutation(api.users.setName);
  const github = useGithubLink("/onboarding");
  const action = useActionFeedback();
  const [nameDraft, setNameDraft] = useState<string | undefined>();
  const name = nameDraft ?? me.name ?? "";
  const trimmed = name.trim();
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
      <Field label="Nombre" htmlFor="onboarding-name" hint="Como quieres aparecer en el feed, el directorio y la acreditación.">
        <Input
          id="onboarding-name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          autoFocus={!me.name}
          value={name}
          disabled={action.pending}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            // Errors surface on Continue, which saves again.
            void saveName().catch(() => null);
          }}
        />
      </Field>

      <div className="space-y-3">
        <Label>Foto</Label>
        <AvatarPicker name={trimmed || me.name} avatarUrl={me.avatarUrl} action={action}>
          {hasPhoto ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={github.pending || action.pending}
              onClick={() => run(() => github.link())}
            >
              <Github aria-hidden />
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

      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={action.pending || !nameValid || !hasPhoto}
      >
        {action.pending ? "Guardando…" : "Continuar"}
        <ArrowRight aria-hidden />
      </Button>
    </form>
  );
}
