"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Github,
  ImagePlus,
  Phone,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/avatar";
import { useGithubLink } from "@/components/github-link-banner";
import {
  errorMessage,
  Field,
  FormError,
  LoadingText,
  Page,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn, phoneVerifyMessage } from "@/lib/utils";

type Profile = NonNullable<FunctionReturnType<typeof api.users.me>>;

function useProfileAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    if (pending) {
      return;
    }
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      setMessage(await action());
    } catch (caughtError: unknown) {
      setError(
        errorMessage(
          caughtError,
          "No hemos podido guardar el cambio. Inténtalo de nuevo."
        )
      );
    } finally {
      setPending(false);
    }
  }

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  return { clearFeedback, error, message, pending, run };
}

function Feedback({
  action,
  hideMessage = false,
}: {
  action: ReturnType<typeof useProfileAction>;
  hideMessage?: boolean;
}) {
  return (
    <>
      <FormError message={action.error} />
      <div role="status" aria-live="polite" aria-atomic="true">
        {action.message && !hideMessage ? (
          <p className="flex items-start gap-2 text-sm text-hs-navy">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {action.message}
          </p>
        ) : null}
      </div>
    </>
  );
}

function ProfileSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-5 py-5 sm:py-6">
        <CardHeader className="flex items-start gap-3 px-5 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center border-2 border-hs-ink/15 bg-hs-sand/60">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={id} className="text-base leading-snug">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-hs-brown">
              {description}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 sm:px-6">{children}</CardContent>
      </Card>
    </section>
  );
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function storageIdFromUpload(value: unknown): Id<"_storage"> {
  if (
    typeof value === "object" &&
    value !== null &&
    "storageId" in value &&
    typeof value.storageId === "string"
  ) {
    return value.storageId as Id<"_storage">;
  }
  throw new Error("No se pudo subir la foto");
}

function IdentityCard({ me }: { me: Profile }) {
  const setName = useMutation(api.users.setName);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.users.setAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const action = useProfileAction();
  const [nameDraft, setNameDraft] = useState<string | undefined>();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const name = nameDraft ?? me.name ?? "";
  const nameChanged = name.trim() !== (me.name ?? "");

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Solo se admiten imágenes");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error("La foto no puede superar 2 MB.");
    }
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {throw new Error("No se pudo subir la foto");}
    await setAvatar({ imageId: storageIdFromUpload(await response.json()) });
  }

  return (
    <ProfileSection
      id="identity-heading"
      title="Nombre y foto"
      description="Así te ven los demás en el feed y en el directorio."
      icon={UserRound}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={me.name}
          src={me.avatarUrl}
          className="size-20 text-2xl shadow-[4px_4px_0_var(--color-hs-ink)]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-[3px] border-hs-ink bg-hs-gold px-5 font-bungee text-sm text-hs-ink hs-hover-bright">
            <ImagePlus className="size-4" aria-hidden />
            {action.pending ? "Subiendo…" : "Cambiar foto"}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={action.pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {return;}
                void action.run(async () => {
                  try {
                    await upload(file);
                  } finally {
                    if (fileInput.current) {fileInput.current.value = "";}
                  }
                  return "Foto actualizada.";
                });
              }}
            />
          </label>
          {me.avatarUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  await removeAvatar({});
                  return "Foto eliminada.";
                })
              }
            >
              <Trash2 aria-hidden /> Quitar foto
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-hs-brown">
        JPG, PNG, WebP o GIF de hasta 2 MB.
        {!me.avatarUrl && me.githubLinked
          ? " Vincula GitHub para usar tu avatar de allí."
          : ""}
      </p>
      <form
        className="space-y-3 border-t border-hs-ink/15 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await setName({ name });
            setNameDraft(undefined);
            return "Nombre guardado.";
          });
        }}
      >
        <Field label="Nombre" htmlFor="display-name">
          <Input
            id="display-name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            value={name}
            disabled={action.pending}
            onChange={(event) => setNameDraft(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={action.pending || !nameChanged}
        >
          <Save aria-hidden /> Guardar nombre
        </Button>
      </form>
      <Feedback action={action} />
    </ProfileSection>
  );
}

