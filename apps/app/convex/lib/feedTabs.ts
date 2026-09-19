import { v } from "convex/values";
import type { Infer } from "convex/values";

/** Home feed tabs: what people write, what GitHub pushes, and posts tagged #meme. */
export const feedTabValidator = v.union(
  v.literal("posts"),
  v.literal("github"),
  v.literal("meme")
);
export type FeedTab = Infer<typeof feedTabValidator>;

/** `#meme` or `#memes` as a hashtag of its own, not inside a word or a longer tag. */
const MEME_TAG = /(^|[^\p{L}\p{N}_#])#memes?(?![\p{L}\p{N}_])/iu;

export function hasMemeTag(text: string): boolean {
  return MEME_TAG.test(text);
}
