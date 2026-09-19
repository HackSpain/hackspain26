/**
 * Writes the logos the TV puts next to each technology and AI tool:
 * public/tv-icons/tech/<slug>.svg from simple-icons (CC0) for every catalog
 * technology and language it knows, public/tv-icons/harness/* copied from the
 * landing, and src/lib/tv-icons.ts mapping names to those files. Static files
 * rather than imports, so a screen downloads the dozen it shows and not 280.
 *
 * Run `pnpm icons:tv` after adding technologies to convex/lib/stackCatalog.ts,
 * harnesses to the watcher, or after upgrading simple-icons.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as simpleIcons from "simple-icons";
import { LANGUAGE_ORDER, PRODUCT_FROM_EXT } from "../convex/lib/stack";
import { CATALOG } from "../convex/lib/stackCatalog";

const APP = join(import.meta.dirname, "..");
const OUT = join(APP, "public/tv-icons");
const LANDING = join(APP, "../web/public/harnesses");

/**
 * Catalog names simple-icons files under another title. Only a project's own
 * mark or the product it is part of: a Go library does not get the gopher.
 */
const TECH_ALIASES: Record<string, string> = {
  ".NET MAUI": "dotnet",
  "AI SDK": "vercel",
  Airflow: "apacheairflow",
  Apollo: "apollographql",
  "ASP.NET": "dotnet",
  Avalonia: "avaloniaui",
  "C#": "dotnet",
  "Claude Agent SDK": "claude",
  Diffusers: "huggingface",
  "Django REST Framework": "django",
  Ecto: "elixir",
  "EF Core": "dotnet",
  "ethers.js": "ethers",
  Exposed: "jetbrains",
  "F#": "fsharp",
  Gemini: "googlegemini",
  "GitHub API": "github",
  Godot: "godotengine",
  "Google APIs": "google",
  Java: "openjdk",
  Kafka: "apachekafka",
  Knex: "knexdotjs",
  LangChain4j: "langchain",
  LiveView: "phoenixframework",
  MCP: "modelcontextprotocol",
  Mistral: "mistralai",
  Motion: "framer",
  NATS: "natsdotio",
  Payload: "payloadcms",
  pgvector: "postgresql",
  Phoenix: "phoenixframework",
  Postgres: "postgresql",
  "Pydantic AI": "pydantic",
  Rails: "rubyonrails",
  "React Email": "resend",
  "React Flow": "xyflow",
  "React Native": "react",
  "React Navigation": "react",
  "Sentence Transformers": "huggingface",
  Sinatra: "rubysinatra",
  SolidStart: "solid",
  Spark: "apachespark",
  SvelteKit: "svelte",
  SwiftUI: "swift",
  Tailwind: "tailwindcss",
  "TanStack Query": "reactquery",
  "TanStack Router": "tanstack",
  "TanStack Start": "tanstack",
  Transformers: "huggingface",
  "Vert.x": "eclipsevertdotx",
  "Vertex AI": "googlecloud",
  Vue: "vuedotjs",
  Web3: "web3dotjs",
};

/** Marks simple-icons no longer ships, taken from the landing's harness logos. */
const TECH_FROM_LANDING: Record<string, string> = {
  OpenAI: "openai.svg",
  Whisper: "openai.svg",
};

/** Watcher harness id to the landing's logo; a harness without one keeps its two-letter mark. */
const HARNESS_FILES: Record<string, string> = {
  "claude-code": "claude.svg",
  cline: "cline.svg",
  codex: "openai.svg",
  copilot: "github-copilot.svg",
  cursor: "cursor.svg",
  devin: "devin.svg",
  "gemini-cli": "google-gemini.svg",
  "kilo-code": "kilo-code.svg",
  opencode: "opencode.svg",
  "qwen-code": "qwen.svg",
};

type SimpleIcon = { title: string; slug: string; path: string };

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("+", "plus")
    .replaceAll(".", "dot")
    .replaceAll("&", "and")
    .replaceAll(/[^a-z0-9]/g, "");
}

const bySlug = new Map<string, SimpleIcon>();
const byTitle = new Map<string, SimpleIcon>();
for (const value of Object.values(simpleIcons) as unknown[]) {
  if (typeof value !== "object" || value === null || !("slug" in value)) {
    continue;
  }
  const icon = value as SimpleIcon;
  bySlug.set(icon.slug, icon);
  byTitle.set(normalize(icon.title), icon);
}

rmSync(OUT, { force: true, recursive: true });
mkdirSync(join(OUT, "tech"), { recursive: true });
mkdirSync(join(OUT, "harness"), { recursive: true });

// Everything a stack can name: the catalog, the languages and the products read from file extensions.
const NAMES = [
  ...new Set([
    ...Object.keys(CATALOG),
    ...LANGUAGE_ORDER,
    ...Object.values(PRODUCT_FROM_EXT),
  ]),
];

const tech: Record<string, string> = {};
const missing: string[] = [];
for (const name of NAMES) {
  const landing = TECH_FROM_LANDING[name];
  if (landing) {
    copyFileSync(join(LANDING, landing), join(OUT, "tech", landing));
    tech[name] = `/tv-icons/tech/${landing}`;
    continue;
  }
  const alias = TECH_ALIASES[name];
  if (alias && !bySlug.has(alias)) {
    throw new Error(`simple-icons has no "${alias}" (alias of ${name})`);
  }
  // "C#" must not fall through to "C": a name with a symbol we drop needs an alias.
  const exact = /[#]/.test(name) ? undefined : byTitle.get(normalize(name));
  const icon = alias ? bySlug.get(alias) : exact;
  if (!icon) {
    missing.push(name);
    continue;
  }
  writeFileSync(
    join(OUT, "tech", `${icon.slug}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}"/></svg>\n`
  );
  tech[name] = `/tv-icons/tech/${icon.slug}.svg`;
}

const harness: Record<string, string> = {};
for (const [id, file] of Object.entries(HARNESS_FILES)) {
  copyFileSync(join(LANDING, file), join(OUT, "harness", file));
  harness[id] = `/tv-icons/harness/${file}`;
}

const sorted = (map: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(map).toSorted(([a], [b]) => a.localeCompare(b, "en"))
  );
writeFileSync(
  join(APP, "src/lib/tv-icons.ts"),
  `// Generated by scripts/generate-tv-icons.ts (pnpm icons:tv). Do not edit by hand.

/** Logo per technology of the stack catalog; a name that is not here shows its initials. */
export const TECH_ICONS: Record<string, string> = ${JSON.stringify(sorted(tech), null, 2)};

/** Logo per watcher harness id; one that is not here keeps its two-letter mark. */
export const HARNESS_ICONS: Record<string, string> = ${JSON.stringify(sorted(harness), null, 2)};
`
);

console.log(
  `${Object.keys(tech).length} of ${NAMES.length} technologies, ${Object.keys(harness).length} harnesses`
);
console.log(`No logo: ${missing.join(", ")}`);