function GithubCard({
  linked,
  username,
}: {
  linked: boolean;
  username?: string;
}) {
  const { link, pending, error } = useGithubLink();
  const unlink = useMutation(api.github.unlink);
  const action = useProfileAction();

  return (
    <ProfileSection
      id="github-heading"
      title="GitHub"
      description="Conecta tu cuenta para que tu equipo pueda encontrarte."
      icon={Github}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-hs-ink/15 pb-4">
        <p className="min-w-0 break-all font-semibold">
          {linked && username ? `@${username}` : "Tu cuenta de GitHub"}
        </p>
        <span
          className={cn(
            "shrink-0 px-2 py-1 text-xs font-semibold",
            linked ? "bg-hs-teal/15 text-hs-navy" : "bg-hs-sand text-hs-brown"
          )}
        >
          {linked ? "Vinculada" : "Sin vincular"}
        </span>
      </div>
      <FormError message={error} />
      <Button
        type="button"
        className="w-full"
        variant={linked ? "outline" : "default"}
        disabled={pending || action.pending}
        onClick={() => void link()}
      >
        {pending
          ? "Abriendo GitHub…"
          : linked
            ? "Volver a vincular"
            : "Vincular GitHub"}
        <ArrowUpRight aria-hidden />
      </Button>
      {linked ? (
        <button
          type="button"
          className="min-h-11 text-sm text-hs-brown underline decoration-hs-brown/40 underline-offset-4 disabled:opacity-50"
          disabled={pending || action.pending}
          onClick={() =>
            void action.run(async () => {
              await unlink({});
              return "Cuenta de GitHub desvinculada.";
            })
          }
        >
          {action.pending ? "Desvinculando…" : "Desvincular cuenta"}
        </button>
      ) : null}
      <Feedback action={action} />
    </ProfileSection>
  );
}

function PhoneCard({ me }: { me: Profile }) {
  const requestPhoneCode = useMutation(api.onboarding.requestPhoneCode);
  const verifyPhoneCode = useMutation(api.onboarding.verifyPhoneCode);
  const action = useProfileAction();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const showForm = editing || !me.phoneConfirmed;

  return (
    <ProfileSection
      id="phone-heading"
      title="Teléfono"
      description="Un número de contacto para el evento."
      icon={Phone}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-hs-sand/50 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-hs-brown">Número actual</p>
          <p className="break-all text-base font-semibold tabular-nums">
            {me.phone || "Sin número"}
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            me.phoneConfirmed ? "text-hs-navy" : "text-hs-brown"
          )}
        >
          {me.phoneConfirmed ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : null}
          {me.phoneConfirmed ? "Verificado" : "Sin verificar"}
        </span>
      </div>
      {showForm ? (
        <>
          {sentPhone ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  const result = await verifyPhoneCode({ code });
                  if (!result.ok) {
                    throw new Error(phoneVerifyMessage(result.reason));
                  }
                  setCode("");
                  setPhone("");
                  setSentPhone(null);
                  setDebugCode(null);
                  setEditing(false);
                  return "Teléfono verificado y actualizado.";
                });
              }}
            >
              <p className="text-sm text-hs-brown">
                Introduce el código para{" "}
                <span className="font-semibold break-all text-hs-ink">
                  {sentPhone}
                </span>
                . Caduca en 10 minutos.
              </p>
              {debugCode ? (
                <p className="border border-hs-navy/30 bg-hs-slate/20 p-3 text-sm text-hs-navy">
                  Código de prueba:{" "}
                  <span className="font-mono font-bold">{debugCode}</span>
                </p>
              ) : null}
              <Field label="Código de confirmación" htmlFor="phone-code">
                <Input
                  id="phone-code"
                  className="max-w-60 font-mono text-lg tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  placeholder="000000"
                  disabled={action.pending}
                  onChange={(event) =>
                    setCode(event.target.value.replaceAll(/\D/g, ""))
                  }
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  disabled={action.pending || code.length !== 6}
                >
                  {action.pending ? "Verificando…" : "Confirmar teléfono"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => {
                    action.clearFeedback();
                    setSentPhone(null);
                    setCode("");
                    setDebugCode(null);
                  }}
                >
                  Volver a enviar
                </Button>
              </div>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  const result = await requestPhoneCode({ phone });
                  setDebugCode(result.debugCode ?? null);
                  setSentPhone(phone);
                  setCode("");
                  return result.delivery === "stub"
                    ? "Código de prueba generado."
                    : "Código de confirmación solicitado.";
                });
              }}
            >
              <Field
                label={
                  me.phoneConfirmed ? "Nuevo número" : "Número de teléfono"
                }
                htmlFor="phone"
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus={editing}
                  required
                  placeholder="+34 600 111 222"
                  aria-describedby="phone-hint"
                  value={phone}
                  disabled={action.pending}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p id="phone-hint" className="text-xs text-hs-brown">
                  Incluye el prefijo de tu país, por ejemplo +34.
                </p>
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={action.pending || !phone.trim()}
                >
                  {action.pending ? "Solicitando código…" : "Enviar código"}
                </Button>
                {me.phoneConfirmed ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={action.pending}
                    onClick={() => {
                      action.clearFeedback();
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            action.clearFeedback();
            setEditing(true);
          }}
        >
          Cambiar número
        </Button>
      )}
      <Feedback action={action} />
    </ProfileSection>
  );
}

