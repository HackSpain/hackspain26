import {
  normalizePackage,
  PACKAGE_PREFIX_TAGS,
  PACKAGE_TAGS,
  PRODUCT_ORDER,
} from "./stackCatalog";

export { stackCategory } from "./stackCatalog";
export type { StackCategory } from "./stackCatalog";

export const MAX_TECH_STACK = 12;
export const MAX_TECH_LENGTH = 32;
export const STACK_SCAN_TTL_MS = 6 * 60 * 60 * 1000;
/**
 * How stale a stack may get while somebody on the team has the CLI watcher
 * open: it asks for a re-scan on its own, and this is what keeps a whole team
 * of watchers down to one scan per period.
 */
export const STACK_BACKGROUND_TTL_MS = 30 * 60 * 1000;
// Each chosen file is one GitHub request, so these bound the cost of a scan.
const MAX_MANIFEST_FILES = 20;
const MAX_SOURCE_FILES = 12;

/**
 * Typed by somebody rather than read from a repo. Only a scan somebody asked
 * for replaces it; the ones that run on their own (the CLI watcher, a draft
 * save, a mass re-scan) leave it alone.
 */
export function isHandSet(
  doc:
    | { techStack?: string[]; techStackSource?: "repo" }
    | null
    | undefined
): boolean {
  return Boolean(doc?.techStack?.length) && doc?.techStackSource !== "repo";
}

export type StackFile = { path: string; content: string };

export type DetectStackInput = {
  files: StackFile[];
  languages?: Record<string, number>;
  paths?: string[];
};

const SKIP_DIR = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
  "venv",
]);

const MANIFEST_NAMES = new Set([
  "Cargo.toml",
  "Gemfile",
  "Package.swift",
  "Pipfile",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "go.mod",
  "mix.exs",
  "package.json",
  "pom.xml",
  "pubspec.yaml",
  "pyproject.toml",
  "requirements.txt",
]);

const SOURCE_EXT = new Set([
  "go",
  "java",
  "js",
  "jsx",
  "kt",
  "py",
  "rs",
  "swift",
  "ts",
  "tsx",
]);

export const LANGUAGE_ORDER = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Swift",
  "Kotlin",
  "Java",
  "C#",
  "PHP",
  "Ruby",
  "Elixir",
  "Dart",
  "C++",
  "C",
  "Scala",
  "Solidity",
  "Zig",
  "Haskell",
  "OCaml",
  "Clojure",
  "Gleam",
  "Julia",
  "R",
  "Lua",
  "F#",
  "Objective-C",
];

/** GitHub's language names that are one of our product tags instead. */
export const GITHUB_LANGUAGE_TAGS: Record<string, string> = {
  Astro: "Astro",
  Dockerfile: "Docker",
  GDScript: "Godot",
  HCL: "Terraform",
  "Jupyter Notebook": "Jupyter",
  SCSS: "Sass",
  Svelte: "Svelte",
  Vue: "Vue",
};

const SKIP_PACKAGES = new Set([
  "@types/node",
  "@types/react",
  "eslint",
  "eslint-config-next",
  "prettier",
  "typescript",
  "zod",
]);

const PYTHON_STDLIB = new Set([
  "__future__",
  "abc",
  "asyncio",
  "collections",
  "contextlib",
  "copy",
  "csv",
  "dataclasses",
  "datetime",
  "enum",
  "functools",
  "glob",
  "hashlib",
  "http",
  "io",
  "itertools",
  "json",
  "logging",
  "math",
  "os",
  "pathlib",
  "random",
  "re",
  "shutil",
  "subprocess",
  "sys",
  "tempfile",
  "threading",
  "time",
  "typing",
  "unittest",
  "urllib",
  "uuid",
]);

const LANGUAGE_FROM_EXT: Record<string, string> = {
  c: "C",
  cc: "C++",
  clj: "Clojure",
  cpp: "C++",
  cs: "C#",
  cxx: "C++",
  dart: "Dart",
  ex: "Elixir",
  exs: "Elixir",
  gleam: "Gleam",
  go: "Go",
  hpp: "C++",
  hs: "Haskell",
  java: "Java",
  jl: "Julia",
  js: "JavaScript",
  jsx: "JavaScript",
  kt: "Kotlin",
  lua: "Lua",
  ml: "OCaml",
  php: "PHP",
  py: "Python",
  r: "R",
  rb: "Ruby",
  rs: "Rust",
  scala: "Scala",
  sol: "Solidity",
  swift: "Swift",
  ts: "TypeScript",
  tsx: "TypeScript",
  zig: "Zig",
};

