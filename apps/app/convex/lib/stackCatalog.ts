export type StackCategory = "Frontend" | "Backend" | "Datos" | "Otras";

type Tech = { category: StackCategory; packages: string[] };

const frontend = (...packages: string[]): Tech => ({
  category: "Frontend",
  packages,
});
const backend = (...packages: string[]): Tech => ({
  category: "Backend",
  packages,
});
const data = (...packages: string[]): Tech => ({ category: "Datos", packages });
const other = (...packages: string[]): Tech => ({ category: "Otras", packages });

/**
 * Every technology the detector can name, with the package names that give it
 * away in any ecosystem (npm, pip, Go modules, crates, gems, composer, pub,
 * hex). A name ending in `*` is a prefix: "@aws-sdk/*", "google-cloud-*".
 * Python import names that differ from the pip name go here too (cv2,
 * sklearn, google.genai). An entry with no packages is named by a file, a
 * folder or a JVM/.NET namespace instead (see stack.ts).
 *
 * Insertion order is display order, and a stack is cut at MAX_TECH_STACK, so
 * what a project is built on comes first and its tooling last.
 */
export const CATALOG: Record<string, Tech> = {
  // Web frameworks
  "Next.js": frontend("next"),
  Nuxt: frontend("nuxt", "nuxt3", "@nuxt/*"),
  Remix: frontend("remix", "@remix-run/*"),
  SvelteKit: frontend("@sveltejs/kit"),
  Astro: frontend("astro", "@astrojs/*"),
  "TanStack Start": frontend("@tanstack/react-start", "@tanstack/start"),
  SolidStart: frontend("@solidjs/start"),
  Qwik: frontend("@builder.io/qwik", "@builder.io/qwik-city"),
  Gatsby: frontend("gatsby"),
  Docusaurus: frontend("@docusaurus/*"),
  Angular: frontend("angular", "@angular/*"),
  "React Native": frontend("react-native"),
  Expo: frontend("expo", "expo-router"),
  "React Router": frontend("react-router", "react-router-dom"),
  React: frontend("react", "react-dom"),
  Preact: frontend("preact"),
  Vue: frontend("vue"),
  Svelte: frontend("svelte"),
  Solid: frontend("solid-js"),
  Lit: frontend("lit", "lit-element"),
  "Alpine.js": frontend("alpinejs"),
  htmx: frontend("htmx.org", "django-htmx"),
  jQuery: frontend("jquery"),

  // Mobile and desktop
  Flutter: frontend("flutter"),
  SwiftUI: frontend("swiftui"),
  "Jetpack Compose": frontend(),
  Android: frontend(),
  ".NET MAUI": frontend(),
  Blazor: frontend(),
  Avalonia: frontend(),
  Ionic: frontend("@ionic/*"),
  Capacitor: frontend("@capacitor/*"),
  Electron: frontend("electron"),
  Tauri: frontend("tauri", "@tauri-apps/*"),

  // Games and 3D
  Unity: other(),
  Godot: other(),
  "Unreal Engine": other(),
  Bevy: other("bevy"),
  Phaser: frontend("phaser"),
  PixiJS: frontend("pixi.js", "@pixi/*"),
  "Babylon.js": frontend("babylonjs", "@babylonjs/*"),
  "A-Frame": frontend("aframe"),
  Pygame: other("pygame"),
  libGDX: other(),
  Tailwind: frontend("tailwindcss", "@tailwindcss/*"),
  "Three.js": frontend("three", "@react-three/*"),
  Vite: frontend("vite"),

  // Backend platforms
  Convex: backend("convex"),
  Supabase: backend("supabase", "@supabase/*", "supabase-flutter", "supabase-swift"),
  Firebase: backend(
    "firebase",
    "firebase-admin",
    "firebase-functions",
    "firebase-core",
    "firebase-auth",
    "cloud-firestore",
    "firebase-ios-sdk",
    "@firebase/*",
    "@react-native-firebase/*"
  ),
  Appwrite: backend("appwrite", "node-appwrite"),
  PocketBase: backend("pocketbase"),
  "AWS Amplify": backend("aws-amplify", "@aws-amplify/*"),
  InstantDB: backend("@instantdb/*"),
  Liveblocks: backend("@liveblocks/*"),
  PartyKit: backend("partykit", "partysocket"),

  // Backend frameworks
  FastAPI: backend("fastapi"),
  Django: backend("django"),
  "Django REST Framework": backend("djangorestframework", "rest-framework"),
  Flask: backend("flask"),
  Starlette: backend("starlette"),
  Litestar: backend("litestar"),
  aiohttp: backend("aiohttp"),
  Sanic: backend("sanic"),
  Tornado: backend("tornado"),
  Express: backend("express"),
  Hono: backend("hono", "@hono/*"),
  Fastify: backend("fastify", "@fastify/*"),
  NestJS: backend("@nestjs/*"),
  Koa: backend("koa"),
  Elysia: backend("elysia", "@elysiajs/*"),
  AdonisJS: backend("@adonisjs/*"),
  Nitro: backend("nitropack"),
  Gin: backend("gin", "github.com/gin-gonic/gin"),
  Fiber: backend("github.com/gofiber/fiber"),
  Echo: backend("github.com/labstack/echo"),
  Chi: backend("github.com/go-chi/chi"),
  "Gorilla Mux": backend("github.com/gorilla/mux"),
  Axum: backend("axum"),
  Actix: backend("actix-web", "actixweb"),
  Rocket: backend("rocket"),
  Warp: backend("warp"),
  Ktor: backend(),
  Vapor: backend("vapor"),
  Rails: backend("rails"),
  Sinatra: backend("sinatra"),
  Laravel: backend("laravel/framework"),
  Symfony: backend("symfony/*"),
  Livewire: backend("livewire/livewire"),
  Inertia: backend("@inertiajs/*", "inertiajs/inertia-laravel", "inertia-rails"),
  WordPress: backend(),
  Spring: backend(),
  Quarkus: backend(),
  Micronaut: backend(),
  "Vert.x": backend(),
  "ASP.NET": backend(),
  Phoenix: backend("phoenix"),
  LiveView: backend("phoenix-live-view"),
  Bun: backend("bun-types", "@types/bun"),
  Deno: backend(),
  "Cloudflare Workers": backend("wrangler", "@cloudflare/*"),

  // APIs, realtime and background work
  tRPC: backend("@trpc/*"),
  GraphQL: backend(
    "graphql",
    "graphql-yoga",
    "graphene",
    "strawberry-graphql",
    "ariadne",
    "github.com/99designs/gqlgen",
    "juniper",
    "async-graphql",
    "absinthe"
  ),
  Apollo: backend("@apollo/*", "apollo-server"),
  gRPC: backend("@grpc/*", "grpcio", "google.golang.org/grpc", "tonic"),
  "Socket.IO": backend("socket.io", "socket.io-client", "python-socketio"),
  WebSockets: backend("ws", "websockets", "github.com/gorilla/websocket"),
  LiveKit: backend(
    "livekit",
    "livekit-client",
    "livekit-server-sdk",
    "livekit-agents",
    "@livekit/*"
  ),
  Celery: backend("celery"),
  BullMQ: backend("bullmq"),
  Inngest: backend("inngest"),
  "Trigger.dev": backend("@trigger.dev/*"),
  Temporal: backend("@temporalio/*", "temporalio", "go.temporal.io/sdk"),
  Kafka: backend(
    "kafkajs",
    "kafka-python",
    "confluent-kafka",
    "github.com/segmentio/kafka-go"
  ),
  RabbitMQ: backend("amqplib", "pika"),
  NATS: backend("nats", "github.com/nats-io/nats.go"),

  // AI: models and providers
  OpenAI: data(
    "openai",
    "@openai/*",
    "@ai-sdk/openai",
    "async-openai",
    "github.com/openai/openai-go",
    "github.com/sashabaranov/go-openai"
  ),
  Anthropic: data(
    "anthropic",
    "@anthropic-ai/*",
    "@ai-sdk/anthropic",
    "github.com/anthropics/anthropic-sdk-go"
  ),
  "Claude Agent SDK": data(
    "@anthropic-ai/claude-agent-sdk",
    "@anthropic-ai/claude-code",
    "claude-agent-sdk"
  ),
  Gemini: data(
    "@google/generative-ai",
    "@google/genai",
    "@ai-sdk/google",
    "google-generativeai",
    "google-genai",
    "google.generativeai",
    "google.genai"
  ),
  "Vertex AI": data("@google-cloud/vertexai", "vertexai", "google-cloud-aiplatform"),
  Mistral: data("mistralai", "@mistralai/*", "@ai-sdk/mistral"),
  Groq: data("groq", "groq-sdk", "@ai-sdk/groq"),
  Cohere: data("cohere", "cohere-ai", "@ai-sdk/cohere"),
  "Together AI": data("together", "together-ai"),
  Replicate: data("replicate"),
  OpenRouter: data("@openrouter/*"),
  Ollama: data("ollama", "ollama-ai-provider"),
  "Hugging Face": data("@huggingface/*", "huggingface-hub"),
  fal: data("@fal-ai/*", "fal-client"),
  ElevenLabs: data("elevenlabs", "@elevenlabs/*", "@11labs/*"),
  Deepgram: data("deepgram-sdk", "@deepgram/*"),
  AssemblyAI: data("assemblyai"),
  Whisper: data("whisper", "openai-whisper", "faster-whisper"),
  Vapi: data("@vapi-ai/*", "vapi-python"),
  Pipecat: data("pipecat-ai", "pipecat"),

  // AI: frameworks and agent tooling
  "AI SDK": data("ai", "@ai-sdk/*"),
  LangChain: data("langchain", "langchain-*", "@langchain/*"),
  LangGraph: data("langgraph", "@langchain/langgraph"),
  LlamaIndex: data("llamaindex", "llama-index", "llama-index-*"),
  Mastra: data("mastra", "@mastra/*"),
  CrewAI: data("crewai"),
  AutoGen: data("autogen", "pyautogen", "autogen-agentchat"),
  "Pydantic AI": data("pydantic-ai"),
  DSPy: data("dspy", "dspy-ai"),
  Haystack: data("haystack-ai"),
  "Semantic Kernel": data("semantic-kernel"),
  LangChain4j: data(),
  MCP: data(
    "mcp",
    "fastmcp",
    "@modelcontextprotocol/*",
    "github.com/mark3labs/mcp-go"
  ),
  CopilotKit: data("@copilotkit/*"),
  "assistant-ui": data("@assistant-ui/*"),
  E2B: data("e2b", "@e2b/*", "e2b-code-interpreter"),
  Browserbase: data("browserbase", "@browserbasehq/*"),
  "Browser Use": data("browser-use"),
  Firecrawl: data("firecrawl", "firecrawl-py", "@mendable/firecrawl-js"),
  Tavily: data("tavily-python", "tavily", "@tavily/core"),
  Exa: data("exa-js", "exa-py"),

  // AI: vector stores
  Pinecone: data("pinecone", "pinecone-client", "@pinecone-database/*"),
  Qdrant: data("qdrant-client", "@qdrant/*"),
  Weaviate: data("weaviate-client", "weaviate-ts-client"),
  Chroma: data("chromadb"),
  pgvector: data("pgvector"),
  FAISS: data("faiss", "faiss-cpu", "faiss-gpu"),
  Milvus: data("pymilvus", "@zilliz/*"),
  LanceDB: data("lancedb", "@lancedb/*"),

  // Machine learning and data science
  PyTorch: data("torch", "pytorch", "torchvision", "torchaudio"),
  TensorFlow: data("tensorflow", "@tensorflow/*"),
  Keras: data("keras"),
  JAX: data("jax"),
  Transformers: data(
    "transformers",
    "@huggingface/transformers",
    "@xenova/transformers"
  ),
  Diffusers: data("diffusers"),
  "Sentence Transformers": data("sentence-transformers"),
  "scikit-learn": data("scikit-learn", "sklearn"),
  XGBoost: data("xgboost"),
  LightGBM: data("lightgbm"),
  OpenCV: data("cv2", "opencv-*", "@techstark/opencv-js"),
  MediaPipe: data("mediapipe", "@mediapipe/*"),
  YOLO: data("ultralytics"),
  spaCy: data("spacy"),
  NLTK: data("nltk"),
  ONNX: data("onnx", "onnxruntime", "onnxruntime-node", "onnxruntime-web"),
  vLLM: data("vllm"),
  "llama.cpp": data("llama-cpp-python", "node-llama-cpp"),
  MLflow: data("mlflow"),
  "Weights & Biases": data("wandb"),
  Pandas: data("pandas"),
  Polars: data("polars", "nodejs-polars"),
  NumPy: data("numpy"),
  SciPy: data("scipy"),
  Matplotlib: data("matplotlib"),
  Seaborn: data("seaborn"),
  Plotly: data("plotly", "plotly.js", "react-plotly.js"),
  Dash: data("dash"),
  Streamlit: data("streamlit"),
  Gradio: data("gradio"),
  Jupyter: data("jupyter", "jupyterlab", "notebook", "ipykernel"),
  DuckDB: data("duckdb", "@duckdb/*"),
  Spark: data("pyspark"),
  Airflow: data("apache-airflow"),
  dbt: data("dbt-*"),
  Dagster: data("dagster"),
  Prefect: data("prefect"),
  "Beautiful Soup": data("bs4", "beautifulsoup4"),
  Scrapy: data("scrapy"),

  // ORMs and query builders
  Prisma: data("prisma", "@prisma/*"),
  Drizzle: data("drizzle-orm", "drizzle-kit"),
  TypeORM: data("typeorm"),
  Sequelize: data("sequelize"),
  Kysely: data("kysely"),
  Knex: data("knex"),
  SQLAlchemy: data("sqlalchemy"),
  SQLModel: data("sqlmodel"),
  GORM: data("gorm.io/gorm"),
  Ent: data("entgo.io/ent"),
  Diesel: data("diesel"),
  SQLx: data("sqlx", "github.com/jmoiron/sqlx"),
  SeaORM: data("sea-orm"),
  Hibernate: data(),
  Exposed: data(),
  "EF Core": data(),
  Dapper: data(),
  Ecto: data("ecto", "ecto-sql"),

  // Databases and search
  Postgres: data(
    "pg",
    "pg-promise",
    "postgres",
    "@vercel/postgres",
    "psycopg",
    "psycopg2",
    "psycopg2-binary",
    "asyncpg",
    "github.com/jackc/pgx",
    "github.com/lib/pq",
    "tokio-postgres",
    "postgrex"
  ),
  Neon: data("@neondatabase/*"),
  MySQL: data(
    "mysql",
    "mysql2",
    "mysqlclient",
    "pymysql",
    "mysql-connector-python",
    "github.com/go-sql-driver/mysql"
  ),
  PlanetScale: data("@planetscale/*"),
  SQLite: data(
    "sqlite",
    "sqlite3",
    "better-sqlite3",
    "expo-sqlite",
    "aiosqlite",
    "rusqlite",
    "github.com/mattn/go-sqlite3"
  ),
  Turso: data("libsql", "@libsql/*"),
  MongoDB: data(
    "mongodb",
    "mongoose",
    "pymongo",
    "motor",
    "beanie",
    "mongoid",
    "go.mongodb.org/mongo-driver"
  ),
  Redis: data(
    "redis",
    "ioredis",
    "@vercel/kv",
    "github.com/redis/go-redis",
    "github.com/go-redis/redis"
  ),
  Upstash: data("@upstash/*", "upstash-redis"),
  DynamoDB: data("@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"),
  Neo4j: data("neo4j", "neo4j-driver"),
  ClickHouse: data("@clickhouse/*", "clickhouse-connect", "clickhouse-driver"),
  Elasticsearch: data("elasticsearch", "@elastic/*"),
  Meilisearch: data("meilisearch"),
  Algolia: data("algoliasearch"),
  Typesense: data("typesense"),

  // Auth, payments and other services
  "Auth.js": backend("next-auth", "@auth/*"),
  Clerk: backend("@clerk/*"),
  "Better Auth": backend("better-auth"),
  Auth0: backend("auth0", "@auth0/*"),
  Lucia: backend("lucia"),
  WorkOS: backend("workos", "@workos-inc/*"),
  Passport: backend("passport"),
  Stripe: backend("stripe", "@stripe/*"),
  "Lemon Squeezy": backend("@lemonsqueezy/*"),
  Polar: backend("@polar-sh/*"),
  PayPal: backend("@paypal/*"),
  Crossmint: backend("@crossmint/*"),
  Resend: backend("resend"),
  SendGrid: backend("sendgrid", "@sendgrid/*"),
  "React Email": backend("react-email", "@react-email/*"),
  Twilio: backend("twilio"),
  Discord: backend("discord.js", "discord.py", "discord", "serenity"),
  Telegram: backend(
    "telegraf",
    "grammy",
    "telegram",
    "python-telegram-bot",
    "aiogram"
  ),
  Slack: backend("@slack/*", "slack-sdk", "slack-bolt"),
  Notion: backend("@notionhq/*", "notion-client"),
  "GitHub API": backend("octokit", "@octokit/*", "pygithub"),
  "Google APIs": backend("googleapis", "google-api-python-client"),
  "Google Maps": frontend(
    "googlemaps",
    "@googlemaps/*",
    "@react-google-maps/api",
    "@vis.gl/react-google-maps"
  ),
  Mapbox: frontend("mapbox-gl", "react-map-gl", "@mapbox/*"),
  MapLibre: frontend("maplibre-gl"),
  Leaflet: frontend("leaflet", "react-leaflet", "folium"),
  Cloudinary: backend("cloudinary"),
  UploadThing: backend("uploadthing", "@uploadthing/*"),
  Sanity: backend("sanity", "next-sanity", "@sanity/*"),
  Contentful: backend("contentful"),
  Strapi: backend("@strapi/*"),
  Payload: backend("payload", "@payloadcms/*"),
  Shopify: backend("@shopify/*"),
  Sentry: other("sentry-sdk", "@sentry/*"),
  PostHog: other("posthog", "posthog-js", "posthog-node"),

  // Web3
  Hardhat: other("hardhat"),
  Foundry: other(),
  OpenZeppelin: other("@openzeppelin/*"),
  "ethers.js": other("ethers"),
  viem: other("viem"),
  wagmi: other("wagmi", "@wagmi/*"),
  Web3: other("web3"),
  RainbowKit: other("@rainbow-me/*"),
  thirdweb: other("thirdweb", "@thirdweb-dev/*"),
  Privy: other("@privy-io/*"),
  Alchemy: other("alchemy-sdk"),
  Solana: other("solana", "solana-sdk", "solana-program", "@solana/*"),
  Anchor: other("anchor-lang", "@coral-xyz/*", "@project-serum/anchor"),
  Metaplex: other("@metaplex-foundation/*"),
  Starknet: other("starknet"),
  Sui: other("@mysten/*"),

  // Cloud and infrastructure
  AWS: other(
    "aws-sdk",
    "@aws-sdk/*",
    "aws-cdk-lib",
    "boto3",
    "github.com/aws/aws-sdk-go",
    "github.com/aws/aws-sdk-go-v2"
  ),
  "Google Cloud": other("@google-cloud/*", "google-cloud-*", "google.cloud"),
  Azure: other("azure", "azure-*", "@azure/*"),
  Vercel: other("vercel", "@vercel/*"),
  Netlify: other("@netlify/*"),
  "Fly.io": other(),
  Railway: other(),
  Render: other(),
  Modal: other("modal"),
  SST: other("sst"),
  Serverless: other("serverless"),
  Docker: other(),
  Kubernetes: other("kubernetes", "@kubernetes/*", "k8s.io/client-go"),
  Terraform: other(),
  Pulumi: other("pulumi", "@pulumi/*"),
  "GitHub Actions": other(),
  Nginx: other(),

  // UI libraries
  "shadcn/ui": frontend("shadcn", "shadcn-ui"),
  "Radix UI": frontend("radix-ui", "@radix-ui/*"),
  MUI: frontend("@mui/*"),
  "Chakra UI": frontend("@chakra-ui/*"),
  Mantine: frontend("@mantine/*"),
  "Ant Design": frontend("antd"),
  HeroUI: frontend("@heroui/*", "@nextui-org/*"),
  "Headless UI": frontend("@headlessui/*"),
  daisyUI: frontend("daisyui"),
  Bootstrap: frontend("bootstrap", "react-bootstrap"),
  "styled-components": frontend("styled-components"),
  Emotion: frontend("@emotion/*"),
  Sass: frontend("sass"),
  Motion: frontend("motion", "framer-motion"),
  GSAP: frontend("gsap"),
  D3: frontend("d3"),
  Recharts: frontend("recharts"),
  "Chart.js": frontend("chart.js", "react-chartjs-2"),
  "React Flow": frontend("reactflow", "@xyflow/*"),
  Tiptap: frontend("@tiptap/*"),
  Remotion: frontend("remotion", "@remotion/*"),

  // State and data fetching
  "TanStack Query": frontend(
    "react-query",
    "@tanstack/react-query",
    "@tanstack/vue-query",
    "@tanstack/svelte-query",
    "@tanstack/solid-query"
  ),
  "TanStack Router": frontend("@tanstack/react-router"),
  SWR: frontend("swr"),
  Redux: frontend("redux", "react-redux", "@reduxjs/*"),
  Zustand: frontend("zustand"),
  Jotai: frontend("jotai"),
  MobX: frontend("mobx"),
  Pinia: frontend("pinia"),
  XState: frontend("xstate"),
  "React Navigation": frontend("@react-navigation/*"),

  // Build, monorepo and testing
  Webpack: other("webpack"),
  Turborepo: other("turbo"),
  Nx: other("nx", "@nx/*"),
  Storybook: other("storybook", "@storybook/*"),
  Playwright: other("playwright", "playwright-core", "@playwright/*"),
  Puppeteer: other("puppeteer", "puppeteer-core"),
  Selenium: other("selenium", "selenium-webdriver"),
  Cypress: other("cypress"),
  Vitest: other("vitest"),
  Jest: other("jest"),
  "Testing Library": other("@testing-library/*"),
  pytest: other("pytest"),
};

/** The form every package name is compared in: pip treats `_` and `-` alike. */
export function normalizePackage(raw: string): string {
  return raw.trim().toLowerCase().replaceAll("_", "-");
}

/** Package names claimed by two technologies. Must stay empty (tested). */
export const CATALOG_DUPLICATES: string[] = [];

const exact = new Map<string, string>();
const prefixes: [string, string][] = [];
for (const [tag, tech] of Object.entries(CATALOG)) {
  for (const raw of tech.packages) {
    const name = normalizePackage(raw);
    if (name.endsWith("*")) {
      prefixes.push([name.slice(0, -1), tag]);
    } else if (exact.has(name)) {
      CATALOG_DUPLICATES.push(name);
    } else {
      exact.set(name, tag);
    }
  }
}
export const PACKAGE_TAGS: ReadonlyMap<string, string> = exact;
// Longest first: the more specific prefix wins.
export const PACKAGE_PREFIX_TAGS: readonly [string, string][] =
  prefixes.toSorted((a, b) => b[0].length - a[0].length);
export const PRODUCT_ORDER = Object.keys(CATALOG);

export function stackCategory(name: string): StackCategory {
  return CATALOG[name]?.category ?? "Otras";
}