function NotificationsCard({ consent }: { consent: boolean }) {
  const setConsent = useMutation(api.users.setNotificationConsent);
  const action = useProfileAction();

  return (
    <ProfileSection
      id="notifications-heading"
      title="Avisos del evento"
      description="Tú eliges si quieres recibirlos."
      icon={Bell}
    >
      <div className="flex items-start gap-3 border border-hs-ink/15 bg-hs-sand/30 p-4">
        <Checkbox
          aria-labelledby="notification-consent-label"
          className="mt-0.5"
          checked={consent}
          disabled={action.pending}
          onCheckedChange={(value) =>
            void action.run(async () => {
              await setConsent({ consent: value === true });
              return value === true
                ? "Avisos activados."
                : "Avisos desactivados.";
            })
          }
        />
        <span className="space-y-1">
          <span id="notification-consent-label" className="block font-semibold">
            Recibir avisos operativos
          </span>
          <span className="block text-sm leading-relaxed text-hs-brown">
            Comunicaciones de la organización sobre HackSpain.
          </span>
        </span>
      </div>
      <Feedback action={action} />
    </ProfileSection>
  );
}

export default function ProfilePage() {
  const me = useQuery(api.users.me);
  if (!me) {
    return <LoadingText />;
  }

  return (
    <Page className="[&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-hs-navy">
      <div className="overflow-hidden border-[3px] border-hs-ink">
        <div className="flex items-center justify-between gap-4 bg-hs-navy px-5 py-3 text-hs-paper sm:px-7">
          <h1 className="text-lg sm:text-xl">Mi perfil</h1>
          <span className="font-bungee text-xs text-hs-gold">HackSpain</span>
        </div>
        <div className="flex flex-col gap-5 bg-hs-sand/50 p-5 sm:flex-row sm:items-center sm:p-7">
          <Avatar
            name={me.name}
            src={me.avatarUrl}
            className="size-16 text-2xl shadow-[4px_4px_0_var(--color-hs-ink)] sm:size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="font-bungee text-xl leading-tight break-words sm:text-2xl">
              {me.name || "Tu cuenta"}
            </p>
            {me.email ? (
              <p className="mt-2 text-sm break-all text-hs-brown">{me.email}</p>
            ) : null}
            <p className="mt-3 text-sm text-hs-brown">
              {me.userType
                ? `${me.userType.label} · tu cuenta y tus preferencias.`
                : "Tu cuenta y tus preferencias para el evento."}
            </p>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <IdentityCard me={me} />
          <PhoneCard me={me} />
        </div>
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <GithubCard linked={me.githubLinked} username={me.githubUsername} />
          <NotificationsCard consent={me.notificationConsent} />
        </div>
      </div>
    </Page>
  );
}