/** File extensions that name a product rather than a language. */
export const PRODUCT_FROM_EXT: Record<string, string> = {
  astro: "Astro",
  gd: "Godot",
  gql: "GraphQL",
  graphql: "GraphQL",
  ipynb: "Jupyter",
  prisma: "Prisma",
  proto: "gRPC",
  scss: "Sass",
  svelte: "Svelte",
  tf: "Terraform",
  tscn: "Godot",
  unity: "Unity",
  uproject: "Unreal Engine",
  vue: "Vue",
};

/** Whole file names, lowercased, that give a tool away wherever they sit. */
export const PRODUCT_FROM_FILE: Record<string, string> = {
  "anchor.toml": "Anchor",
  "angular.json": "Angular",
  "bun.lock": "Bun",
  "bun.lockb": "Bun",
  "bunfig.toml": "Bun",
  "chart.yaml": "Kubernetes",
  "components.json": "shadcn/ui",
  "compose.yaml": "Docker",
  "compose.yml": "Docker",
  "dbt_project.yml": "dbt",
  "deno.json": "Deno",
  "deno.jsonc": "Deno",
  "docker-compose.yaml": "Docker",
  "docker-compose.yml": "Docker",
  dockerfile: "Docker",
  "firebase.json": "Firebase",
  "fly.toml": "Fly.io",
  "foundry.toml": "Foundry",
  "kustomization.yaml": "Kubernetes",
  "manage.py": "Django",
  "netlify.toml": "Netlify",
  "nginx.conf": "Nginx",
  "nx.json": "Nx",
  "project.godot": "Godot",
  "pulumi.yaml": "Pulumi",
  "railway.json": "Railway",
  "railway.toml": "Railway",
  "render.yaml": "Render",
  "serverless.yml": "Serverless",
  "tauri.conf.json": "Tauri",
  "turbo.json": "Turborepo",
  "vercel.json": "Vercel",
  "wp-config.php": "WordPress",
  "wrangler.json": "Cloudflare Workers",
  "wrangler.jsonc": "Cloudflare Workers",
  "wrangler.toml": "Cloudflare Workers",
};

/** `next.config.ts`, `next.config.mjs`...: the part before the extension. */
export const PRODUCT_FROM_CONFIG: Record<string, string> = {
  "astro.config": "Astro",
  "capacitor.config": "Capacitor",
  "cypress.config": "Cypress",
  "drizzle.config": "Drizzle",
  "hardhat.config": "Hardhat",
  "jest.config": "Jest",
  "next.config": "Next.js",
  "nuxt.config": "Nuxt",
  "playwright.config": "Playwright",
  "remix.config": "Remix",
  "sst.config": "SST",
  "svelte.config": "Svelte",
  "tailwind.config": "Tailwind",
  "vite.config": "Vite",
  "vitest.config": "Vitest",
  "webpack.config": "Webpack",
};

