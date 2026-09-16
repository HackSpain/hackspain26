"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Save } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { parseTags } from "@convex/lib/directory";
import type { DirectoryField } from "@convex/lib/directory";
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

type DirectoryMe = FunctionReturnType<typeof api.directory.me>;

const FIELD_LABELS: Record<DirectoryField, string> = {
  affiliation: "universidad o empresa",
  city: "ciudad",
  interests: "intereses",
  role: "rol",
  skills: "habilidades",
};

/**
 * The card every participant fills before seeing the graph. Shown as a gate
 * when something required is missing, and again from "Editar mi ficha".
 */
export function DirectoryForm({
  me,
  onSaved,
  onCancel,
}: {
  me: DirectoryMe;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const save = useMutation(api.directory.save);
  const card = me.card;
  const [role, setRole] = useState(card?.role ?? "");
  const [city, setCity] = useState(card?.city ?? me.suggestions.city ?? "");
  const [university, setUniversity] = useState(card?.university ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [degree, setDegree] = useState(card?.degree ?? "");
  const [skills, setSkills] = useState(
    (card?.skills.length ? card.skills : me.suggestions.skills).join(", "),
  );
  const [interests, setInterests] = useState(card?.interests.join(", ") ?? "");
  const [bio, setBio] = useState(card?.bio ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gate = !me.complete;
  const missing = me.missing.map((field) => FIELD_LABELS[field]);

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{gate ? "Tu ficha para el grafo" : "Editar mi ficha"}</CardTitle>
        <CardDescription>
          {gate
            ? `El grafo conecta a la gente por ciudad, universidad o empresa, habilidades e intereses. Para verlo necesitamos ${
                missing.length > 1
                  ? `${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`
                  : missing[0]
              }.`
            : "Lo que los demás ven de ti en el grafo y por dónde te conectamos."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            void save({
              bio: bio || undefined,
              city,
              company: company || undefined,
              degree: degree || undefined,
              interests: parseTags(interests),
              role,
              skills: parseTags(skills),
              university: university || undefined,
            })
              .then(() => onSaved?.())
              .catch((caughtError: unknown) =>
                setError(errorMessage(caughtError, "No se pudo guardar la ficha")),
              )
              .finally(() => setPending(false));
          }}
        >
          <fieldset className="space-y-4" disabled={pending}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Rol" htmlFor="dir-role" hint="Cómo te presentas: Backend, Diseño, Data…">
                <Input
                  id="dir-role"
                  required
                  maxLength={80}
                  placeholder="AI Engineer"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </Field>
              <Field label="Ciudad" htmlFor="dir-city">
                <Input
                  id="dir-city"
                  required
                  maxLength={80}
                  autoComplete="address-level2"
                  placeholder="Madrid"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Universidad" htmlFor="dir-university" hint="Esta o la empresa, al menos una.">
                <Input
                  id="dir-university"
                  maxLength={80}
                  placeholder="Universidad Politécnica de Madrid"
                  value={university}
                  onChange={(event) => setUniversity(event.target.value)}
                />
              </Field>
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
            <Field label="Titulación (opcional)" htmlFor="dir-degree">
              <Input
                id="dir-degree"
                maxLength={80}
                placeholder="Ingeniería Informática"
                value={degree}
                onChange={(event) => setDegree(event.target.value)}
              />
            </Field>
            <Field label="Habilidades" htmlFor="dir-skills" hint="Separadas por comas, hasta 12.">
              <Input
                id="dir-skills"
                required
                placeholder="Python, LLM, React"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
              />
            </Field>
            <Field label="Intereses" htmlFor="dir-interests" hint="Separados por comas, hasta 12.">
              <Input
                id="dir-interests"
                required
                placeholder="Agentes IA, Open source, Educación"
                value={interests}
                onChange={(event) => setInterests(event.target.value)}
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
            <Button type="submit" disabled={pending}>
              <Save aria-hidden /> {pending ? "Guardando…" : gate ? "Guardar y ver el grafo" : "Guardar"}
            </Button>
            {onCancel ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
