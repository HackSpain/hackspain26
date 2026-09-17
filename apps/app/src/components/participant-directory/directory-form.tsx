"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Save } from "lucide-react";
import { useState } from "react";
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
import { errorMessage, Field, FormError } from "@/components/page";
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
  bare = false,
  submitLabel,
}: {
  me: DirectoryMe;
  onSaved?: () => void;
  onCancel?: () => void;
  bare?: boolean;
  submitLabel?: string;
}) {
  const save = useMutation(api.directory.save);
  const card = me.card;
  const [role, setRole] = useState(canonical(ROLE_OPTIONS, card?.role) ?? "");
  const [city, setCity] = useState(
    card?.city ?? canonical(CITY_OPTIONS, me.suggestions.city) ?? me.suggestions.city ?? ""
  );
  const [university, setUniversity] = useState(card?.university ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [degree, setDegree] = useState(card?.degree ?? "");
  const [skills, setSkills] = useState(() =>
    knownTags(SKILL_OPTIONS, card?.skills.length ? card.skills : me.suggestions.skills)
  );
  const [interests, setInterests] = useState(() =>
    knownTags(INTEREST_OPTIONS, card?.interests ?? [])
  );
  const [bio, setBio] = useState(card?.bio ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gate = !me.complete;
  const missing = me.missing.map((field) => FIELD_LABELS[field]);
  const ready =
    role !== "" &&
    city.trim() !== "" &&
    (university.trim() !== "" || company.trim() !== "") &&
    skills.length > 0 &&
    interests.length > 0;

  const form = (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
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
            setError(errorMessage(caughtError, "No se pudo guardar la ficha")),
          )
          .finally(() => setPending(false));
      }}
    >
      <fieldset className="space-y-5" disabled={pending}>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceField
            id="dir-role"
            label="Rol"
            hint="Cómo te presentas."
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
            placeholder="Elige tu ciudad"
            otherLabel="Otra ciudad…"
            otherPlaceholder="Escribe tu ciudad"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceField
            id="dir-university"
            label="Universidad"
            hint="Esta o la empresa, al menos una."
            options={UNIVERSITY_OPTIONS}
            value={university}
            onChange={setUniversity}
            placeholder="Elige tu universidad"
            otherLabel="Otra universidad…"
            otherPlaceholder="Nombre de la universidad"
            noneLabel="Sin universidad"
          />
          <Field label="Empresa" htmlFor="dir-company" hint="Donde trabajas, si trabajas.">
            <Input
              id="dir-company"
              maxLength={80}
              placeholder="Nébula Labs"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </Field>
        </div>
        <ChoiceField
          id="dir-degree"
          label="Titulación (opcional)"
          options={DEGREE_OPTIONS}
          value={degree}
          onChange={setDegree}
          placeholder="Elige tu titulación"
          otherLabel="Otra titulación…"
          otherPlaceholder="Nombre de la titulación"
          noneLabel="Sin titulación"
        />
        <Field label="Habilidades" htmlFor="dir-skills" hint={`Elige hasta ${MAX_TAGS}. Por aquí te conectamos con quien construye con lo mismo.`}>
          <TagPicker
            id="dir-skills"
            groups={SKILL_GROUPS}
            value={skills}
            onChange={setSkills}
            max={MAX_TAGS}
            disabled={pending}
          />
        </Field>
        <Field label="Intereses" htmlFor="dir-interests" hint={`Elige hasta ${MAX_TAGS}.`}>
          <TagPicker
            id="dir-interests"
            groups={INTEREST_GROUPS}
            value={interests}
            onChange={setInterests}
            max={MAX_TAGS}
            disabled={pending}
          />
        </Field>
        <Field label="Bio (opcional)" htmlFor="dir-bio">
          <Textarea
            id="dir-bio"
            rows={2}
            maxLength={240}
            placeholder="Una frase sobre lo que construyes."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </Field>
      </fieldset>
      <FormError message={error} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={pending || !ready}>
          <Save aria-hidden /> {pending ? "Guardando…" : (submitLabel ?? "Guardar")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
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
