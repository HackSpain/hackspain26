import { describe, expect, test } from "bun:test";
import { mentionQueryAt, mentionSegments, mentionsInText, normalizeEmoji } from "./feedSocial";

describe("normalizeEmoji", () => {
  test("takes exactly one emoji, whatever it is made of", () => {
    for (const emoji of ["👍", "❤️", "🔥", "👩‍💻", "👍🏽", "🇪🇸", "#️⃣", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🫠"]) {
      expect(normalizeEmoji(` ${emoji} `)).toBe(emoji);
    }
  });

  test("refuses text, several emoji and nothing at all", () => {
    for (const input of ["", "  ", "ok", "👍👍", "👍 ok", ":fire:", "7", "<b>"]) {
      expect(normalizeEmoji(input)).toBeNull();
    }
  });
});

describe("mentions", () => {
  const ana = { name: "Ana", userId: "u1" };
  const anaMaria = { name: "Ana María", userId: "u2" };

  test("only mentions still written in the text survive, once each", () => {
    expect(mentionsInText("hola @Ana, mira", [ana, anaMaria, ana])).toEqual([ana]);
    expect(mentionsInText("hola @Anabel", [ana])).toEqual([]);
    expect(mentionsInText("sin nadie", [ana])).toEqual([]);
  });

  test("the longer name wins where two overlap", () => {
    expect(mentionSegments("@Ana María y @Ana!", [ana, anaMaria])).toEqual([
      { mention: anaMaria, text: "@Ana María" },
      { text: " y " },
      { mention: ana, text: "@Ana" },
      { text: "!" },
    ]);
    expect(mentionSegments("nada que ver", [ana])).toEqual([{ text: "nada que ver" }]);
  });

  test("finds the name being typed before the caret", () => {
    expect(mentionQueryAt("hola @an", 8)).toEqual({ query: "an", start: 5 });
    expect(mentionQueryAt("@Ana Mar", 8)).toEqual({ query: "Ana Mar", start: 0 });
    expect(mentionQueryAt("mail@an", 7)).toBeNull();
    expect(mentionQueryAt("@ana dijo que no viene", 22)).toBeNull();
    expect(mentionQueryAt("sin arroba", 5)).toBeNull();
  });
});
