import { expect, test } from "bun:test";
import { readLimitedBody } from "./limited-body";

test("reads a body exactly at the limit", async () => {
  const request = new Request("https://example.test/upload", {
    body: new Uint8Array([1, 2, 3]),
    method: "POST",
  });
  expect(new Uint8Array((await readLimitedBody(request, 3)) ?? new ArrayBuffer(0))).toEqual(
    new Uint8Array([1, 2, 3])
  );
});

test("stops reading as soon as a streamed body exceeds the limit", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([1, 2]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test/upload", {
    body,
    method: "POST",
  });
  expect(await readLimitedBody(request, 3)).toBeNull();
  expect(cancelled).toBe(true);
});
