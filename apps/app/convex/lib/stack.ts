export const MAX_TECH_STACK = 12;
export const MAX_TECH_LENGTH = 32;
export const STACK_SCAN_TTL_MS = 6 * 60 * 60 * 1000;

export type StackFile = { path: string; content: string };

export type DetectStackInput = {
  files: StackFile[];
  languages?: Record<string, number>;
  paths?: string[];
};

export type StackCategory = "Frontend" | "Backend" | "Datos" | "Otras";

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
  "js",
  "jsx",
  "kt",
  "py",
  "rs",
  "swift",
  "ts",
  "tsx",
]);

const LANGUAGE_ORDER = [
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
];

const PRODUCT_ORDER = [
  "Next.js",
  "Nuxt",
  "Remix",
  "SvelteKit",
  "Astro",
  "Angular",
  "React Native",
  "Expo",
  "React",
  "Vue",
  "Svelte",
  "Solid",
  "Flutter",
  "Unity",
  "Tailwind",
  "Three.js",
  "Vite",
  "Convex",
  "Supabase",
  "Firebase",
  "FastAPI",
  "Django",
  "Flask",
  "Express",
  "Hono",
  "Fastify",
  "NestJS",
  "Gin",
  "Fiber",
  "Axum",
  "Actix",
  "Rails",
  "Laravel",
  "Spring",
  "ASP.NET",
  "Phoenix",
  "Prisma",
  "Drizzle",
  "Postgres",
  "SQLite",
  "MongoDB",
  "Redis",
  "PyTorch",
  "TensorFlow",
  "LangChain",
  "Transformers",
  "OpenAI",
  "Streamlit",
  "Gradio",
];

export const STACK_CATEGORY: Record<string, StackCategory> = {
  Actix: "Backend",
  Angular: "Frontend",
  "ASP.NET": "Backend",
  Astro: "Frontend",
  Axum: "Backend",
  Convex: "Backend",
  Django: "Backend",
  Drizzle: "Datos",
  Expo: "Frontend",
  Express: "Backend",
  FastAPI: "Backend",
  Fastify: "Backend",
  Fiber: "Backend",
  Firebase: "Backend",
  Flask: "Backend",
  Flutter: "Frontend",
  Gin: "Backend",
  Gradio: "Datos",
  Hono: "Backend",
  LangChain: "Datos",
  Laravel: "Backend",
  MongoDB: "Datos",
  NestJS: "Backend",
  "Next.js": "Frontend",
  Nuxt: "Frontend",
  OpenAI: "Datos",
  Phoenix: "Backend",
  Postgres: "Datos",
  Prisma: "Datos",
  PyTorch: "Datos",
  Rails: "Backend",
  React: "Frontend",
  "React Native": "Frontend",
  Redis: "Datos",
  Remix: "Frontend",
  Solid: "Frontend",
  Spring: "Backend",
  SQLite: "Datos",
  Streamlit: "Datos",
  Supabase: "Backend",
  Svelte: "Frontend",
  SvelteKit: "Frontend",
  Tailwind: "Frontend",
  TensorFlow: "Datos",
  "Three.js": "Frontend",
  Transformers: "Datos",
  Unity: "Otras",
  Vite: "Frontend",
  Vue: "Frontend",
};

