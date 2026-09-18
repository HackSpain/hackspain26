import { describe, expect, test } from "bun:test";
import {
  detectStack,
  DOTNET_PREFIX_TAGS,
  GITHUB_LANGUAGE_TAGS,
  isHandSet,
  JVM_PREFIX_TAGS,
  LANGUAGE_ORDER,
  MAX_TECH_STACK,
  PRODUCT_FROM_CONFIG,
  PRODUCT_FROM_DIR,
  PRODUCT_FROM_EXT,
  PRODUCT_FROM_FILE,
  selectStackFiles,
  stackCategory,
} from "./stack";
import { CATALOG, CATALOG_DUPLICATES } from "./stackCatalog";

const MONOREPO = [
  "package.json",
  "pnpm-workspace.yaml",
  "eslint.config.mjs",
  "apps/web/package.json",
  "apps/web/next.config.ts",
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/layout.tsx",
  "apps/web/convex/schema.ts",
  "apps/web/node_modules/react/package.json",
  "packages/ui/package.json",
  "packages/ui/src/button.tsx",
  "services/ml/api/requirements.txt",
  "services/ml/api/src/server/main.py",
];

describe("selectStackFiles", () => {
  test("picks manifests at any depth", () => {
    const chosen = selectStackFiles(MONOREPO);
    expect(chosen).toContain("package.json");
    expect(chosen).toContain("apps/web/package.json");
    expect(chosen).toContain("packages/ui/package.json");
    expect(chosen).toContain("services/ml/api/requirements.txt");
  });

  test("picks sources nested deep inside each package", () => {
    const chosen = selectStackFiles(MONOREPO);
    expect(chosen).toContain("apps/web/src/app/page.tsx");
    expect(chosen).toContain("packages/ui/src/button.tsx");
    expect(chosen).toContain("services/ml/api/src/server/main.py");
  });

  test("skips vendored folders and tool configs", () => {
    const chosen = selectStackFiles(MONOREPO);
    expect(chosen).not.toContain("apps/web/node_modules/react/package.json");
    expect(chosen).not.toContain("eslint.config.mjs");
    expect(chosen).not.toContain("apps/web/next.config.ts");
  });

  test("a big workspace does not starve the others", () => {
    const big = Array.from(
      { length: 60 },
      (_, index) => `apps/web/src/file${String(index).padStart(2, "0")}.ts`
    );
    const chosen = selectStackFiles([
      "apps/web/package.json",
      ...big,
      "services/api/go.mod",
      "services/api/cmd/server/main.go",
    ]);
    expect(chosen).toContain("services/api/cmd/server/main.go");
  });

  test("one ecosystem's manifests do not push out another's", () => {
    const many = Array.from(
      { length: 40 },
      (_, index) => `packages/p${String(index).padStart(2, "0")}/package.json`
    );
    const chosen = selectStackFiles([
      ...many,
      "services/ml/deep/down/pyproject.toml",
    ]);
    expect(chosen).toContain("services/ml/deep/down/pyproject.toml");
  });

  test("stays bounded", () => {
    const paths = Array.from({ length: 500 }, (_, index) => [
      `packages/p${index}/package.json`,
      `packages/p${index}/src/index.ts`,
    ]).flat();
    expect(selectStackFiles(paths).length).toBeLessThanOrEqual(32);
  });
});

describe("detectStack", () => {
  test("reads a monorepo's nested manifests, imports and folders", () => {
    const stack = detectStack({
      files: [
        { content: '{"devDependencies":{"turbo":"2"}}', path: "package.json" },
        {
          content: '{"dependencies":{"next":"15","tailwindcss":"4"}}',
          path: "apps/web/package.json",
        },
        {
          content: "fastapi==0.110\ntorch>=2\n",
          path: "services/ml/api/requirements.txt",
        },
        {
          content: 'import { Hono } from "hono";',
          path: "services/edge/src/index.ts",
        },
      ],
      paths: MONOREPO,
    });
    expect(stack).toEqual(
      expect.arrayContaining([
        "TypeScript",
        "Python",
        "Next.js",
        "Tailwind",
        "Convex",
        "FastAPI",
        "Hono",
        "PyTorch",
      ])
    );
    expect(stack).not.toContain("React");
  });
});

