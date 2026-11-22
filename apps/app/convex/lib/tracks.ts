import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentEdition, currentEditionId, ofEdition } from "./editions";
import { submissionsAreOpenFor } from "./schedule";

const DEFAULT_TRACKS = [
  {
    body: "Construye «Digital Workers»: agentes de IA auditables que automatizan procesos completos en banca, seguros e industria. Cerró 25M$ liderados por Creandum y Forgepoint para atacar el 95% de proyectos de IA empresarial que fracasan.",
    label: "Maisa",
    note: "Agentes de IA con trazabilidad para la empresa",
    logoUrl: "/tracks/maisa.png",
    slug: "maisa",
    sortOrder: 0,
    website: "https://maisa.ai",
  },
  {
    body: "Agentes de IA que ejecutan operaciones completas por voz, email, chat y sistemas empresariales. Con más de 150 grandes clientes y un crecimiento de 5× desde su Serie B, levantó una Serie C de 150M$ que la valora en 1.200M$.",
    label: "HappyRobot",
    note: "El sistema operativo de IA de la economía real",
    logoUrl: "/tracks/happyrobot.png",
    slug: "happyrobot",
    sortOrder: 1,
    website: "https://www.happyrobot.ai",
  },
  {
    body: "Automatiza de punta a punta el recorrido del paciente en clínicas de EE. UU.: citas, verificación de seguros y facturación. Gestiona flujos de más de 150.000 médicos y levantó 30M$ liderados por a16z.",
    label: "Prosper AI",
    note: "IA para las operaciones sanitarias",
    logoUrl: "/tracks/prosper-ai.svg",
    slug: "prosper-ai",
    sortOrder: 2,
    website: "https://www.getprosper.ai",
  },
  {
    body: "Tesorería en tiempo real con IA para equipos financieros de medianas y grandes empresas. Automatiza hasta el 80% del trabajo manual, con 400 clientes en Europa y una Serie B de 30M€ liderada por Cathay Innovation.",
    label: "Embat",
    note: "El sistema operativo de la tesorería europea",
    logoUrl: "/tracks/embat.png",
    slug: "embat",
    sortOrder: 3,
    website: "https://www.embat.io",
  },
  {
    body: "Robots industriales reconfigurables, entrenados con IA para no especializarse en una sola tarea. Desde Barcelona, con la mayor Serie A de robótica de Europa: más de 100M$ liderados por CRV, con Samsung, LVMH e Inditex dentro.",
    label: "THEKER Robotics",
    note: "Robótica de propósito general made in Spain",
    logoUrl: "/tracks/theker.svg",
    slug: "theker",
    sortOrder: 4,
    website: "https://www.theker.ai",
  },
] as const;

const RETIRED_SLUGS = ["ml", "non-tech"] as const;
const THEKER_SLUG = "theker";

/** A project may enter one track, or THEKER together with one other track. */
export function isTrackCombinationAllowed(
  tracks: readonly { slug: string }[]
): boolean {
  return (
    tracks.length <= 1 ||
    (tracks.length === 2 &&
      tracks.filter((track) => track.slug === THEKER_SLUG).length === 1)
  );
}

/** Projects (team or solo, draft or submitted) one track takes. */
export const MAX_TEAMS_PER_TRACK = 15;

/** How many projects have entered each track. */
export async function trackEntryCounts(
  ctx: QueryCtx | MutationCtx,
  exceptSubmissionId?: Id<"submissions">
): Promise<Map<Id<"tracks">, number>> {
  const counts = new Map<Id<"tracks">, number>();
  const editionId = await currentEditionId(ctx);
  for (const submission of ofEdition(
    await ctx.db.query("submissions").collect(),
    editionId
  )) {
    if (submission._id === exceptSubmissionId) {
      continue;
    }
    for (const trackId of new Set(submission.challengeIds)) {
      counts.set(trackId, (counts.get(trackId) ?? 0) + 1);
    }
  }
  return counts;
}

export async function submissionsAreOpen(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const edition = await currentEdition(ctx);
  return submissionsAreOpenFor(edition, Date.now());
}

export type SeedMode = "replace" | "fill";

/**
 * Bring the catalog in line with DEFAULT_TRACKS. `replace` (admins and the
 * internal sync) rewrites copy, order and activity of every default. `fill`
 * (participants) only inserts the defaults that are missing, so edits made
 * through adminUpdate survive. Both retire the placeholder slugs and create the
 * settings singleton.
 */
export async function seedDefaults(
  ctx: MutationCtx,
  mode: SeedMode = "replace"
): Promise<void> {
  const editionId = await currentEditionId(ctx);
  for (const track of DEFAULT_TRACKS) {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_edition_slug", (q) =>
        q.eq("editionId", editionId).eq("slug", track.slug)
      )
      .unique();
    if (existing) {
      if (mode === "fill") {
        continue;
      }
      await ctx.db.patch(existing._id, {
        active: true,
        body: track.body,
        label: track.label,
        // Branding only fills in when missing, so an admin-set logo survives.
        logoUrl: existing.logoUrl ?? track.logoUrl,
        note: track.note,
        sortOrder: track.sortOrder,
        website: existing.website ?? track.website,
      });
      continue;
    }
    await ctx.db.insert("tracks", {
      active: true,
      body: track.body,
      editionId,
      label: track.label,
      logoUrl: track.logoUrl,
      note: track.note,
      slug: track.slug,
      sortOrder: track.sortOrder,
      website: track.website,
    });
  }

  for (const slug of RETIRED_SLUGS) {
    const leftover = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (leftover?.active) {
      await ctx.db.patch(leftover._id, { active: false });
    }
  }
}
