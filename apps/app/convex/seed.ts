import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import {
  canonicalTags,
  DEGREE_OPTIONS,
  INTEREST_OPTIONS,
  ROLE_OPTIONS,
  SKILL_OPTIONS,
  UNIVERSITY_OPTIONS,
} from "./lib/directoryOptions";
import { JUDGING_SETTINGS_KEY } from "./lib/judging";
import {
  isSponsorType,
  PARTICIPANT_SECTIONS,
  slugify,
  withSponsorCatalog,
} from "./lib/userTypes";
import type { Sections } from "./lib/userTypes";
import { seedDefaults as seedTracks } from "./tracks";

/**
 * Development seed: a believable hackathon in progress. Run it against the
 * dev deployment only, with SEED_ALLOWED=true set on that deployment:
 *
 *   pnpm --filter app exec convex run seed:run            # add the data
 *   pnpm --filter app exec convex run seed:run '{"reset":true}'  # wipe and re-add
 *   pnpm --filter app exec convex run seed:clear          # wipe only
 *   pnpm --filter app exec convex run seed:logos          # (re)generate team logos
 *
 * Team logos are real files in Convex storage: `run` schedules `logos`, an
 * action that downloads a generated picture per team and stores it.
 *
 * Every seeded person has an email under SEED_DOMAIN, and everything else the
 * seed creates hangs off those users (owner, author, createdBy), which is how
 * `clear` finds it again. It never touches rows it did not create, except for
 * the shared `settings` / `judgingSettings` singletons and the default tracks
 * and user types, which are idempotent upserts.
 *
 * With `ALLOW_EMAIL_OTP_STUB=true` on the deployment you can log in as any
 * seeded email with the code 00000000. Organiser: org@seed.hackspain.dev.
 *
 * Everyone has the name, photo and directory card the onboarding wizard
 * asks for, except the few accounts `run` lists as `incompleteProfiles`:
 * log in as one of those to see the wizard.
 */
export const SEED_DOMAIN = "seed.hackspain.dev";
const ORG_EMAIL = `org@${SEED_DOMAIN}`;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// ---------- deterministic randomness ----------

/** Park–Miller generator: exact in doubles, so no bitwise ops and stable across runs. */
function parkMiller(seed: number) {
  const modulus = 2_147_483_647;
  let state = seed % modulus || 1;
  return () => {
    state = (state * 48_271) % modulus;
    return state / modulus;
  };
}

const rand = parkMiller(2026);
const pick = <T>(list: readonly T[]): T => {
  const item = list[Math.floor(rand() * list.length)];
  if (item === undefined) {
    throw new Error("pick from empty list");
  }
  return item;
};
const chance = (p: number) => rand() < p;
const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const shuffle = <T>(list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
};

// ---------- data ----------

const FIRST_NAMES = [
  "Lucía", "Martín", "Sofía", "Hugo", "Paula", "Daniel", "Valeria", "Pablo",
  "Carla", "Alejandro", "Nora", "Adrián", "Julia", "Mario", "Aitana", "Diego",
  "Vera", "Iker", "Claudia", "Álvaro", "Irene", "Marc", "Alba", "Nil",
  "Elena", "Jorge", "Candela", "Bruno", "Marta", "Óscar", "Laia", "Rubén",
  "Ana", "Tomás", "Emma", "Ismael", "Olivia", "Sergio", "Gala", "Leo",
  "Inés", "Raúl", "Noa", "Andrés", "Chloe", "Víctor", "Ariadna", "Jan",
  "Miriam", "Guillem", "Rocío", "Pau", "Blanca", "Enzo", "Sara", "Joel",
];
const LAST_NAMES = [
  "García", "Martínez", "López", "Sánchez", "Pérez", "Gómez", "Fernández",
  "Ruiz", "Díaz", "Moreno", "Jiménez", "Romero", "Navarro", "Torres",
  "Domínguez", "Vázquez", "Serrano", "Molina", "Ortega", "Castro", "Rubio",
  "Puig", "Ferrer", "Roca", "Vidal", "Soler", "Bosch", "Iglesias", "Cano",
];
// Card values come from the curated vocabularies the form offers
// (convex/lib/directoryOptions.ts), so seeded people cluster like real ones.
const CITIES = [
  "Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Zaragoza",
  "Málaga", "Murcia", "A Coruña", "Granada", "Alicante", "Donostia / San Sebastián",
];
const DIETS = ["Ninguna", "Ninguna", "Ninguna", "Vegetariana", "Vegana", "Sin gluten", "Sin lactosa"];

const ROLES = ROLE_OPTIONS.filter((option) => option.value !== "Otro").map(
  (option) => option.value
);
const UNIVERSITIES = UNIVERSITY_OPTIONS.slice(0, 24).map((option) => option.value);
const COMPANIES = [
  "Nébula Labs", "Estudio Prisma", "Atlas Cloud", "Raíz Data", "Cabify",
  "Glovo", "Factorial", "Wallapop", "Idealista", "Freelance",
];
const DEGREES = [
  "Ingeniería Informática",
  ...DEGREE_OPTIONS.filter((option) => !["Otra", "Máster / Posgrado"].includes(option.value)).map(
    (option) => option.value
  ),
];
const SKILLS = SKILL_OPTIONS.map((option) => option.value);
const INTERESTS = INTEREST_OPTIONS.map((option) => option.value);

