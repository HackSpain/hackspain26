import { readFileSync, statSync } from "node:fs";
import { confirm } from "@clack/prompts";
import type { Command } from "commander";
import type { Session } from "../lib/api";
import { api, fetchImage, uploadImage } from "../lib/api";
import { contextFor } from "../lib/context";
import { usageError } from "../lib/errors";
import type { FeedItem } from "../lib/feed-format";
import { imageContentType, postLines, withImageUrls } from "../lib/feed-format";
import { uiFor } from "../lib/output";
import { openParticipant } from "../lib/participant";
import { guard } from "../lib/prompts";
import { c, cmd } from "../lib/style";
import type { ImageProtocol } from "../lib/term-images";
import {
  detectImageProtocol,
  IMAGE_COLUMNS,
  PIXELS_PER_COLUMN,
  renderImage,
} from "../lib/term-images";

const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FETCH_CONCURRENCY = 4;
const DIGITS_ONLY = /^\d+$/;

/**
 * `--before` takes the cursor a previous page printed (the oldest post's
 * createdAt in ms) or any ISO date. Undefined means "from the newest".
 */
export function parseBefore(raw?: string): number | undefined {
  if (raw === undefined) {
    return;
  }
  const value = raw.trim();
  let parsed = Number.NaN;
  if (DIGITS_ONLY.test(value)) {
    // A ms cursor; a short digit run is a typo, not a year.
    if (value.length >= 10) {
      parsed = Number(value);
    }
  } else {
    parsed = Date.parse(value);
  }
  if (!Number.isFinite(parsed)) {
    throw usageError(
      `--before must be a timestamp in ms or an ISO date, got "${raw}".`,
      "The end of a page prints the exact value to pass."
    );
  }
  return parsed;
}

/**
 * Escape sequences that draw each post's picture, keyed by post id, for the
 * posts whose thumbnail we managed to fetch. Missing entries fall back to the
 * link. Fetched a few at a time so a slow venue network does not stall.
 */
async function renderImages(
  session: Session,
  posts: FeedItem[],
  protocol: ImageProtocol
): Promise<Map<string, string>> {
  const rendered = new Map<string, string>();
  const queue = posts.filter((post) => post.imagePath);
  const width = IMAGE_COLUMNS * PIXELS_PER_COLUMN;
  const worker = async () => {
    for (;;) {
      const post = queue.shift();
      if (!post?.imagePath) {
        return;
      }
      const png = await fetchImage(session, post.imagePath, width);
      const sequence = png ? renderImage(protocol, png) : null;
      if (sequence) {
        rendered.set(post._id, sequence);
      }
    }
  };
  await Promise.all(
    Array.from({ length: IMAGE_FETCH_CONCURRENCY }, () => worker())
  );
  return rendered;
}

export function registerFeed(program: Command): void {
  program
    .command("feed")
    .description("What everyone is posting, plus pushes from every team's repo")
    .option("-n, --limit <count>", "how many posts", "20")
    .option(
      "--no-images",
      "print image links even in terminals that could draw them"
    )
    .option(
      "--before <when>",
      "older posts only: the cursor a previous page printed, or an ISO date"
    )
    .action(
      async (
        opts: { limit: string; images: boolean; before?: string },
        command: Command
      ) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const limit = Number.parseInt(opts.limit, 10);
        if (!Number.isFinite(limit) || limit <= 0) {
          throw usageError(
            `--limit must be a positive number, got "${opts.limit}".`
          );
        }
        let before = parseBefore(opts.before);
        const { session } = await openParticipant(ctx);
        // Kitty/iTerm2-protocol terminals get the picture inline; everyone
        // else keeps the link. Never in --json or when piped.
        const protocol = opts.images
          ? detectImageProtocol(process.env, ctx.interactive)
          : null;

        // One page per loop; on a TTY we offer the next older page, while
        // scripts get the cursor to pass as --before.
        let firstPage = true;
        for (;;) {
          const cursor = before;
          const posts = withImageUrls(
            await ui.spin(
              firstPage ? "Loading the feed…" : "Loading older posts…",
              () =>
                session.client.query(api.feed.list, {
                  limit,
                  ...(cursor === undefined ? {} : { before: cursor }),
                }),
              firstPage ? "Feed" : "Older posts"
            ),
            session.url
          );
          if (firstPage) {
            ui.result(posts);
          }
          if (posts.length === 0) {
            ui.info(
              firstPage && before === undefined
                ? 'Nothing posted yet. Be the first: hackspain post "we are alive"'
                : "That was the oldest post there is."
            );
            break;
          }
          const images = protocol
            ? await ui.spin(
                "Fetching images…",
                () => renderImages(session, posts, protocol),
                "Images ready"
              )
            : new Map<string, string>();
          const now = Date.now();
          for (const post of posts) {
            const image = images.get(post._id);
            ui.line(
              postLines(
                image ? { ...post, imageUrl: undefined } : post,
                now
              ).join("\n")
            );
            if (image) {
              ui.raw(`${c.dim("│")}     ${image}\n`);
            }
          }
          const oldest = posts.at(-1);
          if (posts.length < limit || !oldest) {
            if (!firstPage) {
              ui.line(c.dim("That was the oldest post there is."));
            }
            break;
          }
          if (!ctx.interactive) {
            ui.line(
              c.dim(
                `Older posts: ${cmd(`hackspain feed --before ${oldest.createdAt}`)}`
              )
            );
            break;
          }
          const more = guard(
            await confirm({ initialValue: true, message: "Show older posts?" })
          );
          if (!more) {
            break;
          }
          before = oldest.createdAt;
          firstPage = false;
        }
        ui.next([
          [
            'hackspain post "text" --image photo.jpg',
            "post something yourself",
          ],
          ["hackspain watch", "see new posts as they land"],
        ]);
      }
    );

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
              imageId: imageId as never,
              text,
            }),
          "Posted"
        );
        ui.result({ id, image: Boolean(imageId), text });
        ui.celebrate("Posted to the feed.");
        ui.next([["hackspain feed", "see it alongside everyone else's"]]);
      }
    );
}