describe("detectStack outside JS", () => {
  const detect = (path: string, content: string) =>
    detectStack({ files: [{ content, path }] });

  test("python data and database packages", () => {
    const stack = detect(
      "requirements.txt",
      "pandas==2.2\nnumpy\nscikit-learn>=1.4\nSQLAlchemy[asyncio]\npsycopg2-binary\npymongo\nredis\n"
    );
    expect(stack).toEqual(
      expect.arrayContaining([
        "Python",
        "Pandas",
        "NumPy",
        "scikit-learn",
        "SQLAlchemy",
        "Postgres",
        "MongoDB",
        "Redis",
      ])
    );
  });

  test("python imports use the import name, not the pip name", () => {
    const stack = detect(
      "ml/train.py",
      "import os\nimport sqlite3\nfrom sklearn.ensemble import RandomForestClassifier\nimport pandas as pd\n"
    );
    expect(stack).toEqual(
      expect.arrayContaining(["Python", "scikit-learn", "Pandas", "SQLite"])
    );
  });

  test("go modules match by prefix: subpackages and major versions", () => {
    const stack = detect(
      "cmd/server/main.go",
      'import (\n  "github.com/gin-gonic/gin/binding"\n  "github.com/jackc/pgx/v5/pgxpool"\n  "github.com/redis/go-redis/v9"\n  "gorm.io/gorm"\n)\n'
    );
    expect(stack).toEqual(
      expect.arrayContaining(["Go", "Gin", "Postgres", "Redis", "GORM"])
    );
  });

  test("go.mod drivers", () => {
    const stack = detect(
      "go.mod",
      "module example.com/app\n\nrequire (\n\tgithub.com/gofiber/fiber/v2 v2.52.0\n\tgo.mongodb.org/mongo-driver v1.14.0\n\tgithub.com/lib/pq v1.10.9\n)\n"
    );
    expect(stack).toEqual(
      expect.arrayContaining(["Go", "Fiber", "MongoDB", "Postgres"])
    );
  });

  test("rust database crates", () => {
    const stack = detect(
      "Cargo.toml",
      '[package]\nname = "api"\n\n[dependencies]\naxum = "0.7"\nsqlx = { version = "0.7", features = ["postgres"] }\nrusqlite = "0.31"\n'
    );
    expect(stack).toEqual(
      expect.arrayContaining(["Rust", "Axum", "SQLx", "SQLite"])
    );
  });

  test("Package.swift and SwiftUI", () => {
    expect(
      detect(
        "Package.swift",
        'dependencies: [\n  .package(url: "https://github.com/vapor/vapor.git", from: "4.0.0"),\n]'
      )
    ).toEqual(expect.arrayContaining(["Swift", "Vapor"]));
    expect(
      detect("App/ContentView.swift", "import SwiftUI\nimport Foundation\n")
    ).toEqual(expect.arrayContaining(["Swift", "SwiftUI"]));
  });

  test("kotlin and java imports", () => {
    expect(
      detect(
        "app/src/main/java/com/x/MainActivity.kt",
        "package com.x\n\nimport androidx.compose.material3.Text\nimport android.os.Bundle\n"
      )
    ).toEqual(expect.arrayContaining(["Kotlin", "Jetpack Compose", "Android"]));
    expect(
      detect(
        "server/src/main/kotlin/Application.kt",
        "import io.ktor.server.engine.*\n// not androidx.compose\n"
      )
    ).toEqual(["Kotlin", "Ktor"]);
    expect(
      detect(
        "src/main/java/com/x/Api.java",
        "import org.springframework.boot.SpringApplication;\n"
      )
    ).toEqual(["Java", "Spring"]);
  });
});

describe("catalog", () => {
  test("no package name is claimed by two technologies", () => {
    expect(CATALOG_DUPLICATES).toEqual([]);
  });

  test("every tag a file, folder or namespace rule emits is in the catalog", () => {
    const emitted = [
      ...Object.values(GITHUB_LANGUAGE_TAGS),
      ...Object.values(PRODUCT_FROM_EXT),
      ...Object.values(PRODUCT_FROM_FILE),
      ...Object.values(PRODUCT_FROM_CONFIG),
      ...PRODUCT_FROM_DIR.map(([, tag]) => tag),
      ...JVM_PREFIX_TAGS.map(([, tag]) => tag),
      ...DOTNET_PREFIX_TAGS.map(([, tag]) => tag),
    ];
    const unknown = emitted.filter(
      (tag) => !(tag in CATALOG || LANGUAGE_ORDER.includes(tag))
    );
    expect(unknown).toEqual([]);
  });

  test("categories come from the catalog", () => {
    expect(stackCategory("Next.js")).toBe("Frontend");
    expect(stackCategory("Anthropic")).toBe("Datos");
    expect(stackCategory("Stripe")).toBe("Backend");
    expect(stackCategory("Docker")).toBe("Otras");
    expect(stackCategory("something typed by hand")).toBe("Otras");
  });
});