function directoryFor(city: string, stack: readonly string[]) {
  const student = chance(0.55);
  let company: string | undefined;
  let university: string | undefined;
  if (student) {
    university = pick(UNIVERSITIES);
    if (chance(0.3)) {
      company = pick(COMPANIES);
    }
  } else {
    company = pick(COMPANIES);
    if (chance(0.4)) {
      university = pick(UNIVERSITIES);
    }
  }
  return {
    bio: chance(0.7)
      ? pick([
          "Construye agentes que pasan del notebook a producción.",
          "Convierte ideas en interfaces rápidas y accesibles.",
          "Le gustan los sistemas que aguantan cuando falla el wifi.",
          "Primer hackathon, muchas ganas de aprender.",
          "Datos difíciles, decisiones claras.",
        ])
      : undefined,
    city,
    company,
    degree: chance(0.8) ? pick(DEGREES) : undefined,
    interests: shuffle(INTERESTS).slice(0, between(1, 4)),
    role: pick(ROLES),
    skills: shuffle(
      canonicalTags(SKILL_OPTIONS, [...stack, ...shuffle(SKILLS).slice(0, 3)])
    ).slice(0, between(2, 6)),
    university,
    updatedAt: Date.now(),
  };
}

const TEAM_NAMES = [
  "Churros & Code", "Los Deterministas", "Siesta Labs", "Paella Stack",
  "Tortilla Sin Cebolla", "404 Not Found", "Quantum Jamón", "La Terminal",
  "Bit Bailarines", "Vibe Compilers", "Café con Bugs", "Latent Space Cadets",
  "Garbanzo Neural", "Ctrl Alt Fiesta",
];

const PROJECTS: {
  name: string;
  description: string;
  tracks: string[];
  stack: string[];
  status: "submitted" | "draft";
}[] = [
  { name: "Ledgerito", description: "Agente de tesorería que concilia bancos y ERP en tiempo real y explica cada movimiento con trazabilidad.", tracks: ["embat", "maisa"], stack: ["Next.js", "TypeScript", "Convex", "OpenAI"], status: "submitted" },
  { name: "CitaBot", description: "Voz + WhatsApp para gestionar citas y verificación de seguros en clínicas pequeñas.", tracks: ["prosper-ai", "happyrobot"], stack: ["Python", "FastAPI", "Twilio", "PostgreSQL"], status: "submitted" },
  { name: "Brazo Amable", description: "Planificador de tareas para brazos reconfigurables entrenado con demostraciones en vídeo.", tracks: ["theker"], stack: ["Python", "PyTorch", "ROS 2", "Rust"], status: "submitted" },
  { name: "Auditoría Viva", description: "Digital worker que audita facturas de proveedores y deja un rastro verificable de cada decisión.", tracks: ["maisa"], stack: ["TypeScript", "Bun", "SQLite", "Anthropic"], status: "submitted" },
  { name: "Despacho", description: "Agente que atiende llamadas de transportistas y actualiza el TMS sin intervención humana.", tracks: ["happyrobot"], stack: ["Go", "gRPC", "Redis", "React"], status: "submitted" },
  { name: "Recetario Clínico", description: "Prescripción asistida con verificación de interacciones y facturación automática.", tracks: ["prosper-ai"], stack: ["Kotlin", "Spring", "PostgreSQL", "Vue"], status: "submitted" },
  { name: "Cashflow Lens", description: "Predicción de caja a 13 semanas con explicaciones en lenguaje natural para CFOs.", tracks: ["embat"], stack: ["Python", "Polars", "Streamlit", "DuckDB"], status: "submitted" },
  { name: "Ojo de Halcón", description: "Visión para detectar piezas mal colocadas en una célula robótica y replanificar al vuelo.", tracks: ["theker", "maisa"], stack: ["Python", "OpenCV", "YOLO", "Rust"], status: "submitted" },
  { name: "Nómada", description: "Copiloto de operaciones para pymes: email, chat y ERP en un solo agente auditable.", tracks: ["happyrobot", "maisa"], stack: ["TypeScript", "Next.js", "Supabase", "LangGraph"], status: "submitted" },
  { name: "Triage", description: "Prioriza urgencias por voz en primaria con un modelo pequeño que corre en el móvil.", tracks: ["prosper-ai"], stack: ["Swift", "CoreML", "Python"], status: "submitted" },
  { name: "Conciliador", description: "Match de cobros y facturas con LLM local y reglas explicables para cada excepción.", tracks: ["embat"], stack: ["Rust", "Axum", "SQLite", "Svelte"], status: "submitted" },
  { name: "Manos Libres", description: "Teleoperación asistida de robots industriales con corrección automática de trayectoria.", tracks: ["theker"], stack: ["C++", "ROS 2", "Python", "Three.js"], status: "submitted" },
  { name: "Portero", description: "Agente de recepción que gestiona visitas, paquetes y accesos por voz.", tracks: ["happyrobot"], stack: ["TypeScript", "Deno", "Elevenlabs"], status: "draft" },
  { name: "Sin nombre aún", description: "", tracks: [], stack: [], status: "draft" },
];

const MEME_TEXTS = [
  "Yo a las 4am explicándole al pato de goma por qué falla el deploy #meme",
  "\"Funciona en mi máquina\": pues enviamos tu máquina al jurado #meme",
  "Git blame dice que fui yo. Git blame miente. #meme",
  "Cuando el mentor pregunta por los tests #memes",
];