const PACKAGE_TAGS: Record<string, string> = {
  "@ai-sdk/openai": "OpenAI",
  "@auth/core": "Auth.js",
  "@langchain/core": "LangChain",
  "@nestjs/core": "NestJS",
  "@react-three/fiber": "Three.js",
  "@remix-run/react": "Remix",
  "@sveltejs/kit": "SvelteKit",
  "@supabase/supabase-js": "Supabase",
  "@trpc/server": "tRPC",
  actixweb: "Actix",
  "actix-web": "Actix",
  ai: "AI SDK",
  angular: "Angular",
  astro: "Astro",
  axum: "Axum",
  convex: "Convex",
  django: "Django",
  "drizzle-orm": "Drizzle",
  electron: "Electron",
  expo: "Expo",
  express: "Express",
  fastapi: "FastAPI",
  fastify: "Fastify",
  firebase: "Firebase",
  flask: "Flask",
  flutter: "Flutter",
  gin: "Gin",
  "github.com/gin-gonic/gin": "Gin",
  "github.com/gofiber/fiber": "Fiber",
  "github.com/gofiber/fiber/v2": "Fiber",
  "github.com/labstack/echo": "Echo",
  "github.com/labstack/echo/v4": "Echo",
  gradio: "Gradio",
  hono: "Hono",
  ioredis: "Redis",
  langchain: "LangChain",
  "laravel/framework": "Laravel",
  mongoose: "MongoDB",
  next: "Next.js",
  nuxt: "Nuxt",
  openai: "OpenAI",
  pg: "Postgres",
  phoenix: "Phoenix",
  postgres: "Postgres",
  prisma: "Prisma",
  pytorch: "PyTorch",
  rails: "Rails",
  react: "React",
  "react-native": "React Native",
  redis: "Redis",
  remix: "Remix",
  "solid-js": "Solid",
  streamlit: "Streamlit",
  supabase: "Supabase",
  svelte: "Svelte",
  tailwindcss: "Tailwind",
  tensorflow: "TensorFlow",
  three: "Three.js",
  torch: "PyTorch",
  transformers: "Transformers",
  typescript: "TypeScript",
  vite: "Vite",
  vue: "Vue",
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

const LANGUAGE_FROM_GITHUB: Record<string, string> = {
  "C#": "C#",
  "C++": "C++",
  Dart: "Dart",
  Elixir: "Elixir",
  Go: "Go",
  Java: "Java",
  JavaScript: "JavaScript",
  Kotlin: "Kotlin",
  PHP: "PHP",
  Python: "Python",
  Ruby: "Ruby",
  Rust: "Rust",
  Swift: "Swift",
  TypeScript: "TypeScript",
};

const LANGUAGE_FROM_EXT: Record<string, string> = {
  cs: "C#",
  go: "Go",
  java: "Java",
  js: "JavaScript",
  jsx: "JavaScript",
  kt: "Kotlin",
  py: "Python",
  rs: "Rust",
  swift: "Swift",
  ts: "TypeScript",
  tsx: "TypeScript",
};

const IMPLIED_DROP: Record<string, string[]> = {
  "Next.js": ["React"],
  Nuxt: ["Vue"],
  Remix: ["React"],
  SvelteKit: ["Svelte"],
  Expo: ["React Native", "React"],
  "React Native": ["React"],
  NestJS: ["Express"],
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
    name.includes(".spec.")
  ) {
    return false;
  }
  return SOURCE_EXT.has(extOf(path));
}

/** Pick a bounded set of repo paths to fetch. Root manifests win. */
export function selectStackFiles(paths: string[]): string[] {
  const usable = paths.filter((path) => path && !isIgnoredPath(path));
  const manifests = usable
    .filter(isManifest)
    .toSorted((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b));
  const packageJson = manifests.filter(
    (path) => basename(path) === "package.json"
  );
  const others = manifests.filter((path) => basename(path) !== "package.json");
  const chosenManifests = [
    ...packageJson.filter((path) => depthOf(path) <= 3).slice(0, 5),
    ...others.slice(0, packageJson.length === 0 ? 3 : 2),
  ].slice(0, 7);
  const sources = usable
    .filter(isSource)
    .toSorted((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))
    .slice(0, 8);
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
    return parts.slice(0, 2).join("/").toLowerCase();
  }
  return trimmed.split("/")[0]?.toLowerCase() ?? "";
}

function tagForPackage(raw: string): string | undefined {
  const full = raw.trim().toLowerCase();
  if (PACKAGE_TAGS[full]) {
    return PACKAGE_TAGS[full];
  }
  const key = packageKey(raw);
  if (!key || key.startsWith(".") || key.startsWith("node:")) {
    return undefined;
  }
  if (SKIP_PACKAGES.has(key)) {
    return undefined;
  }
  return PACKAGE_TAGS[key];
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

function parseGradle(content: string, tags: Set<string>): void {
  if (/\bkotlin\b/i.test(content)) {
    addTag(tags, "Kotlin");
  }
  if (/\bspring\b/i.test(content)) {
    addTag(tags, "Spring");
  }
}

function parsePom(content: string, tags: Set<string>): void {
  if (/spring/i.test(content)) {
    addTag(tags, "Spring");
  }
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
  for (const match of content.matchAll(/^(?:from|import)\s+([a-zA-Z_][\w.]*)/gm)) {
    const root = match[1]?.split(".")[0];
    if (root && !PYTHON_STDLIB.has(root)) {
      found.push(root);
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
    if (match[1] && match[1] !== "Foundation" && match[1] !== "SwiftUI") {
      found.push(match[1]);
    }
  }
  return found;
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
    const name = basename(path);
    if (name.startsWith("next.config.")) {
      addTag(tags, "Next.js");
    }
    if (name.startsWith("astro.config.")) {
      addTag(tags, "Astro");
    }
    if (name.startsWith("svelte.config.")) {
      addTag(tags, "Svelte");
    }
    if (name.startsWith("nuxt.config.")) {
      addTag(tags, "Nuxt");
    }
    if (name.startsWith("tailwind.config.")) {
      addTag(tags, "Tailwind");
    }
    if (name.endsWith(".unity") || path.startsWith("Assets/") || path.includes("/Assets/")) {
      addTag(tags, "Unity");
    }
    if (path === "convex" || path.startsWith("convex/")) {
      addTag(tags, "Convex");
    }
    const language = LANGUAGE_FROM_EXT[extOf(path)];
    if (language) {
      addTag(tags, language);
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
      addTag(tags, LANGUAGE_FROM_GITHUB[name]);
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

export function stackCategory(name: string): StackCategory {
  return STACK_CATEGORY[name] ?? "Otras";
}
