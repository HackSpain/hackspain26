import { readFileSync, statSync } from "node:fs";
import type { Command } from "commander";
import { api, uploadImage } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import { imageContentType, postLines } from "../lib/feed-format";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";

const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function registerFeed(program: Command): void {
  program
    .command("feed")
    .description("What everyone is posting, plus pushes from every team's repo")
    .option("-n, --limit <count>", "how many posts", "20")
    .action(async (opts: { limit: string }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const limit = Number.parseInt(opts.limit, 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw usageError(
          `--limit must be a positive number, got "${opts.limit}".`
        );
      }
      const { session } = await openParticipant(ctx);
      const posts = await ui.spin(
        "Loading the feed…",
        () => session.client.query(api.feed.list, { limit }),
        "Feed"
      );
      ui.result(posts);
      if (posts.length === 0) {
        ui.info(
          'Nothing posted yet. Be the first: hackspain post "we are alive"'
        );
        return;
      }
      const now = Date.now();
      for (const post of posts) {
        ui.line(postLines(post, now).join("\n"));
      }
      ui.next([
        ['hackspain post "text" --image photo.jpg', "post something yourself"],
        ["hackspain watch", "see new posts as they land"],
      ]);
    });

  program
    .command("post [text...]")
    .description("Post to the feed: a short update, optionally with an image")
    .option("-i, --image <file>", "jpg, png, webp or gif, up to 5 MB")
    .action(
      async (words: string[], opts: { image?: string }, command: Command) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const text = words.join(" ").trim();
        if (!(text || opts.image)) {
          throw usageError(
            "Nothing to post.",
            'Give some text, an image, or both: hackspain post "shipping!" --image demo.png'
          );
        }
        if (text.length > MAX_TEXT) {
          throw usageError(
            `Keep it under ${MAX_TEXT} characters (you have ${text.length}).`
          );
        }
        const { session } = await openParticipant(ctx);
        let imageId: string | undefined;
        const imagePath = opts.image;
        if (imagePath) {
          const contentType = imageContentType(imagePath);
          let size: number;
          try {
            size = statSync(imagePath).size;
          } catch {
            throw usageError(`Cannot read ${imagePath}.`);
          }
          if (size > MAX_IMAGE_BYTES) {
            throw usageError("Images must be 5 MB or smaller.");
          }
          imageId = await ui.spin(
            "Uploading image…",
            () =>
              uploadImage(
                session,
                new Uint8Array(readFileSync(imagePath)),
                contentType
              ),
            "Image uploaded"
          );
        }
        const id = await ui.spin(
          "Posting…",
          () =>
            session.client.mutation(api.feed.post, {
              text,
              imageId: imageId as never,
            }),
          "Posted"
        );
        ui.result({ id, text, image: Boolean(imageId) });
        ui.celebrate("Posted to the feed.");
        ui.next([["hackspain feed", "see it alongside everyone else's"]]);
      }
    );
}