const POST_TEXTS = [
  "Primer commit hecho. Ahora sí, a construir 🚀",
  "Acabamos de conseguir que el agente llame al ERP sin romper nada. Pequeña victoria.",
  "¿Alguien tiene un cargador USB-C de sobra? Mesa 12.",
  "Demo interna funcionando. Queda pulir la UI y dormir un rato (mentira).",
  "El modelo pequeño tarda 400 ms en el móvil. Nos vale.",
  "Pivotamos: menos features, más trazabilidad. Los mentores tenían razón.",
  "Café número cinco. El bug del websocket sigue ahí.",
  "Hemos pasado el primer test end-to-end. Pipeline verde por primera vez.",
  "Si alguien sabe de ROS 2 y quiere echar una mano 10 minutos, estamos en la zona azul.",
  "Vídeo grabado. Ahora a subir el proyecto antes de que cierre la ventana.",
  "Gracias al equipo de Embat por la sesión de tesorería, nos ha desbloqueado.",
  "La API de citas ya devuelve slots reales. Toca la verificación de seguros.",
  "Refactor a mitad de hackathon: mala idea, pero ya está hecho.",
  "Dormir es para después del pitch.",
  "¿Alguien más tiene problemas con el wifi del ala norte?",
  "Cerrado el flujo completo: llamada → agente → ticket → ERP. Sin manos.",
  "Nuestro primer usuario de prueba ha dicho «ah, pues mola». Objetivo cumplido.",
  "Hemos cambiado de LLM tres veces. Nos quedamos con el que explica mejor.",
  "Demo a las 18:00 en la sala de mentores, venid si queréis romperla.",
  "Modo hackathon: los tests los escribe el agente y nosotros los leemos.",
];

const GITHUB_EVENTS: { event: string; text: (repo: string) => string }[] = [
  { event: "push", text: (repo) => `Push a main en ${repo}: 3 commits` },
  { event: "push", text: (repo) => `Push a feat/agent en ${repo}: 1 commit` },
  { event: "pull_request", text: (repo) => `PR abierta en ${repo}: «Add ERP connector»` },
  { event: "pull_request", text: (repo) => `PR fusionada en ${repo}: «Fix websocket reconnect»` },
  { event: "push", text: (repo) => `Push a main en ${repo}: 7 commits` },
  { event: "create", text: (repo) => `Nueva rama demo-video en ${repo}` },
  { event: "issues", text: (repo) => `Issue abierta en ${repo}: «Latency spikes on mobile»` },
];

const PERKS: {
  company: string;
  title: string;
  value: string;
  description: string;
  type: "email" | "code" | "external";
  sponsorUrl?: string;
  instructions?: string;
  codes?: number;
}[] = [
  { company: "Vercel", title: "Pro durante 3 meses", value: "60 $", description: "Despliega tu demo con Pro y previews ilimitadas.", type: "code", sponsorUrl: "https://vercel.com", codes: 20 },
  { company: "Convex", title: "Créditos de backend", value: "100 $", description: "Base de datos reactiva para tu proyecto.", type: "code", sponsorUrl: "https://convex.dev", codes: 20 },
  { company: "Anthropic", title: "Créditos de API", value: "150 $", description: "Claude para tu agente. Solicítalo con el email del equipo.", type: "email", sponsorUrl: "https://anthropic.com" },
  { company: "OpenAI", title: "Créditos de API", value: "100 $", description: "Para inferencia y embeddings durante el evento.", type: "email" },
  { company: "GitHub", title: "Copilot Pro", value: "3 meses", description: "Copilot en tu editor mientras dure el hackathon y después.", type: "code", codes: 40 },
  { company: "Supabase", title: "Pro un mes", value: "25 $", description: "Postgres, auth y storage sin límites de prueba.", type: "code", codes: 15 },
  { company: "Twilio", title: "Saldo para SMS y voz", value: "50 $", description: "Para los agentes que llaman por teléfono.", type: "email" },
  { company: "ElevenLabs", title: "Plan Creator", value: "1 mes", description: "Voces para tu demo.", type: "code", codes: 10 },
  {
    company: "Cursor",
    title: "Pro para el hackathon",
    value: "2 meses",
    description: "El editor con agentes. Se activa en su web, no desde la app.",
    type: "external",
    sponsorUrl: "https://cursor.com",
    instructions: "Entra con el email del equipo, abre Billing y aplica el plan Pro del evento.",
  },
];

const USER_TYPES: {
  label: string;
  description: string;
  sections: Sections;
  isDefault: boolean;
}[] = [
  { label: "Hacker", description: "Participa en la hackathon.", sections: PARTICIPANT_SECTIONS, isDefault: true },
  { label: "Jurado", description: "Puntúa proyectos en el panel del jurado.", sections: ["judging"], isDefault: false },
  { label: "Mentor", description: "Acompaña a los equipos durante el evento.", sections: ["tracks", "cli"], isDefault: false },
  { label: "Sponsor", description: "Partner del evento: retos, perks y entregas.", sections: ["tracks", "perks", "participantes", "judgingSponsors"], isDefault: false },
];

// ---------- helpers ----------

type Person = {
  first: string;
  last: string;
  email: string;
  github: string;
};

function makePeople(count: number): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  while (people.length < count) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const handle = slugify(`${first} ${last}`).replaceAll("-", "");
    if (seen.has(handle)) {
      continue;
    }
    seen.add(handle);
    people.push({
      first,
      last,
      email: `${slugify(`${first}.${last}`).replaceAll("-", ".")}@${SEED_DOMAIN}`,
      github: handle,
    });
  }
  return people;
}

