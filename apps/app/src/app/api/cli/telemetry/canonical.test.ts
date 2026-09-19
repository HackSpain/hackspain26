import { describe, expect, test } from "bun:test";
import {
  canonicalModel,
  modelName,
  modelProvider,
  totalTokens,
} from "./canonical";

describe("modelName", () => {
  test("the same model reads the same from every harness and gateway", () => {
    for (const raw of [
      "claude-sonnet-4-5-20250929",
      "anthropic/claude-sonnet-4.5",
      "claude-sonnet-4-5@20250929",
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "Claude-Sonnet-4.5",
    ]) {
      expect(modelName(raw)).toBe("claude-sonnet-4-5");
    }
    expect(modelName("models/gemini-2.5-pro")).toBe("gemini-2-5-pro");
    expect(modelName("gemini-2.5-pro")).toBe("gemini-2-5-pro");
    expect(modelName("qwen/qwen3-coder:free")).toBe("qwen3-coder");
    expect(modelName("gpt-5-2025-08-07")).toBe("gpt-5");
    expect(modelName("gpt-5")).toBe("gpt-5");
  });

  test("never empty", () => {
    expect(modelName("  ")).toBe("unknown");
    expect(modelName("big-pickle")).toBe("big-pickle");
  });
});

describe("modelProvider", () => {
  test("the harness's provider as a slug, aliases folded", () => {
    expect(modelProvider("OpenRouter", "claude")).toBe("openrouter");
    expect(modelProvider("openai-native", "gpt")).toBe("openai");
    expect(modelProvider("Vertex AI", "gemini")).toBe("vertex");
  });

  test("always a value: the model's maker when the harness says nothing", () => {
    expect(modelProvider(undefined, "claude")).toBe("anthropic");
    expect(modelProvider("", "qwen")).toBe("alibaba");
    expect(modelProvider(undefined, "other")).toBe("unknown");
  });
});

test("canonicalModel keeps the raw string next to the derived fields", () => {
  expect(canonicalModel("anthropic/claude-sonnet-4.5", "openrouter")).toEqual({
    family: "claude",
    name: "claude-sonnet-4-5",
    provider: "openrouter",
    raw: "anthropic/claude-sonnet-4.5",
  });
});

test("totalTokens never counts reasoning twice", () => {
  expect(
    totalTokens({ cacheRead: 4, cacheWrite: 5, input: 2, output: 3, reasoning: 1 })
  ).toBe(14);
});
