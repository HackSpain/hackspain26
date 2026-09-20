"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import type { RefObject } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CRITERIA,
  CRITERION_LABELS,
} from "@convex/lib/judging";
import { formatScore, ScoreLegend } from "@/components/judging/assessment-form";
import { ProjectDetails } from "@/components/judging/project-details";
import { VideoFrame } from "@/components/judging/video-frame";
import {
  EmptyState,
  Field,
  FormError,
  FormNotice,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  assessmentsCsv,
  downloadCsv,
  exportFileName,
  judgesCsv,
  rankingCsv,
} from "@/lib/judging-export";
import { urlOf } from "@/lib/urls";
import { cn } from "@/lib/utils";

const PROJECT_PARAM = "proyecto";

type Overview = FunctionReturnType<typeof api.judging.adminOverview>;
type ProjectRow = Overview["projects"][number];
type JudgeRow = Overview["judges"][number];
type Unresolved = Extract<
  FunctionReturnType<typeof api.judging.generateAssignments>,
  { ok: false }
>["unresolved"];
type Preview = FunctionReturnType<typeof api.judging.previewAssignments>;

function randomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function formatSigned(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const fixed = Math.abs(value).toFixed(2);
  if (value > 0) {
    return `+${fixed}`;
  }
  if (value < 0) {
    return `−${fixed}`;
  }
  return fixed;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function writeParams(
  pathname: string,
  mutate: (params: URLSearchParams) => void,
  mode: "push" | "replace",
) {
  const next = new URLSearchParams(window.location.search);
  mutate(next);
  const query = next.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  if (mode === "push") {
    window.history.pushState(null, "", url);
    return;
  }
  window.history.replaceState(null, "", url);
}

export default function AdminJudgingPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminJudging />
    </Suspense>
  );
}

function AdminJudging() {
  const overview = useQuery(api.judging.adminOverview);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get(PROJECT_PARAM) as Id<"submissions"> | null;
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  if (!overview) {
    return <LoadingText />;
  }

  const openProject = (id: Id<"submissions">, from: HTMLElement | null) => {
    triggerRef.current = from;
    const alreadyOpen = new URLSearchParams(window.location.search).has(
      PROJECT_PARAM,
    );
    writeParams(
      pathname,
      (params) => params.set(PROJECT_PARAM, id),
      alreadyOpen ? "replace" : "push",
    );
    if (!alreadyOpen) {
      pushed.current = true;
    }
  };
  const closeProject = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    writeParams(pathname, (params) => params.delete(PROJECT_PARAM), "replace");
  };

  const selected =
    overview.projects.find((project) => project._id === projectId) ?? null;

  return (
    <Page
      title="Jurado"
      description="Reparto de proyectos, seguimiento de evaluaciones y clasificación calibrada."
    >
      <SetupCard overview={overview} />
      <SettingsCard settings={overview.settings} />
      {overview.round ? (
        <>
          <CompletionCard overview={overview} />
          <JudgesCard judges={overview.judges} />
          <ProjectsCard
            overview={overview}
            projectId={projectId}
            onOpen={openProject}
          />
        </>
      ) : null}
      <ProjectSheet
        selected={projectId ? selected : null}
        threshold={overview.settings.disagreementThreshold}
        onClose={closeProject}
        returnFocusRef={triggerRef}
      />
    </Page>
  );
}

function CountBadge({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Badge variant={value > 0 ? "gold" : "default"} className="tabular-nums">
      {label} {value}
    </Badge>
  );
}