function avatarFor(handle: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(handle)}`;
}

function phoneFor(index: number): string {
  return `+346${String(10_000_000 + index * 7919).slice(0, 8)}`;
}

async function upsertUserType(
  ctx: MutationCtx,
  adminId: Id<"users">,
  spec: (typeof USER_TYPES)[number],
  sortOrder: number
): Promise<Id<"userTypes">> {
  // Reuse a type with the same name, or one that opens exactly the same
  // tabs (a hand-made "Juez" counts as our "Jurado").
  const slug = slugify(spec.label);
  const all = await ctx.db.query("userTypes").withIndex("by_sort").collect();
  const wanted = [...spec.sections].toSorted().join(",");
  const existing =
    all.find((row) => row.slug === slug) ??
    all.find((row) => [...row.sections].toSorted().join(",") === wanted);
  if (existing) {
    if (isSponsorType(existing)) {
      const next = withSponsorCatalog(existing.sections);
      if (next.join(",") !== existing.sections.join(",")) {
        await ctx.db.patch(existing._id, {
          sections: next,
          updatedAt: Date.now(),
        });
      }
    }
    return existing._id;
  }
  const now = Date.now();
  return await ctx.db.insert("userTypes", {
    createdAt: now,
    createdBy: adminId,
    description: spec.description,
    isDefault: spec.isDefault && !all.some((row) => row.isDefault),
    label: spec.label,
    sections: spec.sections,
    slug,
    sortOrder: Math.max(sortOrder, (all.at(-1)?.sortOrder ?? -1) + 1),
    updatedAt: now,
  });
}

/**
 * Name, photo and directory card are what the onboarding wizard demands of
 * every account (convex/lib/profile.ts), so seeded people have all three
 * unless a loop asks for a gap to exercise the wizard with.
 */
type SeedProfile = "complete" | "noDirectory" | "noPhoto";

async function insertUser(
  ctx: MutationCtx,
  person: Person,
  opts: {
    role: "admin" | "user";
    signupId?: Id<"signups">;
    onboarded: boolean;
    userTypeId?: Id<"userTypes">;
    index: number;
    profile?: SeedProfile;
  }
): Promise<Id<"users">> {
  const name = `${person.first} ${person.last}`;
  const travelOrigin = opts.onboarded ? pick(CITIES) : undefined;
  const profile = opts.profile ?? "complete";
  return await ctx.db.insert("users", {
    attendanceStatus: "attending",
    dietaryRestrictions: opts.onboarded ? pick(DIETS) : undefined,
    directory:
      profile === "noDirectory"
        ? undefined
        : directoryFor(travelOrigin ?? pick(CITIES), []),
    email: person.email,
    emailVerificationTime: Date.now() - between(1, 30) * 24 * HOUR,
    githubLinkedAt: chance(0.8) ? Date.now() - between(1, 20) * 24 * HOUR : undefined,
    githubUsername: person.github,
    image: profile === "noPhoto" ? undefined : avatarFor(person.github),
    name,
    notificationConsent: chance(0.85),
    onboardingComplete: opts.onboarded,
    phone: opts.onboarded ? phoneFor(opts.index) : undefined,
    role: opts.role,
    signupId: opts.signupId,
    termsAcceptedAt: opts.onboarded ? Date.now() - between(1, 10) * 24 * HOUR : undefined,
    travelOrigin,
    userTypeId: opts.userTypeId,
  });
}

async function insertSignup(
  ctx: MutationCtx,
  person: Person,
  accepted: boolean
): Promise<Id<"signups">> {
  return await ctx.db.insert("signups", {
    accepted,
    achievements: chance(0.5)
      ? pick([
          "Gané el hackathon de mi universidad en 2025.",
          "Mantengo una librería open source con 2k estrellas.",
          "Trabajo en una startup de IA desde hace un año.",
          "Primer hackathon, muchas ganas.",
        ])
      : undefined,
    createdAt: Date.now() - between(20, 60) * 24 * HOUR,
    email: person.email,
    freeTime: chance(0.5) ? pick(["Escalada", "Ajedrez", "Cocina", "Fotografía", "Ciclismo"]) : undefined,
    fullName: `${person.first} ${person.last}`,
    githubUsername: person.github,
    urls: [
      { kind: "github", url: `https://github.com/${person.github}` },
      ...(chance(0.6) ? [{ kind: "linkedin" as const, url: `https://linkedin.com/in/${person.github}` }] : []),
      ...(chance(0.3) ? [{ kind: "x" as const, url: `https://x.com/${person.github}` }] : []),
    ],
    wantsAmbassador: chance(0.1),
  });
}

function joinCodeFor(index: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = 48_271 * (index + 11);
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / 7) + 13 * (i + 1);
  }
  return code;
}

// ---------- clear ----------

async function seededUserIds(ctx: QueryCtx | MutationCtx): Promise<Set<Id<"users">>> {
  const users = await ctx.db.query("users").collect();
  return new Set(
    users
      .filter((user) => user.email?.endsWith(`@${SEED_DOMAIN}`))
      .map((user) => user._id)
  );
}

