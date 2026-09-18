import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import sharp from "sharp";
import { api } from "../convex/_generated/api";
import { PHOTO_WIDTH } from "../convex/lib/photo";

/**
 * Gives every uploaded profile picture the small square copy the map draws
 * (convex/lib/photo.ts). New uploads make theirs in the browser; this covers
 * the ones from before. Idempotent: people who already have a thumbnail are
 * skipped, and a picture changed mid-run is left alone by the server.
 *
 *   pnpm --filter app backfill:avatars
 *
 * Needs NEXT_PUBLIC_CONVEX_URL and MIGRATION_SECRET from apps/app/.env.local
 * (shell exports win), the same as the Neon import.
 */
const repoRoot = resolve(import.meta.dirname, "../../..");

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const trimmed = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(repoRoot, "apps/app/.env.local"));

async function main(): Promise<void> {
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  const secret = process.env.MIGRATION_SECRET;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  if (!secret) {
    throw new Error("MIGRATION_SECRET is not set");
  }
  const convex = new ConvexHttpClient(convexUrl);
  const pending = await convex.query(api.migrations.listAvatarsWithoutThumbnail, {
    secret,
  });
  console.log(`${pending.length} pictures without a thumbnail`);
  let done = 0;
  let skipped = 0;
  for (const { userId, avatarId, url } of pending) {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      console.warn(`skip ${userId}: picture returned ${upstream.status}`);
      skipped += 1;
      continue;
    }
    let thumbnail: Buffer;
    try {
      thumbnail = await sharp(Buffer.from(await upstream.arrayBuffer()), {
        animated: false,
      })
        .rotate()
        .resize({ fit: "cover", height: PHOTO_WIDTH, width: PHOTO_WIDTH })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      console.warn(`skip ${userId}: cannot resize (${String(error)})`);
      skipped += 1;
      continue;
    }
    const uploadUrl = await convex.mutation(
      api.migrations.avatarThumbnailUploadUrl,
      { secret }
    );
    const upload = await fetch(uploadUrl, {
      body: new Uint8Array(thumbnail),
      headers: { "Content-Type": "image/webp" },
      method: "POST",
    });
    if (!upload.ok) {
      throw new Error(`upload failed for ${userId}: ${upload.status}`);
    }
    const { storageId } = (await upload.json()) as { storageId: string };
    const attached = await convex.mutation(api.migrations.setAvatarThumbnail, {
      avatarId,
      secret,
      thumbId: storageId as (typeof pending)[number]["avatarId"],
      userId,
    });
    if (attached) {
      done += 1;
    } else {
      skipped += 1;
    }
  }
  console.log(`done: ${done} thumbnails stored, ${skipped} skipped`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