function SetupCard({ overview }: { overview: Overview }) {
  const generate = useMutation(api.judging.generateAssignments);
  const reset = useMutation(api.judging.resetAssignments);
  const [seed, setSeed] = useState("");
  const [previewSeed, setPreviewSeed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<Unresolved | null>(null);
  const preview = useQuery(
    api.judging.previewAssignments,
    previewSeed ? { seed: previewSeed } : "skip",
  );
  const { pool, round } = overview;
  const ready = pool.feasible;
  const loadLabel =
    pool.loadMin === pool.loadMax
      ? String(pool.loadMin)
      : `${pool.loadMin}–${pool.loadMax}`;
  const previewUnresolved =
    preview && preview.ok === false ? preview.unresolved : null;
  const shownUnresolved = previewUnresolved ?? unresolved;
  const previewOk = preview && preview.ok === true ? preview : null;

  const runGenerate = (replace: boolean) => {
    setError(null);
    setUnresolved(null);
    setConfirmRerun(false);
    setPending(true);
    void generate({
      replace: replace || undefined,
      seed: seed.trim() || undefined,
    })
      .then((result) => {
        if (!result.ok) {
          setUnresolved(result.unresolved);
          return;
        }
        setPreviewSeed(null);
        setSeed("");
      })
      .catch((error: unknown) =>
        setError(
          errorMessage(
            error,
            replace
              ? "No se ha podido volver a repartir"
              : "No se ha podido generar el reparto",
          ),
        ),
      )
      .finally(() => setPending(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Reparto
          <CountBadge label="Jueces" value={pool.judgeCount} />
          <CountBadge label="Proyectos" value={pool.projectCount} />
        </CardTitle>
        <CardDescription>
          Juzgado general: los jueces y proyectos enviados ahora mismo. Cada
          proyecto recibe dos jueces distintos
          {ready
            ? `, cada juez ${loadLabel} y ${pool.projectCount * 2} evaluaciones en total.`
            : "."}{" "}
          Prueba el reparto sin guardarlo. Volver a repartir borra las notas y
          asigna a todos los jueces actuales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {round ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
            <span>
              Semilla{" "}
              <code className="border border-hs-ink/20 bg-hs-sand px-1.5 py-0.5 font-mono text-xs">
                {round.seed}
              </code>
            </span>
            <span className="text-hs-brown">
              Generado el {formatDate(round.generatedAt)}
              {round.swaps > 0
                ? ` · ${round.swaps} ${round.swaps === 1 ? "intercambio" : "intercambios"} por conflicto`
                : ""}
            </span>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 sm:max-w-xs">
            <Field
              label="Semilla (opcional)"
              htmlFor="judging-seed"
              hint="Con la misma semilla sale el mismo reparto."
            >
              <Input
                id="judging-seed"
                value={seed}
                disabled={pending}
                onChange={(event) => {
                  setSeed(event.target.value);
                  setConfirmRerun(false);
                }}
                placeholder="Aleatoria si se deja vacía"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!ready || pending}
              onClick={() => {
                const next = seed.trim() || randomSeed();
                setSeed(next);
                setUnresolved(null);
                setError(null);
                setConfirmRerun(false);
                setPreviewSeed(next);
              }}
            >
              Probar
            </Button>
            {round ? (
              confirmRerun ? (
                <>
                  <Button
                    type="button"
                    disabled={!ready || pending}
                    onClick={() => runGenerate(true)}
                  >
                    {pending ? "Repartiendo…" : "Sí, borrar notas y repartir"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setConfirmRerun(false)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={!ready || pending}
                    onClick={() => {
                      if (round.canReset) {
                        runGenerate(true);
                        return;
                      }
                      setError(null);
                      setConfirmRerun(true);
                    }}
                  >
                    {pending ? "Repartiendo…" : "Volver a repartir"}
                  </Button>
                  {round.canReset ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        setPending(true);
                        void reset({})
                          .then(() => setPreviewSeed(null))
                          .catch((error: unknown) =>
                            setError(
                              errorMessage(error, "No se ha podido borrar el reparto"),
                            ),
                          )
                          .finally(() => setPending(false));
                      }}
                    >
                      Borrar
                    </Button>
                  ) : null}
                </>
              )
            ) : (
              <Button
                type="button"
                disabled={!ready || pending}
                onClick={() => runGenerate(false)}
              >
                {pending ? "Generando…" : "Generar"}
              </Button>
            )}
          </div>
        </div>
        {confirmRerun ? (
          <p className="text-sm font-medium text-pretty text-hs-brown">
            Esto borra todas las evaluaciones, también los borradores, y reparte
            otra vez a los jueces de ahora.
          </p>
        ) : null}
        {!ready ? (
          <p className="text-sm font-medium text-pretty text-hs-brown">
            {pool.problems.join(". ") ||
              "Aún no se puede generar el reparto."}
          </p>
        ) : null}
        <FormError message={saveError} />
        {previewSeed && preview === undefined ? (
          <p className="text-sm font-medium text-hs-brown">Calculando prueba…</p>
        ) : null}
        {previewOk ? <PreviewTable preview={previewOk} /> : null}
        {shownUnresolved && shownUnresolved.length > 0 ? (
          <Alert variant="error">
            <AlertDescription className="space-y-1">
              <p className="font-semibold text-hs-ink">
                No hay un reparto válido que evite estos conflictos. No se ha
                guardado nada.
              </p>
              <ul className="list-disc pl-5">
                {shownUnresolved.map((item) => (
                  <li key={`${item.judge._id}:${item.submissionId}`}>
                    {item.judge.name} · {item.projectName}
                  </li>
                ))}
              </ul>
              <p>Quita o cambia algún conflicto y vuelve a probar.</p>
            </AlertDescription>
          </Alert>
        ) : null}
        <ConflictsSection overview={overview} />
      </CardContent>
    </Card>
  );
}

function PreviewTable({
  preview,
}: {
  preview: Extract<Preview, { ok: true }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-pretty text-hs-brown">
        Prueba con semilla{" "}
        <code className="border border-hs-ink/20 bg-hs-sand px-1.5 py-0.5 font-mono text-xs text-hs-ink">
          {preview.seed}
        </code>
        {preview.swaps > 0
          ? ` · ${preview.swaps} ${preview.swaps === 1 ? "intercambio" : "intercambios"} por conflicto`
          : ""}
        . Aún no está guardada.
      </p>
      <Table className="border-separate border-spacing-0 font-medium">
        <TableHeader className="[&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
          <TableRow>
            <TableHead>Juez</TableHead>
            <TableHead className="text-right">Cola</TableHead>
            <TableHead>Proyectos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.judges.map((judge) => (
            <TableRow key={judge._id} className="[&_td]:border-b [&_td]:border-hs-ink/20">
              <TableCell className="align-top">{judge.name}</TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {judge.assigned}
              </TableCell>
              <TableCell className="text-pretty text-hs-brown">
                {judge.projects.join(" · ") || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConflictsSection({ overview }: { overview: Overview }) {
  const addConflict = useMutation(api.judging.addConflict);
  const removeConflict = useMutation(api.judging.removeConflict);
  const [judgeId, setJudgeId] = useState<string>("");
  const [submissionId, setSubmissionId] = useState<string>("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const judges = overview.judges.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  const projects = overview.projects.toSorted((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="space-y-3 border-t-[3px] border-hs-ink pt-4">
      <div>
        <p className="font-bungee text-xs uppercase">Conflictos de interés</p>
        <p className="text-sm font-medium text-pretty text-hs-brown">
          Un juez no evalúa los proyectos con los que tenga conflicto. Se
          resuelven con intercambios al generar el reparto.
          {overview.round
            ? " El reparto ya está hecho. Los conflictos nuevos solo se aplican si vuelves a repartir."
            : ""}
        </p>
      </div>
      {overview.conflicts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {overview.conflicts.map((conflict) => (
            <li
              key={conflict._id}
              className="inline-flex min-h-11 items-center gap-2 border-[3px] border-hs-ink bg-hs-paper px-3 text-sm font-medium"
            >
              <span>
                {conflict.judge.name} · {conflict.projectName}
                {conflict.note ? (
                  <span className="text-hs-brown"> · {conflict.note}</span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={pending}
                className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-hs-navy disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  setPending(true);
                  void removeConflict({ conflictId: conflict._id })
                    .catch((error: unknown) =>
                      setError(errorMessage(error, "No se ha podido quitar el conflicto")),
                    )
                    .finally(() => setPending(false));
                }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-medium text-hs-brown">Sin conflictos declarados.</p>
      )}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Field label="Juez" htmlFor="conflict-judge">
          <Select value={judgeId} onValueChange={setJudgeId}>
            <SelectTrigger id="conflict-judge" aria-label="Juez con conflicto">
              <SelectValue placeholder="Elegir juez" />
            </SelectTrigger>
            <SelectContent>
              {judges.map((judge) => (
                <SelectItem key={judge._id} value={judge._id}>
                  {judge.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Proyecto" htmlFor="conflict-project">
          <Select value={submissionId} onValueChange={setSubmissionId}>
            <SelectTrigger id="conflict-project" aria-label="Proyecto en conflicto">
              <SelectValue placeholder="Elegir proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name || "Sin título"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Motivo (opcional)" htmlFor="conflict-note">
          <Input
            id="conflict-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Mentor del equipo, misma empresa…"
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!judgeId || !submissionId || pending}
          onClick={() => {
            setError(null);
            setPending(true);
            void addConflict({
              judgeId: judgeId as Id<"users">,
              note: note.trim() || undefined,
              submissionId: submissionId as Id<"submissions">,
            })
              .then(() => {
                setJudgeId("");
                setSubmissionId("");
                setNote("");
              })
              .catch((error: unknown) =>
                setError(errorMessage(error, "No se ha podido añadir el conflicto")),
              )
              .finally(() => setPending(false));
          }}
        >
          Añadir
        </Button>
      </div>
      <FormError message={saveError} />
    </div>
  );
}

function SettingsCard({ settings }: { settings: Overview["settings"] }) {
  const update = useMutation(api.judging.updateSettings);
  const [lambda, setLambda] = useState(String(settings.lambda));
  const [threshold, setThreshold] = useState(String(settings.disagreementThreshold));
  const [pending, setPending] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const seen = `${settings.lambda}:${settings.disagreementThreshold}`;
  const [synced, setSynced] = useState(seen);
  if (synced !== seen) {
    setSynced(seen);
    setLambda(String(settings.lambda));
    setThreshold(String(settings.disagreementThreshold));
  }
  const lambdaValue = Number(lambda);
  const thresholdValue = Number(threshold);
  const lambdaOk = Number.isFinite(lambdaValue) && lambdaValue > 0;
  const thresholdOk = Number.isFinite(thresholdValue) && thresholdValue >= 0;
  const dirty =
    lambdaValue !== settings.lambda ||
    thresholdValue !== settings.disagreementThreshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibración</CardTitle>
        <CardDescription>
          La generosidad de cada juez se estima a partir de la diferencia entre
          las dos notas de cada proyecto. Lambda regulariza esa estimación. El
          valor 2 es prudente, no óptimo. Puedes cambiarlo en cualquier
          momento: generosidad, notas calibradas y puestos se recalculan al
          guardar. El umbral marca los proyectos cuyas dos notas brutas se
          separan demasiado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
          <Field
            label="Lambda"
            htmlFor="judging-lambda"
            hint="Mayor que cero. Se aplica a las evaluaciones ya enviadas."
          >
            <Input
              id="judging-lambda"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={lambda}
              disabled={pending}
              onChange={(event) => {
                setNotice(null);
                setLambda(event.target.value);
              }}
            />
          </Field>
          <Field
            label="Umbral de revisión"
            htmlFor="judging-threshold"
            hint="Diferencia mínima entre notas brutas."
          >
            <Input
              id="judging-threshold"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.25"
              value={threshold}
              disabled={pending}
              onChange={(event) => {
                setNotice(null);
                setThreshold(event.target.value);
              }}
            />
          </Field>
        </div>
        <FormError message={saveError} />
        <FormNotice message={notice} />
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || !lambdaOk || !thresholdOk || pending}
          onClick={() => {
            setError(null);
            setNotice(null);
            setPending(true);
            void update({
              disagreementThreshold: thresholdValue,
              lambda: lambdaValue,
            })
              .then(() => setNotice("Ajustes guardados. La clasificación ya usa los valores nuevos."))
              .catch((error: unknown) =>
                setError(errorMessage(error, "No se han podido guardar los ajustes")),
              )
              .finally(() => setPending(false));
          }}
        >
          {pending ? "Guardando…" : "Guardar ajustes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CompletionCard({ overview }: { overview: Overview }) {
  const { completion } = overview;
  const fraction = completion.total > 0 ? completion.submitted / completion.total : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Progreso
          <Badge variant={completion.complete ? "gold" : "default"} className="tabular-nums">
            {completion.submitted}/{completion.total}
          </Badge>
          <Badge variant={completion.complete ? "gold" : "default"}>
            {completion.complete ? "Clasificación final" : "Provisional"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={completion.total}
          aria-valuenow={completion.submitted}
          aria-label="Evaluaciones enviadas"
          className="h-3 w-full overflow-hidden border-[3px] border-hs-ink bg-hs-paper"
        >
          <div
            className="h-full w-full origin-left bg-hs-gold motion-safe:transition-transform motion-safe:duration-[var(--duration-enter)] motion-safe:ease-[var(--ease-out)]"
            style={{ transform: `scaleX(${fraction})` }}
          />
        </div>
        {completion.complete ? null : (
          <Alert>
            <AlertDescription>
              Faltan {completion.total - completion.submitted} evaluaciones y
              la clasificación es provisional. Los proyectos con menos de dos
              evaluaciones enviadas no puntúan.
              {completion.connected
                ? ""
                : " La red de calibración aún no conecta a todos los jueces, así que comparar proyectos de parejas de jueces distintas no es fiable todavía."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ExportButton({
  label,
  disabled,
  onExport,
}: {
  label: string;
  disabled?: boolean;
  onExport: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onExport}
    >
      {label}
    </Button>
  );
}

function JudgesCard({ judges }: { judges: JudgeRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          Jueces
          <ExportButton
            label="Exportar CSV"
            disabled={judges.length === 0}
            onExport={() =>
              downloadCsv(exportFileName("jueces"), judgesCsv(judges))
            }
          />
        </CardTitle>
        <CardDescription>
          Una generosidad positiva significa que el juez tiende a puntuar
          alto, y negativa que tiende a puntuar bajo. Se recalcula con cada
          evaluación enviada. Los borradores no cuentan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table className="border-separate border-spacing-0 font-medium">
          <TableHeader className="[&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
            <TableRow>
              <TableHead>Juez</TableHead>
              <TableHead className="text-right">Enviadas</TableHead>
              <TableHead className="text-right">Borradores</TableHead>
              <TableHead className="text-right">Generosidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {judges.map((judge) => (
              <TableRow key={judge._id} className="[&_td]:border-b [&_td]:border-hs-ink/20">
                <TableCell>
                  <span className="block truncate">{judge.name}</span>
                  {judge.email ? (
                    <span className="block truncate text-xs text-hs-brown">{judge.email}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Badge
                    variant={judge.submitted >= judge.assigned && judge.assigned > 0 ? "gold" : "default"}
                    className="tabular-nums"
                  >
                    {judge.submitted}/{judge.assigned}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{judge.drafts}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatSigned(judge.generosity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RankMark({ rank }: { rank: number | null }) {
  if (rank === null) {
    return <span className="inline-block min-w-[2.5ch] text-right text-hs-brown">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex min-h-7 min-w-[2.5ch] items-center justify-end px-1 font-bungee text-sm tabular-nums",
        rank === 1 && "bg-hs-gold text-hs-ink",
      )}
    >
      {rank}
    </span>
  );
}

function ProjectsCard({
  overview,
  projectId,
  onOpen,
}: {
  overview: Overview;
  projectId: Id<"submissions"> | null;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  const flagged = overview.projects.filter((project) => project.flagged).length;
  const empty = overview.projects.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Proyectos
          {flagged > 0 ? (
            <Badge className="border-hs-red bg-hs-red/10 text-hs-red">
              {flagged} para revisar
            </Badge>
          ) : null}
          <span className="ml-auto flex flex-wrap gap-2">
            <ExportButton
              label="Clasificación CSV"
              disabled={empty}
              onExport={() =>
                downloadCsv(
                  exportFileName("clasificacion"),
                  rankingCsv(overview.projects, {
                    final: overview.completion.complete,
                  })
                )
              }
            />
            <ExportButton
              label="Evaluaciones CSV"
              disabled={empty}
              onExport={() =>
                downloadCsv(
                  exportFileName("evaluaciones"),
                  assessmentsCsv(overview.projects)
                )
              }
            />
          </span>
        </CardTitle>
        <CardDescription>
          Orden por media calibrada (nota bruta menos generosidad del juez).
          Los empates exactos comparten puesto. Se marca para revisar cuando
          las dos notas brutas difieren al menos{" "}
          {overview.settings.disagreementThreshold.toFixed(2)} puntos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview.projects.length === 0 ? (
          <EmptyState title="Sin proyectos enviados" />
        ) : (
          <Table
            className="border-separate border-spacing-0 font-medium"
            containerClassName="max-h-[min(48rem,calc(100dvh-14rem))] overflow-auto overscroll-contain"
          >
            <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
              <TableRow>
                <TableHead className="w-14 text-right">#</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Jueces</TableHead>
                <TableHead className="text-right">Notas</TableHead>
                <TableHead className="text-right">Bruta</TableHead>
                <TableHead className="text-right">Calibrada</TableHead>
                <TableHead className="text-right">Dif.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.projects.map((project) => (
                <TableRow
                  key={project._id}
                  data-state={project._id === projectId ? "selected" : undefined}
                  onClick={(event) =>
                    onOpen(
                      project._id,
                      event.currentTarget.querySelector<HTMLElement>("[data-row-trigger]"),
                    )
                  }
                  className={cn(
                    "h-11 cursor-pointer motion-safe:transition-colors motion-safe:duration-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 [&_td]:border-b [&_td]:border-hs-ink/20",
                    project.flagged && "[&_td]:bg-hs-red/5",
                  )}
                >
                  <TableCell className="text-right">
                    <RankMark rank={project.rank} />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      data-row-trigger
                      aria-haspopup="dialog"
                      aria-expanded={project._id === projectId}
                      className="-mx-1 block min-w-0 max-w-64 truncate px-1 text-left underline-offset-2 outline-none focus-visible:border-[3px] focus-visible:border-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                    >
                      {project.name || "Sin título"}
                    </button>
                    <span className="block truncate text-xs text-hs-brown">
                      {project.teamName ?? "Sin equipo"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    {project.judges.map((judge) => (
                      <span key={judge._id} className="block truncate text-xs">
                        {judge.name}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {project.judges.map((judge) => {
                      const row = project.assessments.find(
                        (assessment) => assessment.judge._id === judge._id,
                      );
                      return (
                        <span key={judge._id} className="block text-xs">
                          {formatScore(row?.rawScore)}
                        </span>
                      );
                    })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(project.rawMean)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(project.calibratedMean)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(project.difference)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant={project.submittedCount === 2 ? "gold" : "default"}
                        className="tabular-nums"
                      >
                        {project.submittedCount}/2
                      </Badge>
                      {project.flagged ? (
                        <Badge className="border-hs-red bg-hs-red/10 text-hs-red">
                          Revisar
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectSheet({
  selected,
  threshold,
  onClose,
  returnFocusRef,
}: {
  selected: ProjectRow | null;
  threshold: number;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState<ProjectRow | null>(selected);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const item = selected ?? shown;

  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent
        className="sm:max-w-3xl lg:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            target.focus();
          }
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item?.name || "Proyecto"}
            {item?.rank !== null && item?.rank !== undefined ? (
              <Badge variant="gold">Puesto {item.rank}</Badge>
            ) : null}
            {item?.flagged ? (
              <Badge className="border-hs-red bg-hs-red/10 text-hs-red">Revisar</Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription className="font-medium">
            {item?.teamName ?? "Sin equipo"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {item === null ? (
            <EmptyState title="Proyecto no encontrado" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Media bruta" value={formatScore(item.rawMean)} />
                <Stat label="Media calibrada" value={formatScore(item.calibratedMean)} />
                <Stat
                  label="Diferencia"
                  value={formatScore(item.difference)}
                  hint={
                    item.difference !== null && item.difference >= threshold
                      ? `Supera el umbral de ${threshold.toFixed(2)}`
                      : undefined
                  }
                />
              </div>
              <AssessmentBreakdown item={item} />
              <div className="grid gap-5 border-t-[3px] border-hs-ink pt-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <VideoFrame url={urlOf(item.urls, "video")} />
                <ProjectDetails item={item} />
              </div>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-[3px] border-hs-ink bg-hs-paper px-3 py-2">
      <p className="font-bungee text-xs uppercase text-hs-brown">{label}</p>
      <p className="font-bungee text-2xl leading-tight tabular-nums">{value}</p>
      {hint ? <p className="text-xs font-medium text-hs-red">{hint}</p> : null}
    </div>
  );
}

function noteCopy(
  assessment: ProjectRow["assessments"][number] | null,
): string {
  if (assessment?.ownCriteriaComment) {
    return assessment.ownCriteriaComment;
  }
  if (!assessment) {
    return "Sin evaluación.";
  }
  if (assessment.status === "submitted") {
    return "Sin notas.";
  }
  return "Borrador sin enviar.";
}

function AssessmentBreakdown({ item }: { item: ProjectRow }) {
  const rows = item.judges.map((judge) => ({
    assessment: item.assessments.find((row) => row.judge._id === judge._id) ?? null,
    judge,
  }));
  return (
    <div className="space-y-3">
      <ScoreLegend />
      <Table className="border-separate border-spacing-0 font-medium">
        <TableHeader className="[&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
          <TableRow>
            <TableHead>Criterio</TableHead>
            {rows.map(({ judge }) => (
              <TableHead key={judge._id} className="text-right">
                <span className="block truncate">{judge.name}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {CRITERIA.map((criterion) => (
            <TableRow key={criterion} className="[&_td]:border-b [&_td]:border-hs-ink/20">
              <TableCell>{CRITERION_LABELS[criterion]}</TableCell>
              {rows.map(({ judge, assessment }) => (
                <TableCell key={judge._id} className="text-right tabular-nums">
                  {assessment?.status === "submitted"
                    ? (assessment[criterion] ?? "—")
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="[&_td]:border-b [&_td]:border-hs-ink/20">
            <TableCell className="font-bungee text-xs uppercase">Nota bruta</TableCell>
            {rows.map(({ judge, assessment }) => (
              <TableCell key={judge._id} className="text-right tabular-nums">
                {formatScore(assessment?.rawScore)}
              </TableCell>
            ))}
          </TableRow>
          <TableRow className="[&_td]:border-b [&_td]:border-hs-ink/20">
            <TableCell className="font-bungee text-xs uppercase">Ajustada</TableCell>
            {rows.map(({ judge, assessment }) => (
              <TableCell key={judge._id} className="text-right tabular-nums">
                {formatScore(assessment?.adjustedScore)}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell className="font-bungee text-xs uppercase">Estado</TableCell>
            {rows.map(({ judge, assessment }) => (
              <TableCell key={judge._id} className="text-right">
                {assessment?.status === "submitted" ? (
                  <Badge variant="gold">Enviada</Badge>
                ) : assessment ? (
                  <Badge>Borrador</Badge>
                ) : (
                  <span className="text-hs-brown">Pendiente</span>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ judge, assessment }) => (
          <div key={judge._id} className="border-[3px] border-hs-ink bg-hs-paper p-3">
            <p className="font-bungee text-xs uppercase">{judge.name}</p>
            <p className="mt-1 text-sm font-medium text-pretty whitespace-pre-wrap">
              {noteCopy(assessment)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
