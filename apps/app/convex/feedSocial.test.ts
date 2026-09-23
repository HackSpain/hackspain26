import { expect, test } from "bun:test";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { checkedMentions } from "./feedSocial";

test("a mention links only to the user whose name appears in the text", async () => {
  const aliceId = "alice" as Id<"users">;
  const bobId = "bob" as Id<"users">;
  const users = new Map([
    [aliceId, { name: "Alice" }],
    [bobId, { name: "Bob" }],
  ]);
  const ctx = {
    db: {
      get: async (id: Id<"users">) => users.get(id) ?? null,
    },
  } as unknown as MutationCtx;

  expect(
    await checkedMentions(ctx, "Hola @Alice", [{ name: "Alice", userId: bobId }])
  ).toBeUndefined();
  expect(
    await checkedMentions(ctx, "Hola @bob", [{ name: "bob", userId: bobId }])
  ).toEqual([{ name: "bob", userId: bobId }]);
  expect(
    await checkedMentions(ctx, "Hola @Alice", [{ name: "Alice", userId: aliceId }])
  ).toEqual([{ name: "Alice", userId: aliceId }]);
});
