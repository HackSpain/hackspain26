"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowUpRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { api } from "@convex/_generated/api";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_PERK_INPUTS,
  type PerkInput,
  type PerkInputType,
  answerFor,
  downloadCsv,
  fileSlug,
  isHttpUrl,
  perkInputTypeLabels,
  slugKey,
  toCsv,
} from "@/lib/perks";
import { claimStatusLabel, perkName, perkTypeLabel } from "@/lib/utils";

type AdminPerk = FunctionReturnType<typeof api.perks.adminList>[number];
type PerkType = AdminPerk["type"];

type DraftInput = {
  id: string;
  label: string;
  key: string;
  keyTouched: boolean;
  type: PerkInputType;
  required: boolean;
  options: string;
};

type Draft = {
  company: string;
  title: string;
  value: string;
  description: string;
  type: PerkType;
  sponsorUrl: string;
  codes: string;
  inputs: DraftInput[];
};

const emptyDraft: Draft = {
  company: "",
  title: "",
  value: "",
  description: "",
  type: "email",
  sponsorUrl: "",
  codes: "",
  inputs: [],
};

function newDraftInput(): DraftInput {
  return {
    id: crypto.randomUUID(),
    label: "",
    key: "",
    keyTouched: false,
    type: "text",
    required: true,
    options: "",
  };
}

function draftFromPerk(perk: AdminPerk): Draft {
  return {
    company: perk.company,
    title: perk.title,
    value: perk.value,
    description: perk.description,
    type: perk.type,
    sponsorUrl: perk.sponsorUrl ?? "",
    codes: "",
    inputs: perk.inputs.map((input) => ({
      id: crypto.randomUUID(),
      label: input.label,
      key: input.key,
      keyTouched: true,
      type: input.type,
      required: input.required,
      options: (input.options ?? []).join(", "),
    })),
  };
}