describe("detectStack across the catalog", () => {
  const detect = (path: string, content: string) =>
    detectStack({ files: [{ content, path }] });
  const packageJson = (...names: string[]) =>
    detect(
      "package.json",
      JSON.stringify({
        dependencies: Object.fromEntries(names.map((name) => [name, "1"])),
      })
    );

  test("scopes match by prefix, and a specific package beats its scope", () => {
    expect(packageJson("@aws-sdk/client-s3")).toEqual(["AWS"]);
    expect(packageJson("@aws-sdk/client-dynamodb")).toEqual(["DynamoDB"]);
    expect(packageJson("@ai-sdk/xai")).toEqual(["AI SDK"]);
    expect(packageJson("@ai-sdk/anthropic")).toEqual(["Anthropic"]);
    expect(packageJson("@anthropic-ai/sdk")).toEqual(["Anthropic"]);
    expect(packageJson("@anthropic-ai/claude-agent-sdk")).toEqual([
      "Claude Agent SDK",
    ]);
    expect(packageJson("@radix-ui/react-dialog")).toEqual(["Radix UI"]);
  });

  test("still ignores what it always ignored", () => {
    expect(packageJson("zod", "eslint", "prettier", "@types/node")).toEqual([]);
    expect(packageJson("typescript")).toEqual(["TypeScript"]);
  });

  test("pip names: underscores, extras and prefixes", () => {
    expect(
      detect(
        "requirements.txt",
        "google_generativeai\nlangchain-openai\nllama-index-core\nopencv-python-headless\ngoogle-cloud-storage\nqdrant_client[fastembed]\n"
      )
    ).toEqual(
      expect.arrayContaining([
        "Gemini",
        "LangChain",
        "LlamaIndex",
        "OpenCV",
        "Google Cloud",
        "Qdrant",
      ])
    );
  });

  test("python namespace imports, on either side of `import`", () => {
    expect(detect("a.py", "from google import genai\n")).toContain("Gemini");
    expect(detect("a.py", "import google.generativeai as genai\n")).toContain(
      "Gemini"
    );
    expect(detect("a.py", "from google.cloud import storage\n")).toContain(
      "Google Cloud"
    );
    expect(detect("a.py", "import cv2\nfrom anthropic import Anthropic\n")).toEqual(
      expect.arrayContaining(["OpenCV", "Anthropic"])
    );
    expect(detect("a.py", "from os import path\nimport json\n")).toEqual([
      "Python",
    ]);
  });

  test("files and folders name their tool", () => {
    const stack = detectStack({
      files: [],
      paths: [
        "Dockerfile",
        "docker/api.Dockerfile",
        ".github/workflows/ci.yml",
        "apps/edge/wrangler.toml",
        "notebooks/eda.ipynb",
        "contracts/Token.sol",
        "contracts/hardhat.config.ts",
        "infra/main.tf",
        "apps/web/components.json",
        "apps/web/supabase/migrations/0001_init.sql",
        "schema.prisma",
      ],
    });
    expect(stack).toEqual(
      expect.arrayContaining([
        "Solidity",
        "Docker",
        "GitHub Actions",
        "Cloudflare Workers",
        "Jupyter",
        "Hardhat",
        "Terraform",
        "shadcn/ui",
        "Supabase",
        "Prisma",
      ])
    );
  });

  test("GitHub language names that are really products", () => {
    expect(
      detectStack({ files: [], languages: { HCL: 1, Vue: 1, Zig: 1, HTML: 1 } })
    ).toEqual(["Zig", "Vue", "Terraform"]);
  });

  test(".NET and Maven package ids", () => {
    expect(
      detect(
        "Api/Api.csproj",
        '<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8" />\n<PackageReference Include="Npgsql" Version="8" />'
      )
    ).toEqual(["C#", "EF Core", "Postgres"]);
    expect(
      detect("pom.xml", "<groupId>io.quarkus</groupId><groupId>org.hibernate</groupId>")
    ).toEqual(["Java", "Quarkus", "Hibernate"]);
  });

  test("when the cap bites, tooling goes before what the project is built on", () => {
    const stack = packageJson(
      "next",
      "tailwindcss",
      "convex",
      "hono",
      "@anthropic-ai/sdk",
      "ai",
      "drizzle-orm",
      "pg",
      "stripe",
      "@clerk/nextjs",
      "resend",
      "@sentry/nextjs",
      "@radix-ui/react-slot",
      "zustand",
      "vitest",
      "@playwright/test",
      "storybook"
    );
    expect(stack).toHaveLength(MAX_TECH_STACK);
    expect(stack).toEqual(
      expect.arrayContaining(["Next.js", "Convex", "Hono", "Anthropic", "Postgres"])
    );
    expect(stack).not.toContain("Vitest");
    expect(stack).not.toContain("Storybook");
  });
});

describe("isHandSet", () => {
  test("a stack with no repo source was typed by somebody", () => {
    expect(isHandSet({ techStack: ["Next.js"] })).toBe(true);
    expect(isHandSet({ techStack: ["Next.js"], techStackSource: "repo" })).toBe(
      false
    );
  });

  test("nothing to protect when there is no stack", () => {
    expect(isHandSet(null)).toBe(false);
    expect(isHandSet({})).toBe(false);
    expect(isHandSet({ techStack: [] })).toBe(false);
  });
});
