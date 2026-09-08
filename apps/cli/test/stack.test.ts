import { describe, expect, test } from "bun:test";
import { canonicalRepoUrl, repoSlug } from "../../app/convex/lib/github";
import { detectStack, selectStackFiles } from "../../app/convex/lib/stack";

describe("repoSlug", () => {
  test("accepts URLs and org/name", () => {
    expect(repoSlug("https://github.com/org/repo")).toBe("org/repo");
    expect(repoSlug("org/repo")).toBe("org/repo");
    expect(canonicalRepoUrl("org/repo.git")).toBe("https://github.com/org/repo");
    expect(repoSlug("not-a-repo")).toBeNull();
  });
});

describe("selectStackFiles", () => {
  test("prefers root manifests and a shallow source sample", () => {
    const picked = selectStackFiles([
      "node_modules/react/package.json",
      "dist/index.js",
      "src/app/page.tsx",
      "apps/web/package.json",
      "package.json",
      "pyproject.toml",
      "src/lib/util.ts",
      "src/lib/util.test.ts",
    ]);
    expect(picked).toContain("package.json");
    expect(picked).toContain("apps/web/package.json");
    expect(picked).toContain("pyproject.toml");
    expect(picked).toContain("src/app/page.tsx");
    expect(picked).not.toContain("node_modules/react/package.json");
    expect(picked).not.toContain("src/lib/util.test.ts");
  });
});

describe("detectStack", () => {
  test("maps a Next + Convex + Tailwind repo to product tags", () => {
    const tags = detectStack({
      files: [
        {
          path: "package.json",
          content: JSON.stringify({
            dependencies: {
              convex: "^1.25.0",
              next: "16.3.3",
              react: "19.2.0",
              tailwindcss: "^4.0.0",
            },
            devDependencies: { typescript: "^5.0.0" },
          }),
        },
        {
          path: "src/app/page.tsx",
          content: `import { useQuery } from "convex/react";\nimport Link from "next/link";\n`,
        },
      ],
      languages: { TypeScript: 80, JavaScript: 20 },
      paths: ["package.json", "src/app/page.tsx", "convex/schema.ts"],
    });
    expect(tags).toEqual(["TypeScript", "Next.js", "Tailwind", "Convex"]);
  });

  test("reads Python manifests and FastAPI imports", () => {
    const tags = detectStack({
      files: [
        {
          path: "requirements.txt",
          content: "fastapi==0.115.0\nuvicorn\nnumpy==2.0.0\n",
        },
        {
          path: "main.py",
          content: "from fastapi import FastAPI\nimport torch\n",
        },
      ],
    });
    expect(tags).toContain("Python");
    expect(tags).toContain("FastAPI");
    expect(tags).toContain("PyTorch");
    expect(tags).not.toContain("numpy");
  });

  test("ignores unknown packages and caps the list", () => {
    const deps: Record<string, string> = {
      leftpad: "1.0.0",
      lodash: "4.17.21",
      "my-internal-lib": "0.0.1",
    };
    for (let i = 0; i < 20; i++) {
      deps[`noise-${i}`] = "1.0.0";
    }
    const tags = detectStack({
      files: [{ path: "package.json", content: JSON.stringify({ dependencies: deps }) }],
    });
    expect(tags.every((tag) => !tag.startsWith("noise-"))).toBe(true);
    expect(tags).not.toContain("lodash");
    expect(tags.length).toBeLessThanOrEqual(12);
  });

  test("Go, Rust and Unity path signals", () => {
    const tags = detectStack({
      files: [
        { path: "go.mod", content: "module example\nrequire github.com/gin-gonic/gin v1.9.0\n" },
        { path: "Cargo.toml", content: "[dependencies]\naxum = \"0.7\"\n" },
      ],
      paths: ["go.mod", "Cargo.toml", "Assets/Scenes/Main.unity"],
    });
    expect(tags).toContain("Go");
    expect(tags).toContain("Gin");
    expect(tags).toContain("Rust");
    expect(tags).toContain("Axum");
    expect(tags).toContain("Unity");
  });
});