async function clearSeed(ctx: MutationCtx): Promise<Record<string, number>> {
  const userIds = await seededUserIds(ctx);
  const deleted: Record<string, number> = {};
  const del = async (table: string, id: Id<TableNames>) => {
    await ctx.db.delete(id);
    deleted[table] = (deleted[table] ?? 0) + 1;
  };

  const teams = (await ctx.db.query("teams").collect()).filter((team) =>
    userIds.has(team.ownerId)
  );
  const teamIds = new Set(teams.map((team) => team._id));

  for (const row of await ctx.db.query("posts").collect()) {
    if ((row.authorId && userIds.has(row.authorId)) || (row.teamId && teamIds.has(row.teamId))) {
      if (row.imageId) {
        await ctx.storage.delete(row.imageId);
      }
      await del("posts", row._id);
    }
  }
  for (const row of await ctx.db.query("milestones").collect()) {
    if (teamIds.has(row.teamId) || userIds.has(row.userId)) {
      await del("milestones", row._id);
    }
  }
  for (const row of await ctx.db.query("judgingScores").collect()) {
    if (userIds.has(row.judgeId)) {
      await del("judgingScores", row._id);
    }
  }
  for (const row of await ctx.db.query("judgingAssignments").collect()) {
    if (userIds.has(row.userId)) {
      await del("judgingAssignments", row._id);
    }
  }
  for (const row of await ctx.db.query("submissions").collect()) {
    if (userIds.has(row.submittedBy) || (row.teamId && teamIds.has(row.teamId))) {
      for (const score of await ctx.db
        .query("judgingScores")
        .withIndex("by_submission_context", (q) => q.eq("submissionId", row._id))
        .collect()) {
        await del("judgingScores", score._id);
      }
      await del("submissions", row._id);
    }
  }
  for (const row of await ctx.db.query("teamMembers").collect()) {
    if (teamIds.has(row.teamId) || (row.userId && userIds.has(row.userId))) {
      await del("teamMembers", row._id);
    }
  }
  for (const team of teams) {
    if (team.logoId) {
      await ctx.storage.delete(team.logoId);
    }
    await del("teams", team._id);
  }
  const perks = (await ctx.db.query("perks").collect()).filter((perk) =>
    userIds.has(perk.createdBy)
  );
  const perkIds = new Set(perks.map((perk) => perk._id));
  for (const row of await ctx.db.query("perkClaims").collect()) {
    if (perkIds.has(row.perkId) || userIds.has(row.userId)) {
      await del("perkClaims", row._id);
    }
  }
  for (const row of await ctx.db.query("perkCodes").collect()) {
    if (perkIds.has(row.perkId)) {
      await del("perkCodes", row._id);
    }
  }
  for (const perk of perks) {
    await del("perks", perk._id);
  }
  for (const row of await ctx.db.query("notifications").collect()) {
    if (userIds.has(row.sentBy)) {
      await del("notifications", row._id);
    }
  }
  for (const row of await ctx.db.query("tvMessages").collect()) {
    if (userIds.has(row.createdBy)) {
      await del("tvMessages", row._id);
    }
  }
  for (const row of await ctx.db.query("signups").collect()) {
    if (row.email.endsWith(`@${SEED_DOMAIN}`)) {
      await del("signups", row._id);
    }
  }
  for (const type of await ctx.db.query("userTypes").collect()) {
    if (!userIds.has(type.createdBy)) {
      continue;
    }
    for (const user of await ctx.db
      .query("users")
      .withIndex("by_user_type", (q) => q.eq("userTypeId", type._id))
      .collect()) {
      await ctx.db.patch(user._id, { userTypeId: undefined });
    }
    await del("userTypes", type._id);
  }
  for (const userId of userIds) {
    // Convex Auth rows from logging in as a seeded account: left behind, they
    // point at a deleted user and the next login fails with "Usuario no encontrado".
    for (const account of await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect()) {
      for (const code of await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect()) {
        await del("authVerificationCodes", code._id);
      }
      await del("authAccounts", account._id);
    }
    for (const session of await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()) {
      for (const token of await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect()) {
        await del("authRefreshTokens", token._id);
      }
      await del("authSessions", session._id);
    }
    const user = await ctx.db.get(userId);
    if (user?.avatarId) {
      await ctx.storage.delete(user.avatarId);
    }
    await del("users", userId);
  }
  // Orphans from before this cleanup existed (auth rows whose user is gone).
  for (const account of await ctx.db.query("authAccounts").collect()) {
    if ((await ctx.db.get(account.userId)) === null) {
      await del("authAccounts", account._id);
    }
  }
  for (const session of await ctx.db.query("authSessions").collect()) {
    if ((await ctx.db.get(session.userId)) === null) {
      await del("authSessions", session._id);
    }
  }
  return deleted;
}

// ---------- seed ----------

