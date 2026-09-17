"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { DirectoryField } from "@convex/lib/directory";
import {
  canonical,
  canonicalTags,
  CITY_OPTIONS,
  DEGREE_OPTIONS,
  INTEREST_OPTIONS,
  isOption,
  ROLE_OPTIONS,
  SKILL_GROUPS,
  SKILL_OPTIONS,
  UNIVERSITY_OPTIONS,
} from "@convex/lib/directoryOptions";
import { MAX_TAGS } from "@convex/lib/directory";
import { errorMessage, Field } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChoiceField } from "./choice-field";
import { TagPicker } from "./tag-picker";

type DirectoryMe = FunctionReturnType<typeof api.directory.me>;

const FIELD_LABELS: Record<DirectoryField, string> = {
  affiliation: "universidad o empresa",
  city: "ciudad",
  interests: "intereses",
  role: "rol",
  skills: "habilidades",
};

const INTEREST_GROUPS = [{ label: "Intereses", options: INTEREST_OPTIONS }];

/** "3/12" on a chip field's label row; turns ink when the cap is reached. */
function Counter({ count, max }: { count: number; max: number }) {
  return (
    <span className={count >= max ? "font-semibold text-hs-ink" : undefined}>
      {count}/{max}
    </span>
  );
}

/** Keep only tags the picker can show; old free text would be unselectable. */
function knownTags(options: typeof SKILL_OPTIONS, tags: readonly string[]): string[] {
  return canonicalTags(options, tags).filter((tag) => isOption(options, tag));
}

/**
 * The card every participant fills during onboarding and edits on /profile.
 * Everything the graph groups by is a dropdown or a chip from the curated
 * vocabularies (convex/lib/directoryOptions.ts), so "UPM" and "Politécnica
 * de Madrid" end up as one node. The copy explains what is missing while
 * required fields are empty. With `bare` only the form renders, for a host
 * that brings its own card.
 */