/** Folders that only one tool makes. */
export const PRODUCT_FROM_DIR: [RegExp, string][] = [
  [/(^|\/)convex\//, "Convex"],
  [/(^|\/)\.github\/workflows\//, "GitHub Actions"],
  [/(^|\/)supabase\/(migrations|functions)\//, "Supabase"],
  [/(^|\/)\.storybook\//, "Storybook"],
  [/(^|\/)wp-content\//, "WordPress"],
  [/(^|\/)Assets\//, "Unity"],
];

const IMPLIED_DROP: Record<string, string[]> = {
  "Next.js": ["React"],
  Nuxt: ["Vue"],
  Remix: ["React"],
  SvelteKit: ["Svelte"],
  Expo: ["React Native", "React"],
  "React Native": ["React"],
  NestJS: ["Express"],
  Gatsby: ["React"],
  Docusaurus: ["React"],
  "TanStack Start": ["React", "TanStack Router"],
  SolidStart: ["Solid"],
  "shadcn/ui": ["Radix UI"],
};

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function extOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length;
}

export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((part) => SKIP_DIR.has(part));
}

function isManifest(path: string): boolean {
  const name = basename(path);
  return MANIFEST_NAMES.has(name) || name.endsWith(".csproj");
}

function isSource(path: string): boolean {
  const name = basename(path);
  if (
    name.endsWith(".d.ts") ||
    name.endsWith(".min.js") ||
    name.includes(".test.") ||
    name.includes(".spec.") ||
    // Tool configs sit at the top of every package and import nothing useful;
    // tagsFromPaths already reads what their names say.
    name.includes(".config.")
  ) {
    return false;
  }
  return SOURCE_EXT.has(extOf(path));
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function byDepth(a: string, b: string): number {
  return depthOf(a) - depthOf(b) || a.localeCompare(b);
}

/** Take one path from each group in turn until `limit`, so no group starves. */
function dealRoundRobin(groups: string[][], limit: number): string[] {
  const out: string[] = [];
  for (let round = 0; out.length < limit; round++) {
    const before = out.length;
    for (const group of groups) {
      const path = group[round];
      if (path !== undefined && out.length < limit) {
        out.push(path);
      }
    }
    if (out.length === before) {
      break;
    }
  }
  return out;
}

function groupBy(paths: string[], keyOf: (path: string) => string): string[][] {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const key = keyOf(path);
    const group = groups.get(key);
    if (group) {
      group.push(path);
    } else {
      groups.set(key, [path]);
    }
  }
  return [...groups.values()];
}

/**
 * Pick a bounded set of repo paths to fetch. Depth never rules a file out: in
 * a monorepo the real manifests and code live under apps/* or packages/*.
 * Manifests are dealt across ecosystems (a lone requirements.txt is not pushed
 * out by thirty package.json) and sources across the package each belongs to,
 * shallowest first within each.
 */
export function selectStackFiles(paths: string[]): string[] {
  const usable = paths.filter((path) => path && !isIgnoredPath(path));
  const manifests = usable.filter(isManifest).toSorted(byDepth);
  const chosenManifests = dealRoundRobin(
    groupBy(manifests, basename),
    MAX_MANIFEST_FILES
  );
  // Longest root first, so a file belongs to its nearest package.
  const roots = [...new Set(manifests.map(dirOf))].toSorted(
    (a, b) => b.length - a.length
  );
  const rootOf = (path: string) =>
    roots.find((root) => root === "" || path.startsWith(`${root}/`)) ?? "";
  const sources = dealRoundRobin(
    groupBy(usable.filter(isSource).toSorted(byDepth), rootOf),
    MAX_SOURCE_FILES
  );
  return [...new Set([...chosenManifests, ...sources])];
}

function addTag(tags: Set<string>, tag: string | undefined): void {
  if (!tag || tag.length > MAX_TECH_LENGTH) {
    return;
  }
  tags.add(tag);
}

function packageKey(raw: string): string {
  const trimmed = raw.trim().replace(/^npm:/, "");
  if (trimmed.startsWith("@")) {
    const parts = trimmed.split("/");
    return normalizePackage(parts.slice(0, 2).join("/"));
  }
  return normalizePackage(trimmed.split("/")[0] ?? "");
}

/**
 * Go names a module by its path, and code imports subpackages and major
 * versions of it (github.com/gin-gonic/gin/binding, .../fiber/v2), so try
 * every shorter prefix down to host/name.
 */
function tagForGoModule(full: string): string | undefined {
  const parts = full.split("/");
  if (!parts[0]?.includes(".")) {
    return undefined;
  }
  for (let size = parts.length - 1; size >= 2; size--) {
    const tag = PACKAGE_TAGS.get(parts.slice(0, size).join("/"));
    if (tag) {
      return tag;
    }
  }
  return undefined;
}

function tagForPackage(raw: string): string | undefined {
  const full = normalizePackage(raw);
  if (full === "typescript") {
    return "TypeScript";
  }
  const exact = PACKAGE_TAGS.get(full) ?? tagForGoModule(full);
  if (exact) {
    return exact;
  }
  const key = packageKey(raw);
  if (!key || key.startsWith(".") || key.startsWith("node:")) {
    return undefined;
  }
  if (SKIP_PACKAGES.has(key)) {
    return undefined;
  }
  return (
    PACKAGE_TAGS.get(key) ??
    PACKAGE_PREFIX_TAGS.find(([prefix]) => full.startsWith(prefix))?.[1]
  );
}

function parsePackageJson(content: string, tags: Set<string>): void {
  try {
    const parsed = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    for (const group of [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.peerDependencies,
    ]) {
      if (!group) {
        continue;
      }
      for (const name of Object.keys(group)) {
        addTag(tags, tagForPackage(name));
      }
    }
  } catch {
    // Ignore malformed manifests.
  }
}

function parseRequirements(content: string, tags: Set<string>): void {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
      continue;
    }
    const name = trimmed.split(/[<>=!~[]/)[0]?.trim();
    addTag(tags, tagForPackage(name ?? ""));
  }
}

function parsePyproject(content: string, tags: Set<string>): void {
  for (const match of content.matchAll(/["']([A-Za-z0-9_.-]+)(?:[<>=!~].*)?["']/g)) {
    addTag(tags, tagForPackage(match[1] ?? ""));
  }
  const poetry = content.match(
    /\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|\s*$)/
  );
  if (poetry?.[1]) {
    for (const line of poetry[1].split("\n")) {
      const name = line.trim().split(/\s*=/)[0]?.trim();
      if (name && name !== "python") {
        addTag(tags, tagForPackage(name));
      }
    }
  }
}

function parseGoMod(content: string, tags: Set<string>): void {
  for (const match of content.matchAll(/([A-Za-z0-9_./-]+)\s+v\d/g)) {
    addTag(tags, tagForPackage(match[1] ?? ""));
  }
}

function parseCargo(content: string, tags: Set<string>): void {
  const deps = content.match(/\[dependencies\]([\s\S]*?)(\n\[|\s*$)/);
  if (!deps?.[1]) {
    return;
  }
  for (const line of deps[1].split("\n")) {
    const name = line.trim().split(/\s*=/)[0]?.trim();
    if (name) {
      addTag(tags, tagForPackage(name));
    }
  }
}

function parseGemfile(content: string, tags: Set<string>): void {
  for (const match of content.matchAll(/gem\s+["']([^"']+)["']/g)) {
    addTag(tags, tagForPackage(match[1] ?? ""));
  }
}

function parseComposer(content: string, tags: Set<string>): void {
  try {
    const parsed = JSON.parse(content) as {
      require?: Record<string, string>;
      "require-dev"?: Record<string, string>;
    };
    for (const group of [parsed.require, parsed["require-dev"]]) {
      if (!group) {
        continue;
      }
      for (const name of Object.keys(group)) {
        if (name !== "php") {
          addTag(tags, tagForPackage(name));
        }
      }
    }
  } catch {
    // Ignore malformed manifests.
  }
}

function parsePubspec(content: string, tags: Set<string>): void {
  if (/^\s*flutter\s*:/m.test(content)) {
    addTag(tags, "Flutter");
  }
  const deps = content.match(/dependencies:\n([\s\S]*?)(\n\S|\s*$)/);
  if (!deps?.[1]) {
    return;
  }
  for (const line of deps[1].split("\n")) {
    const name = line.trim().split(":")[0]?.trim();
    if (name && name !== "flutter" && name !== "sdk") {
      addTag(tags, tagForPackage(name));
    }
  }
}

function parseMix(content: string, tags: Set<string>): void {
  for (const match of content.matchAll(/\{\s*:([a-zA-Z0-9_]+)/g)) {
    addTag(tags, tagForPackage(match[1] ?? ""));
  }
}

// Longest prefix first: androidx.compose is Compose, the rest of androidx is not.
export const JVM_PREFIX_TAGS: [string, string][] = [
  ["androidx.compose", "Jetpack Compose"],
  ["org.springframework", "Spring"],
  ["io.ktor", "Ktor"],
  ["io.quarkus", "Quarkus"],
  ["io.micronaut", "Micronaut"],
  ["io.vertx", "Vert.x"],
  ["org.hibernate", "Hibernate"],
  ["org.jetbrains.exposed", "Exposed"],
  ["dev.langchain4j", "LangChain4j"],
  ["com.google.firebase", "Firebase"],
  ["org.apache.kafka", "Kafka"],
  ["org.apache.spark", "Spark"],
  ["org.postgresql", "Postgres"],
  ["org.mongodb", "MongoDB"],
  ["com.badlogic.gdx", "libGDX"],
  ["androidx.", "Android"],
  ["android.", "Android"],
  ["com.android.", "Android"],
];

/** NuGet package ids, by prefix, lowercased. */
export const DOTNET_PREFIX_TAGS: [string, string][] = [
  ["microsoft.aspnetcore.components", "Blazor"],
  ["microsoft.aspnetcore", "ASP.NET"],
  ["microsoft.entityframeworkcore", "EF Core"],
  ["microsoft.maui", ".NET MAUI"],
  ["microsoft.semantickernel", "Semantic Kernel"],
  ["avalonia", "Avalonia"],
  ["dapper", "Dapper"],
  ["npgsql", "Postgres"],
  ["mongodb.driver", "MongoDB"],
  ["stackexchange.redis", "Redis"],
  ["azure.", "Azure"],
  ["awssdk.", "AWS"],
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["stripe.net", "Stripe"],
];

function addJvmTags(content: string, tags: Set<string>): void {
  for (const [prefix, tag] of JVM_PREFIX_TAGS) {
    if (content.includes(prefix)) {
      addTag(tags, tag);
    }
  }
}

function parseGradle(content: string, tags: Set<string>): void {
  if (/\bkotlin\b/i.test(content)) {
    addTag(tags, "Kotlin");
  }
  if (/\bspring\b/i.test(content)) {
    addTag(tags, "Spring");
  }
  addJvmTags(content, tags);
}

function parsePackageSwift(content: string, tags: Set<string>): void {
  // .package(url: "https://github.com/vapor/vapor.git", from: "4.0.0")
  for (const match of content.matchAll(/url:\s*"[^"]*\/([^/"]+?)(?:\.git)?"/g)) {
    addTag(tags, tagForPackage(match[1] ?? ""));
  }
}

function parsePom(content: string, tags: Set<string>): void {
  if (/spring/i.test(content)) {
    addTag(tags, "Spring");
  }
  addJvmTags(content, tags);
  addTag(tags, "Java");
}

function parseCsproj(content: string, tags: Set<string>): void {
  addTag(tags, "C#");
  if (/Microsoft\.AspNetCore/i.test(content)) {
    addTag(tags, "ASP.NET");
  }
  if (/UnityEngine/i.test(content)) {
    addTag(tags, "Unity");
  }
  if (/<UseMaui>\s*true/i.test(content)) {
    addTag(tags, ".NET MAUI");
  }
  for (const match of content.matchAll(/<PackageReference\s+Include="([^"]+)"/gi)) {
    const id = (match[1] ?? "").toLowerCase();
    addTag(tags, DOTNET_PREFIX_TAGS.find(([prefix]) => id.startsWith(prefix))?.[1]);
  }
}

function parseManifest(path: string, content: string, tags: Set<string>): void {
  const name = basename(path);
  if (name === "package.json") {
    parsePackageJson(content, tags);
    return;
  }
  if (name === "requirements.txt" || name === "Pipfile") {
    parseRequirements(content, tags);
    addTag(tags, "Python");
    return;
  }
  if (name === "pyproject.toml") {
    parsePyproject(content, tags);
    addTag(tags, "Python");
    return;
  }
  if (name === "go.mod") {
    parseGoMod(content, tags);
    addTag(tags, "Go");
    return;
  }
  if (name === "Cargo.toml") {
    parseCargo(content, tags);
    addTag(tags, "Rust");
    return;
  }
  if (name === "Gemfile") {
    parseGemfile(content, tags);
    addTag(tags, "Ruby");
    return;
  }
  if (name === "composer.json") {
    parseComposer(content, tags);
    addTag(tags, "PHP");
    return;
  }
  if (name === "Package.swift") {
    parsePackageSwift(content, tags);
    addTag(tags, "Swift");
    return;
  }
  if (name === "pubspec.yaml") {
    parsePubspec(content, tags);
    addTag(tags, "Dart");
    return;
  }
  if (name === "mix.exs") {
    parseMix(content, tags);
    addTag(tags, "Elixir");
    return;
  }
  if (name === "build.gradle" || name === "build.gradle.kts") {
    parseGradle(content, tags);
    return;
  }
  if (name === "pom.xml") {
    parsePom(content, tags);
    return;
  }
  if (name.endsWith(".csproj")) {
    parseCsproj(content, tags);
  }
}

function jsImports(content: string): string[] {
  const found: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:[^'"\n]+from\s+)?['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) {
        found.push(match[1]);
      }
    }
  }
  return found;
}

function pythonImports(content: string): string[] {
  const found: string[] = [];
  // Namespace packages only mean something with their second part, which
  // can sit on either side: `import google.genai`, `from google import genai`.
  const pattern =
    /^(?:import\s+([a-zA-Z_][\w.]*)|from\s+([a-zA-Z_][\w.]*)\s+import\s+([a-zA-Z_]\w*)?)/gm;
  for (const match of content.matchAll(pattern)) {
    const [root, inner] = (match[1] ?? match[2] ?? "").split(".");
    if (!root || PYTHON_STDLIB.has(root)) {
      continue;
    }
    found.push(root);
    const second = inner ?? match[3];
    if (second) {
      found.push(`${root}.${second}`);
    }
  }
  return found;
}

function goImports(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(/["']([A-Za-z0-9_./-]+)["']/g)) {
    const spec = match[1] ?? "";
    if (spec.includes(".")) {
      found.push(spec);
    }
  }
  return found;
}

function rustImports(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(/^use\s+([a-zA-Z_][\w]*)/gm)) {
    const crate = match[1];
    if (crate && crate !== "std" && crate !== "core" && crate !== "alloc") {
      found.push(crate);
    }
  }
  return found;
}

function swiftImports(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(/^import\s+([A-Za-z_][\w]*)/gm)) {
    if (match[1] && match[1] !== "Foundation") {
      found.push(match[1]);
    }
  }
  return found;
}

/** Only the import lines, so a package name in a comment or string is not a hit. */
function jvmImports(content: string): string {
  return [...content.matchAll(/^import\s+(?:static\s+)?([\w.]+)/gm)]
    .map((match) => match[1])
    .join("\n");
}

function parseImports(path: string, content: string, tags: Set<string>): void {
  const ext = extOf(path);
  let specs: string[] = [];
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
    specs = jsImports(content);
  } else if (ext === "py") {
    specs = pythonImports(content);
  } else if (ext === "go") {
    specs = goImports(content);
  } else if (ext === "rs") {
    specs = rustImports(content);
  } else if (ext === "swift") {
    specs = swiftImports(content);
  } else if (ext === "kt" || ext === "java") {
    addJvmTags(jvmImports(content), tags);
  }
  for (const spec of specs) {
    addTag(tags, tagForPackage(spec));
  }
}

function tagsFromPaths(paths: string[], tags: Set<string>): void {
  for (const path of paths) {
    if (isIgnoredPath(path)) {
      continue;
    }
    const name = basename(path).toLowerCase();
    const ext = extOf(path);
    addTag(tags, PRODUCT_FROM_FILE[name]);
    // "next.config.mjs" -> "next.config"
    addTag(tags, PRODUCT_FROM_CONFIG[name.split(".").slice(0, 2).join(".")]);
    addTag(tags, LANGUAGE_FROM_EXT[ext]);
    addTag(tags, PRODUCT_FROM_EXT[ext]);
    if (name.startsWith("dockerfile.") || ext === "dockerfile") {
      addTag(tags, "Docker");
    }
    for (const [pattern, tag] of PRODUCT_FROM_DIR) {
      if (pattern.test(path)) {
        addTag(tags, tag);
      }
    }
  }
}

export function canonicalizeTags(tags: Iterable<string>): string[] {
  return finalize(new Set(tags));
}

function finalize(tags: Set<string>): string[] {
  if (tags.has("TypeScript")) {
    tags.delete("JavaScript");
  }
  for (const [keep, drops] of Object.entries(IMPLIED_DROP)) {
    if (!tags.has(keep)) {
      continue;
    }
    for (const drop of drops) {
      tags.delete(drop);
    }
  }
  const ordered: string[] = [];
  for (const name of [...LANGUAGE_ORDER, ...PRODUCT_ORDER]) {
    if (tags.has(name)) {
      ordered.push(name);
      tags.delete(name);
    }
  }
  ordered.push(...[...tags].toSorted((a, b) => a.localeCompare(b)));
  return ordered.slice(0, MAX_TECH_STACK);
}

export function detectStack(input: DetectStackInput): string[] {
  const tags = new Set<string>();
  const paths = input.paths ?? input.files.map((file) => file.path);
  tagsFromPaths(paths, tags);
  if (input.languages) {
    for (const name of Object.keys(input.languages)) {
      addTag(
        tags,
        LANGUAGE_ORDER.includes(name) ? name : GITHUB_LANGUAGE_TAGS[name]
      );
    }
  }
  for (const file of input.files) {
    if (isManifest(file.path)) {
      parseManifest(file.path, file.content, tags);
    }
    if (isSource(file.path)) {
      parseImports(file.path, file.content, tags);
    }
  }
  return finalize(tags);
}