async function runSeed(
  ctx: MutationCtx
): Promise<{ created: Record<string, number>; incompleteProfiles: string[] }> {
  const now = Date.now();
  const created: Record<string, number> = {};
  const count = (table: string, n = 1) => {
    created[table] = (created[table] ?? 0) + n;
  };
  // Accounts left with a gap on purpose, to walk through the onboarding wizard.
  const incompleteProfiles: string[] = [];
  const gap = (person: Person, profile: SeedProfile | undefined) => {
    if (profile && profile !== "complete") {
      incompleteProfiles.push(`${person.email} (${profile})`);
    }
    return profile;
  };

  // Organiser (admin) who "creates" the shared config.
  const orgId = await ctx.db.insert("users", {
    attendanceStatus: "attending",
    email: ORG_EMAIL,
    emailVerificationTime: now,
    image: avatarFor("hackspain-org"),
    name: "Organización HackSpain",
    notificationConsent: true,
    onboardingComplete: true,
    role: "admin",
  });
  count("users");

  // Shared config: tracks, user types, submission window, judging groups.
  await seedTracks(ctx);
  const tracks = await ctx.db
    .query("tracks")
    .withIndex("by_active_and_sort", (q) => q.eq("active", true))
    .collect();
  const trackBySlug = new Map(tracks.map((track) => [track.slug, track]));

  const typeIds = new Map<string, Id<"userTypes">>();
  for (const [index, spec] of USER_TYPES.entries()) {
    typeIds.set(spec.label, await upsertUserType(ctx, orgId, spec, index));
  }
  const hackerType = typeIds.get("Hacker");
  const juradoType = typeIds.get("Jurado");
  const mentorType = typeIds.get("Mentor");
  const sponsorType = typeIds.get("Sponsor");

  const settings = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "hackathon"))
    .unique();
  if (settings) {
    await ctx.db.patch(settings._id, { submissionsOpen: true });
  } else {
    await ctx.db.insert("settings", { key: "hackathon", submissionsOpen: true });
  }
  const judgingSettings = await ctx.db
    .query("judgingSettings")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
    .unique();
  if (judgingSettings) {
    await ctx.db.patch(judgingSettings._id, { generalGroupCount: 3, updatedAt: now });
  } else {
    await ctx.db.insert("judgingSettings", {
      generalGroupCount: 3,
      key: JUDGING_SETTINGS_KEY,
      updatedAt: now,
    });
  }

  // People: 48 onboarded hackers, 6 accepted but not onboarded, 4 accepted
  // without an account, 3 pending; 4 judges, 3 mentors, 2 sponsors.
  const people = makePeople(70);
  let cursor = 0;
  const take = (n: number) => people.slice(cursor, (cursor += n));

  // Two onboarded hackers without a card, one without a photo.
  const hackerGaps: SeedProfile[] = ["noDirectory", "noDirectory", "noPhoto"];
  const hackers: { person: Person; userId: Id<"users"> }[] = [];
  for (const [index, person] of take(48).entries()) {
    const signupId = await insertSignup(ctx, person, true);
    const userId = await insertUser(ctx, person, {
      index,
      onboarded: true,
      profile: gap(person, hackerGaps[index]),
      role: "user",
      signupId,
      userTypeId: chance(0.5) ? hackerType : undefined,
    });
    hackers.push({ person, userId });
    count("signups");
    count("users");
  }
  for (const [index, person] of take(6).entries()) {
    const signupId = await insertSignup(ctx, person, true);
    await insertUser(ctx, person, {
      index: 100 + index,
      onboarded: false,
      // One walks the whole wizard: phone and terms, then the card.
      profile: gap(person, index === 0 ? "noDirectory" : undefined),
      role: "user",
      signupId,
    });
    count("signups");
    count("users");
  }
  for (const person of take(4)) {
    await insertSignup(ctx, person, true);
    count("signups");
  }
  for (const person of take(3)) {
    await insertSignup(ctx, person, false);
    count("signups");
  }
  const judges: Id<"users">[] = [];
  for (const [index, person] of take(4).entries()) {
    judges.push(
      await insertUser(ctx, person, {
        index: 200 + index,
        onboarded: false,
        // A judge without a signup: the wizard with no phone step.
        profile: gap(person, index === 0 ? "noDirectory" : undefined),
        role: "user",
        userTypeId: juradoType,
      })
    );
    count("users");
  }
  for (const [index, person] of take(3).entries()) {
    await insertUser(ctx, person, {
      index: 300 + index,
      onboarded: false,
      role: "user",
      userTypeId: mentorType,
    });
    count("users");
  }
  for (const [index, person] of take(2).entries()) {
    await insertUser(ctx, person, {
      index: 400 + index,
      onboarded: false,
      role: "user",
      userTypeId: sponsorType,
    });
    count("users");
  }

  // Perks with code pools.
  const perkIds: Id<"perks">[] = [];
  for (const spec of PERKS) {
    const perkId = await ctx.db.insert("perks", {
      active: true,
      company: spec.company,
      createdAt: now - 14 * 24 * HOUR,
      createdBy: orgId,
      description: spec.description,
      instructions: spec.instructions,
      inputs:
        spec.type === "email"
          ? [
              { key: "email", label: "Email de la cuenta", required: true, type: "email" },
              { key: "team", label: "Equipo", required: false, type: "text" },
            ]
          : undefined,
      sponsorUrl: spec.sponsorUrl,
      title: spec.title,
      type: spec.type,
      updatedAt: now - 14 * 24 * HOUR,
      value: spec.value,
    });
    perkIds.push(perkId);
    count("perks");
    for (let i = 0; i < (spec.codes ?? 0); i += 1) {
      await ctx.db.insert("perkCodes", {
        available: true,
        code: `${spec.company.toUpperCase().slice(0, 4)}-${String(1000 + i * 37).slice(-4)}-${joinCodeFor(i + perkIds.length * 50).slice(0, 4)}`,
        perkId,
      });
      count("perkCodes");
    }
  }

  // Teams of 2–4 hackers (three solo), each with a repo.
  const pool = shuffle(hackers);
  let poolCursor = 0;
  const teams: { id: Id<"teams">; name: string; repo: string; members: Id<"users">[] }[] = [];
  for (const [index, name] of TEAM_NAMES.entries()) {
    const size = index < 3 ? 1 : between(2, 4);
    const members = pool.slice(poolCursor, poolCursor + size);
    poolCursor += size;
    const owner = members[0];
    if (!owner) {
      break;
    }
    const slug = slugify(name);
    const repo = `hackspain-seed/${slug}`;
    const createdAt = now - between(20, 34) * HOUR;
    const project = PROJECTS[index];
    const teamId = await ctx.db.insert("teams", {
      createdAt,
      joinCode: joinCodeFor(index),
      name,
      ownerId: owner.userId,
      repoUrl: `https://github.com/${repo}`,
      techStack: project?.stack,
      techStackAt: project && project.stack.length > 0 ? now - between(1, 12) * HOUR : undefined,
      techStackSource: project && project.stack.length > 0 ? "repo" : undefined,
      updatedAt: createdAt,
    });
    count("teams");
    for (const member of members) {
      await ctx.db.insert("teamMembers", {
        addedBy: owner.userId,
        createdAt: createdAt + between(0, 60) * MINUTE,
        identifier: member.person.email,
        identifierType: "email",
        signupId: undefined,
        status: "member",
        teamId,
        userId: member.userId,
      });
      count("teamMembers");
    }
    // One pending invite for a few teams.
    if (chance(0.3)) {
      const invitee = pool[poolCursor + between(0, 3)];
      if (invitee) {
        await ctx.db.insert("teamMembers", {
          addedBy: owner.userId,
          createdAt: createdAt + 90 * MINUTE,
          identifier: `${invitee.person.github}-friend`,
          identifierType: "github",
          status: "pending",
          teamId,
        });
        count("teamMembers");
      }
    }
    teams.push({ id: teamId, members: members.map((m) => m.userId), name, repo });
  }

  // Projects: one per team, most submitted, spread over 3 general groups.
  const submissions: { id: Id<"submissions">; trackIds: Id<"tracks">[]; group?: number }[] = [];
  let group = 0;
  for (const [index, team] of teams.entries()) {
    const project = PROJECTS[index];
    const owner = team.members[0];
    if (!project || !owner) {
      continue;
    }
    const trackIds = project.tracks
      .map((slug) => trackBySlug.get(slug)?._id)
      .filter((id): id is Id<"tracks"> => id !== undefined);
    const submitted = project.status === "submitted";
    const generalGroup = submitted ? (group++ % 3) + 1 : undefined;
    const createdAt = now - between(6, 20) * HOUR;
    const submissionId = await ctx.db.insert("submissions", {
      challengeIds: trackIds,
      createdAt,
      description: project.description,
      generalGroup,
      name: project.name,
      perkIds: shuffle(perkIds).slice(0, between(0, 3)),
      status: project.status,
      submittedAt: submitted ? now - between(1, 5) * HOUR : undefined,
      submittedBy: owner,
      teamId: team.id,
      techStack: project.stack,
      techStackAt: project.stack.length > 0 ? now - between(1, 12) * HOUR : undefined,
      techStackSource: project.stack.length > 0 ? "repo" : undefined,
      updatedAt: now - between(0, 3) * HOUR,
      urls: [
        { kind: "repo", url: `https://github.com/${team.repo}` },
        ...(submitted ? [{ kind: "demo" as const, url: `https://${slugify(project.name)}.vercel.app` }] : []),
        ...(submitted && chance(0.7)
          ? [{ kind: "video" as const, url: `https://www.youtube.com/watch?v=seed${index}` }]
          : []),
      ],
    });
    submissions.push({ group: generalGroup, id: submissionId, trackIds });
    count("submissions");
  }

  // Judging: each judge covers one general group and one track; scores for
  // roughly half of what they can see.
  const trackList = tracks.map((track) => track._id);
  for (const [index, judgeId] of judges.entries()) {
    const generalGroup = (index % 3) + 1;
    await ctx.db.insert("judgingAssignments", {
      contextKey: String(generalGroup),
      contextKind: "general",
      createdAt: now - 2 * HOUR,
      group: generalGroup,
      userId: judgeId,
    });
    count("judgingAssignments");
    const trackId = trackList[index % trackList.length];
    if (trackId) {
      await ctx.db.insert("judgingAssignments", {
        contextKey: trackId,
        contextKind: "track",
        createdAt: now - 2 * HOUR,
        userId: judgeId,
      });
      count("judgingAssignments");
    }
    for (const submission of submissions) {
      if (submission.group === generalGroup && chance(0.6)) {
        await ctx.db.insert("judgingScores", {
          contextKey: String(generalGroup),
          contextKind: "general",
          createdAt: now - between(5, 90) * MINUTE,
          judgeId,
          score: between(4, 10),
          submissionId: submission.id,
          updatedAt: now - between(0, 5) * MINUTE,
        });
        count("judgingScores");
      }
      if (trackId && submission.trackIds.includes(trackId) && chance(0.5)) {
        await ctx.db.insert("judgingScores", {
          contextKey: trackId,
          contextKind: "track",
          createdAt: now - between(5, 90) * MINUTE,
          judgeId,
          score: between(5, 10),
          submissionId: submission.id,
          updatedAt: now - between(0, 5) * MINUTE,
        });
        count("judgingScores");
      }
    }
  }

  // Milestones.
  for (const team of teams) {
    const owner = team.members[0];
    if (!owner) {
      continue;
    }
    const kinds: ("firstCommit" | "firstBuild" | "firstDemo")[] = ["firstCommit"];
    if (chance(0.8)) {
      kinds.push("firstBuild");
    }
    if (chance(0.5)) {
      kinds.push("firstDemo");
    }
    let at = now - between(18, 30) * HOUR;
    for (const kind of kinds) {
      await ctx.db.insert("milestones", { at, createdAt: at, kind, teamId: team.id, userId: owner });
      count("milestones");
      at += between(2, 6) * HOUR;
    }
  }

  // Feed: ~120 participant posts and GitHub events over the last 30 hours.
  const postCount = 120;
  for (let i = 0; i < postCount; i += 1) {
    const createdAt = now - Math.floor(rand() * rand() * 30 * HOUR) - between(0, 5) * MINUTE;
    const team = pick(teams);
    if (chance(0.35)) {
      const event = pick(GITHUB_EVENTS);
      const actor = pick(hackers).person.github;
      await ctx.db.insert("posts", {
        createdAt,
        externalId: `seed:${i}`,
        github: {
          actor,
          event: event.event,
          repo: team.repo,
          url: `https://github.com/${team.repo}`,
        },
        kind: "github",
        teamId: team.id,
        text: event.text(team.repo),
      });
    } else {
      const authorId = pick(team.members);
      await ctx.db.insert("posts", {
        authorId,
        createdAt,
        kind: "post",
        teamId: team.id,
        ...(chance(0.15)
          ? { meme: true, text: pick(MEME_TEXTS) }
          : { text: pick(POST_TEXTS) }),
      });
    }
    count("posts");
  }

  // Perk claims for about twenty hackers.
  for (const hacker of shuffle(hackers).slice(0, 20)) {
    const perkIndex = between(0, PERKS.length - 1);
    const perkId = perkIds[perkIndex];
    const spec = PERKS[perkIndex];
    if (!perkId || !spec) {
      continue;
    }
    const at = now - between(1, 20) * HOUR;
    switch (spec.type) {
      case "external": {
        continue;
      }
      case "code": {
        const code = await ctx.db
          .query("perkCodes")
          .withIndex("by_perk_available", (q) => q.eq("perkId", perkId).eq("available", true))
          .first();
        if (!code) {
          continue;
        }
        await ctx.db.patch(code._id, { assignedAt: at, assignedTo: hacker.userId, available: false });
        await ctx.db.insert("perkClaims", {
          codeId: code._id,
          createdAt: at,
          perkId,
          status: "assigned",
          type: "code",
          updatedAt: at,
          userId: hacker.userId,
        });
        break;
      }
      case "email": {
        await ctx.db.insert("perkClaims", {
          answers: [
            { key: "email", value: hacker.person.email },
            { key: "team", value: pick(teams).name },
          ],
          createdAt: at,
          perkId,
          status: pick(["pending", "pending", "added", "rejected"]),
          type: "email",
          updatedAt: at,
          userId: hacker.userId,
        });
        break;
      }
      default: {
        const _exhaustive: never = spec.type;
        throw new Error(_exhaustive);
      }
    }
    count("perkClaims");
  }

  // Organiser broadcasts and venue screen messages.
  const broadcasts = [
    { subject: "¡Arrancamos!", body: "Bienvenidos a HackSpain 2026. Wifi: HackSpain / clave en la pantalla principal.", hoursAgo: 28 },
    { subject: "Cena a las 21:00", body: "Opciones vegetarianas y sin gluten en la barra de la derecha.", hoursAgo: 9 },
    { subject: "Envíos abiertos", body: "Ya podéis enviar el proyecto desde Retos. Cierra a las 14:00.", hoursAgo: 3 },
  ];
  for (const broadcast of broadcasts) {
    await ctx.db.insert("notifications", {
      audience: "attending",
      body: broadcast.body,
      failures: [],
      recipientCount: hackers.length,
      sentAt: now - broadcast.hoursAgo * HOUR,
      sentBy: orgId,
      sentCount: hackers.length,
      status: "sent",
      subject: broadcast.subject,
    });
    count("notifications");
  }
  const tvMessages: { text: string; zone: "banner" | "left" | "right" | "ticker" }[] = [
    { text: "HackSpain 2026 · Madrid", zone: "banner" },
    { text: "Envíos abiertos hasta las 14:00", zone: "ticker" },
    { text: "Wifi: HackSpain · clave: construir2026", zone: "ticker" },
    { text: "Mentores en la sala azul de 16:00 a 19:00", zone: "left" },
  ];
  for (const [order, message] of tvMessages.entries()) {
    await ctx.db.insert("tvMessages", {
      active: true,
      createdAt: now - 20 * HOUR,
      createdBy: orgId,
      order,
      text: message.text,
      updatedAt: now - 20 * HOUR,
      zone: message.zone,
    });
    count("tvMessages");
  }

  return { created, incompleteProfiles };
}

