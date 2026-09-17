"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Github,
  Network,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Feedback, useActionFeedback } from "@/components/action-feedback";
import { Avatar } from "@/components/avatar";
import { AvatarPicker } from "@/components/avatar-picker";
import { useGithubLink } from "@/components/github-link-banner";
import { Field, FormError, LoadingText, Page } from "@/components/page";
import { DirectoryForm } from "@/components/participant-directory/directory-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Profile = NonNullable<FunctionReturnType<typeof api.users.me>>;

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

function IdentityCard({ me }: { me: Profile }) {
  const setName = useMutation(api.users.setName);
  const action = useActionFeedback();
  const [nameDraft, setNameDraft] = useState<string | undefined>();
  const name = nameDraft ?? me.name ?? "";
  const nameChanged = name.trim() !== (me.name ?? "");

  return (
    <ProfileSection
      id="identity-heading"
      title="Nombre y foto"
      description="Así te ven los demás en el feed y en el directorio."
      icon={UserRound}
    >
      <AvatarPicker
        name={me.name}
        avatarUrl={me.avatarUrl}
        action={action}
        canRemove={me.canRemoveAvatar}
      />
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
  twitterHandle,
}: {
  linked: boolean;
  username?: string;
  twitterHandle?: string;
}) {
  const { link, pending, error } = useGithubLink();
  const unlink = useMutation(api.github.unlink);
  const setTwitterHandle = useMutation(api.users.setTwitterHandle);
  const action = useActionFeedback();
  const xAction = useActionFeedback();
  const [handleDraft, setHandleDraft] = useState<string | undefined>();
  const handle = handleDraft ?? twitterHandle ?? "";
  const handleChanged = handle.trim() !== (twitterHandle ?? "");

  return (
    <ProfileSection
      id="github-heading"
      title="GitHub y X"
      description="Conecta tus cuentas para que tu equipo pueda encontrarte."
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
      <form
        className="space-y-3 border-t border-hs-ink/15 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void xAction.run(async () => {
            const saved = await setTwitterHandle({ handle });
            setHandleDraft(undefined);
            return saved ? `Usuario de X guardado: @${saved}.` : "Usuario de X eliminado.";
          });
        }}
      >
        <Field label="Usuario de X" htmlFor="twitter-handle" hint="Sin la @. Vacío si no tienes cuenta.">
          <Input
            id="twitter-handle"
            autoComplete="off"
            maxLength={80}
            placeholder="hackspain"
            value={handle}
            disabled={xAction.pending}
            onChange={(event) => setHandleDraft(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={xAction.pending || !handleChanged}
        >
          <Save aria-hidden /> Guardar usuario de X
        </Button>
        <Feedback action={xAction} />
      </form>
    </ProfileSection>
  );
}

function DirectoryCard() {
  const directory = useQuery(api.directory.me);
  const [saved, setSaved] = useState(false);

  return (
    <div id="ficha" className="scroll-mt-6">
      <ProfileSection
        id="directory-heading"
        title="Mi ficha"
        description="Lo que los demás ven de ti en el grafo de participantes y por dónde te conectamos."
        icon={Network}
      >
        {directory === undefined ? (
          <LoadingText />
        ) : (
          <>
            <DirectoryForm
              me={directory}
              bare
              onSaved={() => setSaved(true)}
            />
            <div role="status" aria-live="polite" aria-atomic="true">
              {saved ? (
                <p className="flex items-start gap-2 text-sm text-hs-navy">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Ficha guardada.
                </p>
              ) : null}
            </div>
          </>
        )}
      </ProfileSection>
    </div>
  );
}

function PhoneCard({ phone }: { phone: string | undefined }) {
  const setPhone = useMutation(api.users.setPhone);
  const action = useActionFeedback();
  const [draft, setDraft] = useState<string | undefined>();
  const value = draft ?? phone ?? "";
  const dirty = value.trim() !== (phone ?? "");

  return (
    <ProfileSection
      id="phone-heading"
      title="Teléfono"
      description="Un número de contacto para localizarte en el evento."
      icon={Phone}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            const saved = await setPhone({ phone: value });
            setDraft(undefined);
            return `Teléfono guardado: ${saved}.`;
          });
        }}
      >
        <Field label="Número de teléfono" htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            required
            placeholder="+34 600 111 222"
            aria-describedby="phone-hint"
            value={value}
            disabled={action.pending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p id="phone-hint" className="text-xs text-hs-brown">
            Incluye el prefijo de tu país, por ejemplo +34.
          </p>
        </Field>
        <Button
          type="submit"
          variant="outline"
          disabled={action.pending || !dirty || !value.trim()}
        >
          <Save aria-hidden />{" "}
          {action.pending ? "Guardando…" : "Guardar teléfono"}
        </Button>
      </form>
      <Feedback action={action} />
    </ProfileSection>
  );
}

function NotificationsCard({ consent }: { consent: boolean }) {
  const setConsent = useMutation(api.users.setNotificationConsent);
  const action = useActionFeedback();

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
          <DirectoryCard />
          <PhoneCard phone={me.phone} />
        </div>
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <GithubCard
            linked={me.githubLinked}
            username={me.githubUsername}
            twitterHandle={me.twitterHandle}
          />
          <NotificationsCard consent={me.notificationConsent} />
        </div>
      </div>
    </Page>
  );
}
