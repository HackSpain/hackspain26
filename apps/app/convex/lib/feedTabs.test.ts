import { describe, expect, test } from "bun:test";
import { hasMemeTag } from "./feedTabs";

describe("hasMemeTag", () => {
  test("finds the hashtag anywhere in the text", () => {
    expect(hasMemeTag("#meme")).toBe(true);
    expect(hasMemeTag("Cuando el deploy falla a las 4am #MEME")).toBe(true);
    expect(hasMemeTag("mirad esto\n#memes, de nada")).toBe(true);
    expect(hasMemeTag("(#meme)")).toBe(true);
  });

  test("ignores lookalikes", () => {
    expect(hasMemeTag("un meme sin etiqueta")).toBe(false);
    expect(hasMemeTag("#memento")).toBe(false);
    expect(hasMemeTag("#meme_team")).toBe(false);
    expect(hasMemeTag("hola#meme")).toBe(false);
    expect(hasMemeTag("##meme")).toBe(false);
  });
});
