"use client";

import { ConvexError } from "convex/values";
import { useId, useState } from "react";
import type { PerkCardPerk } from "@/components/perk-card";
import { FormError, errorMessage } from "@/components/page";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PerkAnswer, type PerkInput, validateAnswers } from "@/lib/perks";
import { perkName } from "@/lib/utils";

export function claimErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data: unknown = err.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }
  return errorMessage(err, fallback);
}

export function PerkClaimDialog({
  perk,
  onOpenChange,
  onSubmit,
}: {
  perk: PerkCardPerk | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (answers: PerkAnswer[]) => Promise<void>;
}) {
  return (
    <Dialog open={perk !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {perk ? (
          <ClaimForm
            key={perk._id}
            perk={perk}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ClaimForm({
  perk,
  onCancel,
  onSubmit,
}: {
  perk: PerkCardPerk;
  onCancel: () => void;
  onSubmit: (answers: PerkAnswer[]) => Promise<void>;
}) {
  const ids = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isCode = perk.type === "code";

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  async function submit() {
    const answers: PerkAnswer[] = perk.inputs.map((input) => ({
      key: input.key,
      value: values[input.key] ?? "",
    }));
    const errors: Record<string, string> = {};
    for (const input of perk.inputs) {
      const result = validateAnswers([input], answers);
      if (!result.ok) errors[input.key] = result.fieldMessage;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(answers.filter((answer) => answer.value.trim().length > 0));
    } catch (err: unknown) {
      setServerError(claimErrorMessage(err, "No se ha podido reclamar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
    >
      <DialogHeader>
        <DialogTitle>{perkName(perk.company, perk.title)}</DialogTitle>
        <DialogDescription>
          {isCode
            ? "El sponsor necesita estos datos para activar tu código."
            : "El sponsor necesita estos datos para atender tu solicitud."}
        </DialogDescription>
      </DialogHeader>
      <FormError message={serverError} />
      <div className="grid gap-3">
        {perk.inputs.map((input) => (
          <InputField
            key={input.key}
            id={`${ids}-${input.key}`}
            input={input}
            value={values[input.key] ?? ""}
            error={fieldErrors[input.key]}
            onChange={(value) => setValue(input.key, value)}
          />
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando…" : isCode ? "Reclamar" : "Solicitar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InputField({
  id,
  input,
  value,
  error,
  onChange,
}: {
  id: string;
  input: PerkInput;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {input.label}
        {input.required ? null : (
          <span className="font-sans text-xs font-normal tracking-normal text-hs-brown">
            opcional
          </span>
        )}
      </Label>
      {input.type === "select" ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={error ? "border-hs-red" : undefined}
          >
            <SelectValue placeholder="Elige una opción" />
          </SelectTrigger>
          <SelectContent>
            {(input.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={input.type === "text" ? "text" : input.type}
          inputMode={input.type === "email" ? "email" : input.type === "url" ? "url" : undefined}
          autoComplete={input.type === "email" ? "email" : "off"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={error ? "border-hs-red" : undefined}
          placeholder={
            input.type === "url" ? "https://" : input.type === "email" ? "tu@email.com" : undefined
          }
        />
      )}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-hs-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
