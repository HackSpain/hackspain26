import { api } from "@convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST raw image bytes with the right Content-Type and a bearer token.
 * The server asks Convex for an upload URL, forwards the bytes, and returns
 * the storage id to pass to feed:post. The CLI never talks to Convex.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return fail("No has iniciado sesión", 401);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED.has(contentType)) {
    return fail("Solo JPEG, PNG, WebP o GIF", 415);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) {
    return fail("La imagen no puede superar 5 MB", 413);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return fail("La imagen no puede superar 5 MB", 413);
  }
  try {
    const uploadUrl = await fetchMutation(
      api.feed.generateUploadUrl,
      {},
      { token },
    );
    const stored = await fetch(uploadUrl, {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes,
    });
    if (!stored.ok) {
      return fail(`Storage answered ${stored.status}`, 502);
    }
    const { storageId } = (await stored.json()) as { storageId: string };
    return ok({ imageId: storageId });
  } catch (err) {
    return fromError(err);
  }
}