export function DirectoryForm({
  me,
  onSaved,
  onCancel,
  onBack,
  onNext,
  bare = false,
  page,
  submitLabel,
}: {
  me: DirectoryMe;
  onSaved?: () => void;
  onCancel?: () => void;
  /** Wizard host: "Atrás" returns to the previous step. */
  onBack?: () => void;
  /** Wizard host: "Siguiente" on the first page; the draft stays mounted. */
  onNext?: () => void;
  bare?: boolean;
  /**
   * Wizard host: show one half only (0 about you, 1 skills and interests),
   * each its own step. Undefined renders the whole form.
   */
  page?: 0 | 1;
  submitLabel?: string;
}) {
  const save = useMutation(api.directory.save);
  const card = me.card;
  const [role, setRole] = useState(canonical(ROLE_OPTIONS, card?.role) ?? "");
  const [city, setCity] = useState(
    card?.city ??
      canonical(CITY_OPTIONS, me.suggestions.city) ??
      me.suggestions.city ??
      "",
  );
  const [university, setUniversity] = useState(card?.university ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [degree, setDegree] = useState(card?.degree ?? "");
  const [skills, setSkills] = useState(() =>
    knownTags(SKILL_OPTIONS, card?.skills.length ? card.skills : me.suggestions.skills),
  );
  const [interests, setInterests] = useState(() =>
    knownTags(INTEREST_OPTIONS, card?.interests ?? []),
  );
  const [bio, setBio] = useState(card?.bio ?? "");
  const [pending, setPending] = useState(false);

  // Onboarding shows the two halves one at a time; /profile shows both.
  const paged = page !== undefined;
  const showAbout = !paged || page === 0;
  const showTags = !paged || page === 1;

  const gate = !me.complete;
  const missing = me.missing.map((field) => FIELD_LABELS[field]);
  const missingAbout = [
    role === "" ? "rol" : null,
    city.trim() === "" ? "ciudad" : null,
    university.trim() === "" && company.trim() === "" ? "universidad o empresa" : null,
  ].filter((item): item is string => item !== null);
  const missingTags = [
    skills.length === 0 ? "habilidades" : null,
    interests.length === 0 ? "intereses" : null,
  ].filter((item): item is string => item !== null);
  const stillMissing =
    showAbout && !showTags ? missingAbout : [...missingAbout, ...missingTags];
  const ready = stillMissing.length === 0;

  const form = (
    <form
      className="@container space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (paged && page === 0) {
          onNext?.();
          return;
        }
        setPending(true);
        void save({
          bio: bio || undefined,
          city,
          company: company || undefined,
          degree: degree || undefined,
          interests,
          role,
          skills,
          university: university || undefined,
        })
          .then(() => onSaved?.())
          .catch((caughtError: unknown) =>
            toast.error(errorMessage(caughtError, "No se pudo guardar la ficha")),
          )
          .finally(() => setPending(false));
      }}
    >
      <fieldset className="space-y-6" disabled={pending}>
        {showAbout ? (
          <div key="about" className={cn("space-y-4", paged && "hs-enter")}>
            <div className="grid gap-4 @sm:grid-cols-2">
              <ChoiceField
                id="dir-role"
                label="Rol"
                options={ROLE_OPTIONS}
                value={role}
                onChange={setRole}
                placeholder="Elige un rol"
                allowOther={false}
              />
              <ChoiceField
                id="dir-city"
                label="Ciudad"
                options={CITY_OPTIONS}
                value={city}
                onChange={setCity}
                placeholder="Escribe o elige tu ciudad"
              />
            </div>
            <div className="grid gap-4 @sm:grid-cols-2">
              <ChoiceField
                id="dir-university"
                label="Universidad"
                options={UNIVERSITY_OPTIONS}
                value={university}
                onChange={setUniversity}
                placeholder="Escribe o elige"
              />
              <Field label="Empresa" htmlFor="dir-company" meta="Al menos una de las dos">
                <Input
                  id="dir-company"
                  maxLength={80}
                  placeholder="Donde trabajas, si trabajas"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </Field>
            </div>
            <ChoiceField
              id="dir-degree"
              label="Titulación"
              meta="Opcional"
              options={DEGREE_OPTIONS}
              value={degree}
              onChange={setDegree}
              placeholder="Escribe o elige tu titulación"
            />
          </div>
        ) : null}

        {!paged ? <hr className="border-t-2 border-hs-ink/10" /> : null}

        {showTags ? (
          <div key="tags" className={cn("space-y-6", paged && "hs-enter")}>
            <Field
              label="Habilidades"
              htmlFor="dir-skills"
              hint="Te conectamos con quien construye con lo mismo."
              meta={<Counter count={skills.length} max={MAX_TAGS} />}
            >
              <TagPicker
                id="dir-skills"
                groups={SKILL_GROUPS}
                value={skills}
                onChange={setSkills}
                max={MAX_TAGS}
                disabled={pending}
                searchPlaceholder="Buscar habilidad…"
              />
            </Field>
            <Field
              label="Intereses"
              htmlFor="dir-interests"
              meta={<Counter count={interests.length} max={MAX_TAGS} />}
            >
              <TagPicker
                id="dir-interests"
                groups={INTEREST_GROUPS}
                value={interests}
                onChange={setInterests}
                max={MAX_TAGS}
                disabled={pending}
                searchPlaceholder="Buscar interés…"
              />
            </Field>

            <hr className="border-t-2 border-hs-ink/10" />

            <Field
              label="Bio"
              htmlFor="dir-bio"
              meta={bio.length > 0 ? `${bio.length}/240` : "Opcional"}
            >
              <Textarea
                id="dir-bio"
                rows={2}
                maxLength={240}
                placeholder="Una frase sobre lo que construyes."
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </fieldset>
      <div className="space-y-3">
        {ready ? null : (
          <p className="text-xs text-hs-brown" aria-live="polite">
            Te falta: {stillMissing.join(", ")}.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
              <ArrowLeft aria-hidden />
              Atrás
            </Button>
          ) : null}
          {!onBack && onCancel ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
          {onBack || onCancel ? null : <span aria-hidden />}
          {paged && page === 0 ? (
            <Button type="submit" disabled={!ready}>
              Siguiente
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={pending || !ready}>
              {submitLabel ? null : <Save aria-hidden />}
              {pending ? "Guardando…" : (submitLabel ?? "Guardar")}
              {submitLabel ? <ArrowRight aria-hidden /> : null}
            </Button>
          )}
        </div>
      </div>
    </form>
  );

  if (bare) {
    return form;
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{gate ? "Tu ficha para el grafo" : "Editar mi ficha"}</CardTitle>
        <CardDescription>
          {gate
            ? `El grafo conecta a la gente por ciudad, universidad o empresa, habilidades e intereses. Nos falta ${
                missing.length > 1
                  ? `${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`
                  : missing[0]
              }.`
            : "Lo que los demás ven de ti en el grafo y por dónde te conectamos."}
        </CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
