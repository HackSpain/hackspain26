import type { ReactNode } from "react";
import { Page } from "@/components/page";
import { CodeBlock } from "@/components/team-cli-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function CommandRow({
  command,
  children,
}: {
  command: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-hs-ink/15 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
      <code className="font-mono text-xs break-words sm:text-sm">{command}</code>
      <p className="text-sm text-hs-brown">{children}</p>
    </div>
  );
}

function CommandCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const EXIT_CODES = [
  { code: "0", meaning: "Todo bien" },
  { code: "1", meaning: "Error del servidor o genérico" },
  { code: "2", meaning: "Error de uso (flags mal puestos, falta input en modo no interactivo)" },
  { code: "3", meaning: "Sin sesión o sesión caducada" },
  { code: "4", meaning: "Aún no elegible (sin solicitud, sin aceptar u onboarding incompleto)" },
  { code: "5", meaning: "No se pudo alcanzar el backend" },
  { code: "130", meaning: "Interrumpido (Ctrl+C)" },
] as const;

export default function CliPage() {
  return (
    <Page
      title="hackspain CLI"
      description="El cliente de terminal para participantes. Misma cuenta y mismos datos que este dashboard: equipos, retos, entrega, feed y watcher, todo desde tu terminal."
    >
      <div className="hs-stagger space-y-4">
        <CommandCard
          title="Instalación"
          description="macOS y Linux. El binario es autocontenido; no hay nada más que instalar."
        >
          <div className="space-y-3">
            <CodeBlock>
              {"curl -fsSL https://hackspain.com/install.sh | sh\nhackspain update   # más adelante, para la última versión"}
            </CodeBlock>
            <p className="text-sm text-hs-brown">
              Windows: descarga{" "}
              <code className="font-mono text-xs">hackspain-windows-x64.exe</code>{" "}
              desde la{" "}
              <a
                href="https://github.com/HackSpain/hackspain26/releases"
                target="_blank"
                rel="noreferrer"
                className="text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
              >
                página de releases
              </a>{" "}
              y renómbralo a <code className="font-mono text-xs">hackspain.exe</code>.
            </p>
          </div>
        </CommandCard>

        <CommandCard
          title="Primeros pasos"
          description="Inicia sesión con el mismo email del dashboard. Tras el login te pedirá lo que falte: nombre, teléfono o GitHub."
        >
          <CommandRow command="hackspain">
            Dónde estás y qué toca hacer a continuación.
          </CommandRow>
          <CommandRow command="hackspain auth login">
            Email + código de 8 dígitos, como en la web.
          </CommandRow>
          <CommandRow command="hackspain auth status">
            Comprueba tu sesión.
          </CommandRow>
          <CommandRow command="hackspain auth logout">Cierra sesión.</CommandRow>
        </CommandCard>

        <CommandCard title="Perfil">
          <CommandRow command="hackspain profile">
            Nombre, dieta, viaje, teléfono, avisos y GitHub.
          </CommandRow>
          <CommandRow command="hackspain profile edit [--name …] [--diet …] [--from …]">
            Edita los datos de tu perfil.
          </CommandRow>
          <CommandRow command="hackspain profile notify on|off">
            Activa o desactiva los avisos.
          </CommandRow>
          <CommandRow command="hackspain profile phone [+34…] [--code …]">
            Verifica el teléfono por SMS, igual que en el dashboard.
          </CommandRow>
          <CommandRow command="hackspain profile github [--unlink]">
            Imprime el enlace para autorizar GitHub en el navegador.
          </CommandRow>
        </CommandCard>

        <CommandCard
          title="Equipo"
          description="Toda la gestión del equipo vive aquí. Para unirte, el dueño comparte su código de invitación de 8 caracteres."
        >
          <CommandRow command="hackspain team create <name> [-m github:x -m a@b.c]">
            Crea el equipo; añade gente por GitHub, X o email.
          </CommandRow>
          <CommandRow command="hackspain team join <code>">
            Únete con el código de 8 caracteres del dueño.
          </CommandRow>
          <CommandRow command="hackspain team show | list">
            Tu equipo, o todos los equipos.
          </CommandRow>
          <CommandRow command="hackspain team code [--regenerate]">
            Muestra (o regenera) el código de invitación.
          </CommandRow>
          <CommandRow command="hackspain team repo [url|--clear]">
            Vincula el repositorio de GitHub; su actividad aparece en el feed.
          </CommandRow>
          <CommandRow command="hackspain team leave">Sal del equipo.</CommandRow>
          <CommandRow command="hackspain team transfer [member]">
            El dueño cede el equipo a otro miembro.
          </CommandRow>
          <CommandRow command="hackspain team dissolve">
            El dueño borra un equipo en el que no queda nadie más.
          </CommandRow>
          <CommandRow command="hackspain stack set nextjs convex claude-code">
            Declara el stack tecnológico del equipo.
          </CommandRow>
        </CommandCard>

        <CommandCard
          title="Retos y entrega"
          description="Un proyecto por equipo, tantos retos como quieras. La entrega congela todo; los borradores se pueden guardar antes."
        >
          <CommandRow command="hackspain track list">
            Retos disponibles.
          </CommandRow>
          <CommandRow command="hackspain track register <slug…> | unregister <slug…>">
            Apúntate o bórrate de retos.
          </CommandRow>
          <CommandRow command="hackspain track move <from> <to>">
            Cámbiate de reto.
          </CommandRow>
          <CommandRow command="hackspain submit [--draft]">
            Formulario interactivo de entrega; flags para scripts.
          </CommandRow>
          <CommandRow command="hackspain project show | list">
            Tu proyecto, o todos los proyectos.
          </CommandRow>
        </CommandCard>

        <CommandCard title="Perks y milestones">
          <CommandRow command="hackspain perk list">
            Catálogo de beneficios de partners. Reclamarlos se hace en el
            dashboard.
          </CommandRow>
          <CommandRow command="hackspain milestone add firstCommit|firstBuild|firstDemo|custom [--label …] [--at ISO]">
            Registra un hito de tu equipo.
          </CommandRow>
          <CommandRow command="hackspain milestone list [--all]">
            Hitos registrados.
          </CommandRow>
        </CommandCard>

        <CommandCard
          title="Feed"
          description="El mismo feed que la página Feed del dashboard: mensajes de todo el mundo más pushes y PRs de cada repo de equipo."
        >
          <CommandRow command="hackspain feed [-n 20]">
            Últimas publicaciones y actividad de GitHub.
          </CommandRow>
          <CommandRow command='hackspain post "texto" [--image foto.jpg]'>
            Publica (≤500 caracteres; jpeg/png/webp/gif ≤5 MB).
          </CommandRow>
        </CommandCard>

        <CommandCard
          title="Watcher"
          description="Pensado para quedarse abierto en su propia terminal todo el fin de semana: detecta tus harnesses de IA (Claude Code, Codex, OpenCode, Cline), muestra el feed y los avisos de la organización, y reporta uso. Nunca salen prompts ni rutas completas de tu máquina."
        >
          <CommandRow command="hackspain watch [--interval 30] [--backfill <hours>] [--no-upload] [--once]">
            Arranca el watcher. <code className="font-mono text-xs">q</code>{" "}
            sale, <code className="font-mono text-xs">p</code> pausa.
          </CommandRow>
          <CommandRow command="hackspain telemetry stats">
            Lo que el watcher ha registrado en esta máquina.
          </CommandRow>
        </CommandCard>

        <CommandCard
          title="Para scripts: --json"
          description="Cualquier comando con --json imprime exactamente un objeto JSON en stdout y desactiva los prompts. Todo lo demás va a stderr."
        >
          <CodeBlock>{"hackspain --json team show\nhackspain --json feed -n 5"}</CodeBlock>
        </CommandCard>

        <CommandCard
          title="Códigos de salida"
          description="Los comandos que necesitan equipo, solicitud aceptada u onboarding completo fallan rápido con el siguiente paso a dar."
        >
          <div>
            {EXIT_CODES.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b border-hs-ink/15 py-2 last:border-b-0"
              >
                <code className="font-mono text-sm font-bold tabular-nums">
                  {row.code}
                </code>
                <p className="text-sm text-hs-brown">{row.meaning}</p>
              </div>
            ))}
          </div>
        </CommandCard>
      </div>
    </Page>
  );
}
