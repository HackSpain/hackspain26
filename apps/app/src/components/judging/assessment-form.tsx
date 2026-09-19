"use client";

import { useState } from "react";
import {
  ALLOWED_SCORES,
  completeScores,
  CRITERIA,
  CRITERION_LABELS,
  MAX_COMMENT_LENGTH,
  rawScore,
  SCORE_LABELS,
} from "@convex/lib/judging";
import type { Criterion, PartialScores, ScoreValue } from "@convex/lib/judging";
import { FormError, FormNotice } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AssessmentDraft = {
  scores: PartialScores;
  ownCriteriaComment: string;
};

export type AssessmentSnapshot = AssessmentDraft & {
  status: "draft" | "submitted";
};

const CRITERION_HINTS: Record<Criterion, string> = {
  craftsmanship: "Calidad del código, la ejecución y el acabado.",
  problemSolving: "Cómo de bien resuelve el problema que plantea.",
  creativity: "Originalidad del enfoque y de la solución.",
  ownCriteria: "Lo que tú consideres relevante. Explícalo en el comentario.",
};

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toFixed(2);
}

export function ScoreLegend() {
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm font-medium sm:grid-cols-2">
      {ALLOWED_SCORES.map((value) => (
        <div key={value} className="flex items-baseline gap-2">
          <dt className="font-bungee text-sm tabular-nums">{value}</dt>
          <dd className="text-hs-brown">{SCORE_LABELS[value]}</dd>
        </div>
      ))}
    </dl>
  );
}

function ScorePicker({
  criterion,
  value,
  disabled,
  onChange,
}: {
  criterion: Criterion;
  value: ScoreValue | undefined;
  disabled?: boolean;
  onChange: (value: ScoreValue) => void;
}) {
  const groupId = `score-${criterion}`;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="flex flex-wrap items-baseline gap-x-2">
        <span id={groupId} className="font-bungee text-xs uppercase">
          {CRITERION_LABELS[criterion]}
        </span>
        <span className="text-xs font-medium text-hs-brown">
          {CRITERION_HINTS[criterion]}
        </span>
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="grid grid-cols-4 border-[3px] border-hs-ink"
      >
        {ALLOWED_SCORES.map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${score}: ${SCORE_LABELS[score]}`}
              title={SCORE_LABELS[score]}
              disabled={disabled}
              onClick={() => onChange(score)}
              className={cn(
                "min-h-11 border-hs-ink font-bungee text-sm tabular-nums outline-none select-none not-last:border-r-[3px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hs-navy disabled:opacity-50 motion-safe:transition-[background-color,transform] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:not-disabled:scale-[0.97]",
                selected
                  ? "bg-hs-gold text-hs-ink"
                  : "bg-hs-paper text-hs-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand",
              )}
            >
              {score}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AssessmentForm({
  initial,
  saving,
  onSaveDraft,
  onSubmit,
}: {
  initial: AssessmentSnapshot | null;
  saving: boolean;
  onSaveDraft: (draft: AssessmentDraft) => Promise<void>;
  onSubmit: (draft: AssessmentDraft) => Promise<void>;
}) {
  const [scores, setScores] = useState<PartialScores>(initial?.scores ?? {});
  const [comment, setComment] = useState(initial?.ownCriteriaComment ?? "");
  const [saveError, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const complete = completeScores(scores);
  const trimmed = comment.trim();
  const commentOk = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH;
  const canSubmit = complete !== null && commentOk && !saving;
  const submitted = initial?.status === "submitted";
  const preview = complete ? rawScore(complete) : null;

  const run = async (
    work: () => Promise<void>,
    fallback: string,
    success: string,
  ) => {
    setError(null);
    setNotice(null);
    try {
      await work();
      setNotice(success);
    } catch (error) {
      setError(error instanceof Error ? error.message : fallback);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          return;
        }
        void run(
          () => onSubmit({ scores, ownCriteriaComment: trimmed }),
          "No se ha podido enviar la evaluación",
          submitted ? "Evaluación actualizada" : "Evaluación enviada",
        );
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bungee text-xs uppercase">Tu evaluación</span>
          {submitted ? (
            <Badge variant="gold">Enviada</Badge>
          ) : initial ? (
            <Badge>Borrador</Badge>
          ) : null}
        </div>
        <p className="font-bungee text-xl leading-none tabular-nums">
          <span className="inline-block min-w-[4ch] text-right">
            {formatScore(preview)}
          </span>
          <span className="text-hs-brown">/5</span>
        </p>
      </div>
      <ScoreLegend />
      <div className="grid gap-4 sm:grid-cols-2">
        {CRITERIA.map((criterion) => (
          <ScorePicker
            key={criterion}
            criterion={criterion}
            value={scores[criterion]}
            disabled={saving}
            onChange={(value) => {
              setNotice(null);
              setScores((prev) => ({ ...prev, [criterion]: value }));
            }}
          />
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="own-criteria-comment">
          Comentario sobre tu criterio propio
        </Label>
        <Textarea
          id="own-criteria-comment"
          required
          maxLength={MAX_COMMENT_LENGTH}
          value={comment}
          disabled={saving}
          placeholder="Qué has valorado y por qué"
          onChange={(event) => {
            setNotice(null);
            setComment(event.target.value);
          }}
        />
        <p className="text-right text-xs font-medium text-hs-brown tabular-nums">
          {trimmed.length}/{MAX_COMMENT_LENGTH}
        </p>
      </div>
      <FormError message={saveError} />
      <FormNotice message={notice} />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {submitted ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void run(
                () => onSaveDraft({ scores, ownCriteriaComment: comment }),
                "No se ha podido guardar el borrador",
                "Borrador guardado",
              )
            }
          >
            Guardar borrador
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {saving
            ? "Guardando…"
            : submitted
              ? "Actualizar evaluación"
              : "Enviar evaluación"}
        </Button>
      </div>
      {complete === null || !commentOk ? (
        <p className="text-sm font-medium text-pretty text-hs-brown">
          Para enviar hacen falta los cuatro criterios y el comentario.
        </p>
      ) : null}
    </form>
  );
}