function lines(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inputsFromDraft(inputs: DraftInput[]): PerkInput[] {
  return inputs.map((input) => ({
    key: input.key.trim() || slugKey(input.label),
    label: input.label.trim(),
    type: input.type,
    required: input.required,
    options:
      input.type === "select"
        ? input.options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined,
  }));
}

function draftProblem(draft: Draft): string | null {
  if (!draft.company.trim() || !draft.title.trim()) {
    return "La empresa y el título son obligatorios";
  }
  if (draft.sponsorUrl.trim() && !isHttpUrl(draft.sponsorUrl.trim())) {
    return "La URL del sponsor debe empezar por http:// o https://";
  }
  for (const input of draft.inputs) {
    if (!input.label.trim()) return "Cada campo necesita una etiqueta";
    if (input.type === "select" && !input.options.trim()) {
      return `El selector "${input.label.trim()}" necesita opciones`;
    }
  }
  return null;
}

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function AdminPerksPage() {
  const perks = useQuery(api.perks.adminList);
  const create = useMutation(api.perks.adminCreate);
  const update = useMutation(api.perks.adminUpdate);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [extraCodes, setExtraCodes] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<AdminPerk | null>(null);
  const [viewing, setViewing] = useState<AdminPerk | null>(null);

  async function submitCreate() {
    const problem = draftProblem(draft);
    if (problem) {
      setCreateError(problem);
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      await create({
        company: draft.company,
        title: draft.title,
        value: draft.value,
        description: draft.description,
        type: draft.type,
        sponsorUrl: draft.sponsorUrl.trim() || undefined,
        inputs: inputsFromDraft(draft.inputs),
        codes: draft.type === "code" ? lines(draft.codes) : undefined,
      });
      setDraft(emptyDraft);
    } catch (err: unknown) {
      setCreateError(errorMessage(err, "No se ha podido crear el perk"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page title="Admin de perks">
      <Card>
        <CardHeader>
          <CardTitle>Crear perk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormError message={createError} />
          <PerkFields draft={draft} onChange={setDraft} mode="create" />
          <Button
            className="w-full sm:w-auto"
            disabled={creating}
            onClick={() => void submitCreate()}
          >
            {creating ? "Creando…" : "Crear perk"}
          </Button>
        </CardContent>
      </Card>

      {perks === undefined ? (
        <LoadingText />
      ) : perks.length === 0 ? (
        <EmptyState title="Aún no hay perks">
          Crea el primero con el formulario de arriba.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {perks.map((perk) => (
            <Card key={perk._id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 [&_[data-slot=badge]]:whitespace-nowrap">
                  <span>{perkName(perk.company, perk.title)}</span>
                  <Badge>{perkTypeLabel(perk.type)}</Badge>
                  {perk.value ? <Badge variant="gold">{perk.value}</Badge> : null}
                  {perk.active ? null : <Badge className="bg-hs-paper">Inactivo</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {perk.description ? <p>{perk.description}</p> : null}
                <p className="text-hs-brown tabular-nums">
                  {perk.claimCount} {perk.claimCount === 1 ? "solicitud" : "solicitudes"}
                  {perk.type === "code"
                    ? ` · ${perk.availableCodes}/${perk.codeCount} códigos libres`
                    : ""}
                  {perk.inputs.length > 0
                    ? ` · ${perk.inputs.length} ${perk.inputs.length === 1 ? "campo" : "campos"}: ${perk.inputs.map((input) => input.label).join(", ")}`
                    : ""}
                  {perk.sponsorUrl ? (
                    <>
                      {" · "}
                      <a
                        href={perk.sponsorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
                      >
                        Web del sponsor
                        <ArrowUpRightIcon className="size-3.5" aria-hidden />
                      </a>
                    </>
                  ) : null}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="teal" onClick={() => setViewing(perk)}>
                    Solicitudes ({perk.claimCount})
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(perk)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void update({ perkId: perk._id, active: !perk.active })}
                  >
                    {perk.active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
                {perk.type === "code" ? (
                  <Field label="Añadir más códigos">
                    <Textarea
                      value={extraCodes[perk._id] ?? ""}
                      onChange={(event) =>
                        setExtraCodes((current) => ({
                          ...current,
                          [perk._id]: event.target.value,
                        }))
                      }
                      className="font-mono"
                    />
                    <Button
                      variant="teal"
                      className="mt-2 w-full sm:w-auto"
                      onClick={() =>
                        void update({
                          perkId: perk._id,
                          codesToAdd: lines(extraCodes[perk._id] ?? ""),
                        }).then(() =>
                          setExtraCodes((current) => ({
                            ...current,
                            [perk._id]: "",
                          })),
                        )
                      }
                    >
                      Añadir códigos
                    </Button>
                  </Field>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          {editing ? (
            <EditPerkForm
              key={editing._id}
              perk={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <SheetContent className="sm:max-w-4xl">
          {viewing ? <RequestsSheet key={viewing._id} perk={viewing} /> : null}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function EditPerkForm({ perk, onDone }: { perk: AdminPerk; onDone: () => void }) {
  const update = useMutation(api.perks.adminUpdate);
  const [draft, setDraft] = useState<Draft>(() => draftFromPerk(perk));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await update({
        perkId: perk._id,
        company: draft.company,
        title: draft.title,
        value: draft.value,
        description: draft.description,
        sponsorUrl: draft.sponsorUrl.trim(),
        inputs: inputsFromDraft(draft.inputs),
      });
      onDone();
    } catch (err: unknown) {
      setError(errorMessage(err, "No se ha podido guardar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <DialogHeader>
        <DialogTitle>Editar perk</DialogTitle>
        <DialogDescription>
          {perk.claimCount > 0
            ? "Cambiar los campos no borra respuestas ya enviadas; las columnas se emparejan por clave."
            : "Los participantes rellenan los campos al reclamar."}
        </DialogDescription>
      </DialogHeader>
      <FormError message={error} />
      <PerkFields draft={draft} onChange={setDraft} mode="edit" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PerkFields({
  draft,
  onChange,
  mode,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  mode: "create" | "edit";
}) {
  const ids = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Empresa / sponsor" htmlFor={`${ids}-company`}>
          <Input
            id={`${ids}-company`}
            value={draft.company}
            onChange={(event) => set("company", event.target.value)}
          />
        </Field>
        <Field label="Título" htmlFor={`${ids}-title`}>
          <Input
            id={`${ids}-title`}
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </Field>
        <Field label="Valor" htmlFor={`${ids}-value`}>
          <Input
            id={`${ids}-value`}
            value={draft.value}
            onChange={(event) => set("value", event.target.value)}
            placeholder="100 créditos de Cursor"
          />
        </Field>
        {mode === "create" ? (
          <Field label="Tipo" htmlFor={`${ids}-type`}>
            <Select value={draft.type} onValueChange={(next) => set("type", next as PerkType)}>
              <SelectTrigger id={`${ids}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Solicitud por email</SelectItem>
                <SelectItem value="code">Bolsa de códigos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Tipo">
            <p className="flex h-11 items-center text-sm text-hs-brown">
              {perkTypeLabel(draft.type)} · no se puede cambiar
            </p>
          </Field>
        )}
        <Field
          label="URL del sponsor"
          htmlFor={`${ids}-sponsor`}
          hint="Se enlaza desde la tarjeta del perk."
        >
          <Input
            id={`${ids}-sponsor`}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.sponsorUrl}
            onChange={(event) => set("sponsorUrl", event.target.value)}
          />
        </Field>
      </div>
      <Field label="Descripción" htmlFor={`${ids}-description`}>
        <Textarea
          id={`${ids}-description`}
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      {mode === "create" && draft.type === "code" ? (
        <Field label="Códigos (uno por línea)" htmlFor={`${ids}-codes`}>
          <Textarea
            id={`${ids}-codes`}
            value={draft.codes}
            onChange={(event) => set("codes", event.target.value)}
            className="font-mono"
          />
        </Field>
      ) : null}
      <InputsEditor inputs={draft.inputs} onChange={(inputs) => set("inputs", inputs)} />
    </>
  );
}

function InputsEditor({
  inputs,
  onChange,
}: {
  inputs: DraftInput[];
  onChange: (inputs: DraftInput[]) => void;
}) {
  const ids = useId();

  function patch(id: string, changes: Partial<DraftInput>) {
    onChange(
      inputs.map((input) => {
        if (input.id !== id) return input;
        const next = { ...input, ...changes };
        if (changes.label !== undefined && !next.keyTouched) {
          next.key = slugKey(changes.label);
        }
        return next;
      }),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Label>Datos que pide el sponsor</Label>
          <p className="mt-1 text-sm text-hs-brown">
            El participante los rellena al reclamar. Sin campos, reclama con un clic.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={inputs.length >= MAX_PERK_INPUTS}
          onClick={() => onChange([...inputs, newDraftInput()])}
        >
          <PlusIcon aria-hidden />
          Añadir campo
        </Button>
      </div>
      {inputs.length > 0 ? (
        <ol className="grid gap-2">
          {inputs.map((input, index) => {
            const base = `${ids}-${input.id}`;
            return (
              <li
                key={input.id}
                className="grid gap-2 border-[3px] border-hs-ink bg-hs-sand/50 p-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label htmlFor={`${base}-label`} className="text-xs">
                    Etiqueta
                  </Label>
                  <Input
                    id={`${base}-label`}
                    value={input.label}
                    placeholder={index === 0 ? "Usuario de GitHub" : undefined}
                    onChange={(event) => patch(input.id, { label: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${base}-key`} className="text-xs">
                    Clave
                  </Label>
                  <Input
                    id={`${base}-key`}
                    value={input.key}
                    className="font-mono text-sm"
                    onChange={(event) =>
                      patch(input.id, { key: slugKey(event.target.value), keyTouched: true })
                    }
                  />
                </div>
                <div className="flex items-end gap-3 sm:col-span-2">
                  <div className="min-w-0 flex-1 space-y-1 sm:max-w-56">
                    <Label htmlFor={`${base}-type`} className="text-xs">
                      Tipo
                    </Label>
                    <Select
                      value={input.type}
                      onValueChange={(next) => patch(input.id, { type: next as PerkInputType })}
                    >
                      <SelectTrigger id={`${base}-type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(perkInputTypeLabels) as PerkInputType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {perkInputTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex h-11 items-center gap-2 text-sm select-none">
                    <Checkbox
                      className="mt-0"
                      checked={input.required}
                      onCheckedChange={(checked) =>
                        patch(input.id, { required: checked === true })
                      }
                    />
                    Obligatorio
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="ml-auto"
                    aria-label={`Quitar campo ${input.label || index + 1}`}
                    onClick={() => onChange(inputs.filter((row) => row.id !== input.id))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
                {input.type === "select" ? (
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`${base}-options`} className="text-xs">
                      Opciones (separadas por coma)
                    </Label>
                    <Input
                      id={`${base}-options`}
                      value={input.options}
                      placeholder="S, M, L, XL"
                      onChange={(event) => patch(input.id, { options: event.target.value })}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function RequestsSheet({ perk }: { perk: AdminPerk }) {
  const rows = useQuery(api.perks.adminRequests, { perkId: perk._id });
  const name = perkName(perk.company, perk.title);
  const showCode = perk.type === "code";

  function exportCsv() {
    if (!rows) return;
    const header = [
      "Nombre",
      "Email",
      "Equipo",
      ...perk.inputs.map((input) => input.label),
      "Estado",
      ...(showCode ? ["Código"] : []),
      "Fecha",
    ];
    const body = rows.map((row) => [
      row.name ?? "",
      row.email ?? "",
      row.teamName ?? "",
      ...perk.inputs.map((input) => answerFor(row.answers, input.key)),
      claimStatusLabel(row.status),
      ...(showCode ? [row.code ?? ""] : []),
      new Date(row.createdAt).toISOString(),
    ]);
    downloadCsv(`perk-${fileSlug(name)}-solicitudes.csv`, toCsv(header, body));
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{name}</SheetTitle>
        <SheetDescription className="tabular-nums">
          {rows === undefined
            ? "Cargando solicitudes…"
            : `${rows.length} ${rows.length === 1 ? "solicitud" : "solicitudes"}`}
          {perk.inputs.length > 0
            ? ` · ${perk.inputs.length} ${perk.inputs.length === 1 ? "campo" : "campos"}`
            : ""}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col p-0">
        {rows === undefined ? (
          <div className="p-5">
            <LoadingText />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-hs-brown">Nadie ha pedido este perk todavía.</p>
        ) : (
          <Table
            className="border-separate border-spacing-0"
            containerClassName="min-h-0 flex-1 overflow-auto overscroll-contain border-0"
          >
            <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Equipo</TableHead>
                {perk.inputs.map((input) => (
                  <TableHead key={input.key}>{input.label}</TableHead>
                ))}
                <TableHead>Estado</TableHead>
                {showCode ? <TableHead>Código</TableHead> : null}
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row._id} className="[&_td]:border-b [&_td]:border-hs-ink/20">
                  <TableCell>{row.name ?? "—"}</TableCell>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>{row.teamName ?? "—"}</TableCell>
                  {perk.inputs.map((input) => (
                    <TableCell key={input.key} className="max-w-64 truncate whitespace-normal">
                      {answerFor(row.answers, input.key) || "—"}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Badge>{claimStatusLabel(row.status)}</Badge>
                  </TableCell>
                  {showCode ? (
                    <TableCell className="font-mono text-xs">{row.code ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className="tabular-nums text-hs-brown">
                    {dateFormat.format(new Date(row.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetBody>
      <SheetFooter>
        <Button variant="teal" disabled={!rows || rows.length === 0} onClick={exportCsv}>
          Exportar CSV
        </Button>
      </SheetFooter>
    </>
  );
}