function assertNotProduction(): void {
  if (process.env.SEED_ALLOWED !== "true") {
    throw new Error("Seeding requires SEED_ALLOWED=true on this deployment");
  }
}

export const run = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertNotProduction();
    const cleared = args.reset ? await clearSeed(ctx) : {};
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ORG_EMAIL))
      .unique();
    if (existing) {
      throw new Error(
        "The seed is already loaded. Run seed:run with {\"reset\":true} to reload it, or seed:clear to remove it."
      );
    }
    const { created, incompleteProfiles } = await runSeed(ctx);
    await ctx.scheduler.runAfter(0, internal.seed.logos, {});
    return { cleared, created, incompleteProfiles };
  },
  returns: v.object({
    cleared: v.record(v.string(), v.number()),
    created: v.record(v.string(), v.number()),
    /** Seeded logins that still owe the onboarding wizard a step. */
    incompleteProfiles: v.array(v.string()),
  }),
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertNotProduction();
    return await clearSeed(ctx);
  },
  returns: v.record(v.string(), v.number()),
});

// ---------- team logos (storage needs an action) ----------

/** Seeded teams without a logo yet, or all of them when `force` is set. */
export const teamsForLogos = internalQuery({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userIds = await seededUserIds(ctx);
    const teams = await ctx.db.query("teams").collect();
    return teams
      .filter((team) => userIds.has(team.ownerId))
      .filter((team) => args.force === true || team.logoId === undefined)
      .map((team) => ({ _id: team._id, name: team.name }));
  },
  returns: v.array(v.object({ _id: v.id("teams"), name: v.string() })),
});

