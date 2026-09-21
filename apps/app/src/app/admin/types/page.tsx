"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { SectionKey } from "@convex/lib/userTypes";
import {
  EmptyState,
  Field,
  FormError,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SECTION_NAV, SECTION_ORDER } from "@/lib/sections";

type UserType = FunctionReturnType<typeof api.userTypes.list>[number];

function userCount(count: number) {
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

function useAdminAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(work: () => Promise<unknown>) {
    if (pending) {return false;}
    setPending(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (caughtError: unknown) {
      setError(errorMessage(caughtError, "No se pudo guardar el tipo."));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { error, pending, run };
}

function SectionPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: readonly SectionKey[];
  onChange: (next: SectionKey[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="font-bungee text-xs uppercase">Secciones visibles</legend>
      <p className="text-xs text-hs-brown">
        El feed y el perfil se ven siempre. Marca las secciones (iconos del inicio) que este tipo puede abrir.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTION_ORDER.map((key) => {
          const checked = value.includes(key);
          const inputId = `${id}-${key}`;
          return (
            <label
              key={key}
              htmlFor={inputId}
              className="flex cursor-pointer items-start gap-3 border border-hs-ink/15 bg-hs-sand/30 p-3 text-sm"
            >
              <Checkbox
                id={inputId}
                checked={checked}
                onCheckedChange={(state) =>
                  onChange(
                    state === true
                      ? SECTION_ORDER.filter((k) => k === key || value.includes(k))
                      : value.filter((k) => k !== key),
                  )
                }
              />
              <span className="space-y-0.5">
                <span className="block font-semibold">{SECTION_NAV[key].label}</span>
                <span className="block text-xs text-hs-brown">
                  {SECTION_NAV[key].hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const NEW_DEFAULT_SECTIONS: SectionKey[] = [
  "teams",
  "tracks",
  "perks",
  "cli",
];

function NewTypeCard() {
  const create = useMutation(api.userTypes.create);
  const action = useAdminAction();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionKey[]>(NEW_DEFAULT_SECTIONS);
  const [isDefault, setIsDefault] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4" aria-hidden /> Nuevo tipo
        </CardTitle>
        <CardDescription>
          Hacker, mentor, jurado, sponsor… Cada tipo decide qué pestañas ve.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action
              .run(() => create({ description, isDefault, label, sections }))
              .then((ok) => {
                if (!ok) {return;}
                setLabel("");
                setDescription("");
                setSections(NEW_DEFAULT_SECTIONS);
                setIsDefault(false);
              });
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" htmlFor="new-type-label">
              <Input
                id="new-type-label"
                required
                minLength={2}
                maxLength={40}
                placeholder="Mentor"
                value={label}
                disabled={action.pending}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field label="Descripción (opcional)" htmlFor="new-type-description">
              <Input
                id="new-type-description"
                maxLength={200}
                placeholder="Acompaña a los equipos durante el evento"
                value={description}
                disabled={action.pending}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
          <SectionPicker
            id="new-type"
            value={sections}
            onChange={setSections}
            disabled={action.pending}
          />
          <label htmlFor="new-type-default" className="flex items-start gap-3 text-sm">
            <Checkbox
              id="new-type-default"
              checked={isDefault}
              disabled={action.pending}
              onCheckedChange={(state) => setIsDefault(state === true)}
            />
            <span>
              <span className="block font-semibold">Tipo por defecto</span>
              <span className="block text-xs text-hs-brown">
                Se aplica a quien no tenga un tipo asignado en el CRM.
              </span>
            </span>
          </label>
          <FormError message={action.error} />
          <Button type="submit" disabled={action.pending || label.trim().length < 2}>
            {action.pending ? "Creando…" : "Crear tipo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TypeCard({
  type,
  index,
  count,
}: {
  type: UserType;
  index: number;
  count: number;
}) {
  const update = useMutation(api.userTypes.update);
  const move = useMutation(api.userTypes.move);
  const remove = useMutation(api.userTypes.remove);
  const action = useAdminAction();
  const [label, setLabel] = useState(type.label);
  const [description, setDescription] = useState(type.description ?? "");
  const [sections, setSections] = useState<SectionKey[]>([...type.sections]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    label.trim() !== type.label ||
    description.trim() !== (type.description ?? "") ||
    sections.join(",") !== type.sections.join(",");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {type.label}
          {type.isDefault ? <Badge variant="gold">Por defecto</Badge> : null}
          <Badge className="tabular-nums">{userCount(type.userCount)}</Badge>
          {type.sections.includes("judging") ? <Badge>Juzga</Badge> : null}
          {type.sections.includes("judgingSponsors") ? (
            <Badge>Entregas</Badge>
          ) : null}
        </CardTitle>
        {type.description ? (
          <CardDescription>{type.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(() =>
              update({ description, label, sections, typeId: type._id }),
            );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" htmlFor={`type-${type._id}-label`}>
              <Input
                id={`type-${type._id}-label`}
                required
                minLength={2}
                maxLength={40}
                value={label}
                disabled={action.pending}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field label="Descripción" htmlFor={`type-${type._id}-description`}>
              <Input
                id={`type-${type._id}-description`}
                maxLength={200}
                value={description}
                disabled={action.pending}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
          <SectionPicker
            id={`type-${type._id}`}
            value={sections}
            onChange={setSections}
            disabled={action.pending}
          />
          <FormError message={action.error} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="submit" disabled={!dirty || action.pending}>
              <Save aria-hidden /> {action.pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={action.pending || type.isDefault}
              onClick={() =>
                void action.run(() => update({ isDefault: true, typeId: type._id }))
              }
            >
              Hacer por defecto
            </Button>
            {type.isDefault ? (
              <Button
                type="button"
                variant="outline"
                disabled={action.pending}
                onClick={() =>
                  void action.run(() =>
                    update({ isDefault: false, typeId: type._id }),
                  )
                }
              >
                Quitar por defecto
              </Button>
            ) : null}
            <span className="flex gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Subir"
                disabled={action.pending || index === 0}
                onClick={() =>
                  void action.run(() => move({ direction: "up", typeId: type._id }))
                }
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Bajar"
                disabled={action.pending || index === count - 1}
                onClick={() =>
                  void action.run(() =>
                    move({ direction: "down", typeId: type._id }),
                  )
                }
              >
                <ArrowDown />
              </Button>
            </span>
          </div>
        </form>
        <div className="flex flex-col gap-2 border-t border-hs-ink/15 pt-4 sm:flex-row sm:items-center">
          {confirmDelete ? (
            <>
              <p className="text-sm text-hs-brown">
                {type.userCount > 0
                  ? `${userCount(type.userCount)} volverán al tipo por defecto.`
                  : "Nadie tiene este tipo."}{" "}
                ¿Borrar?
              </p>
              <Button
                type="button"
                variant="outline"
                className="text-hs-red"
                disabled={action.pending}
                onClick={() => void action.run(() => remove({ typeId: type._id }))}
              >
                <Trash2 aria-hidden /> Sí, borrar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={action.pending}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <button
              type="button"
              className="min-h-11 text-left text-sm text-hs-brown underline decoration-hs-brown/40 underline-offset-4 disabled:opacity-50"
              disabled={action.pending}
              onClick={() => setConfirmDelete(true)}
            >
              Borrar este tipo
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTypesPage() {
  const types = useQuery(api.userTypes.list);
  const ensureDefaults = useMutation(api.userTypes.ensureDefaults);

  useEffect(() => {
    void ensureDefaults({});
  }, [ensureDefaults]);

  return (
    <Page
      title="Tipos de usuario"
      description="Define quién es quién (hacker, mentor, jurado, sponsor…) y qué pestañas ve cada tipo. Se asignan desde la ficha de cada participante en el CRM. Los admins lo ven todo; quien no tenga tipo usa el tipo por defecto."
    >
      <NewTypeCard />
      {types === undefined ? (
        <LoadingText />
      ) : types.length === 0 ? (
        <EmptyState title="Aún no hay tipos">
          Creando los tipos por defecto…
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {types.map((type, index) => (
            <TypeCard
              key={type._id}
              type={type}
              index={index}
              count={types.length}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