export const attachLogo = internalMutation({
  args: { logoId: v.id("_storage"), teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      await ctx.storage.delete(args.logoId);
      return null;
    }
    const previous = team.logoId;
    await ctx.db.patch(team._id, { logoId: args.logoId, updatedAt: Date.now() });
    if (previous && previous !== args.logoId) {
      await ctx.storage.delete(previous);
    }
    return null;
  },
  returns: v.null(),
});

/**
 * Downloads a generated PNG per seeded team (DiceBear "shapes", keyed by the
 * team name so it is stable) and stores it as the team logo. Runs after
 * `seed:run`; call it by hand with `{"force":true}` to regenerate.
 */
export const logos = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertNotProduction();
    const teams = await ctx.runQuery(internal.seed.teamsForLogos, {
      force: args.force,
    });
    let stored = 0;
    const failed: string[] = [];
    for (const team of teams) {
      const url = `https://api.dicebear.com/9.x/shapes/png?size=256&seed=${encodeURIComponent(team.name)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          failed.push(`${team.name}: ${response.status}`);
          continue;
        }
        const blob = await response.blob();
        const logoId = await ctx.storage.store(
          new Blob([await blob.arrayBuffer()], { type: "image/png" })
        );
        await ctx.runMutation(internal.seed.attachLogo, { logoId, teamId: team._id });
        stored += 1;
      } catch (caughtError: unknown) {
        failed.push(
          `${team.name}: ${caughtError instanceof Error ? caughtError.message : "error"}`
        );
      }
    }
    return { failed, stored };
  },
  returns: v.object({ failed: v.array(v.string()), stored: v.number() }),
});
