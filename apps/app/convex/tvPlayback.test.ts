import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { heartbeat, reloadScreen, screens, setScreen } from "./tvPlayback";

type Row = Record<string, unknown> & { _id: string; table: string };
function venue() {
  let serial = 0;
  let admin = true;
  const rows = new Map<string, Row>([["operator", { _id: "operator", table: "users", role: "admin" }]]);
  const ctx = {
    auth: { getUserIdentity: async () => admin ? { subject: "operator" } : null },
    db: {
      query(table: string) {
        let matches = [...rows.values()].filter((row) => row.table === table);
        const result = {
          withIndex(_name: string, filter: (q: { eq: (key: string, value: unknown) => void }) => void) {
            filter({ eq(key, value) { matches = matches.filter((row) => row[key] === value); } });
            return result;
          },
          unique: async () => matches[0] ?? null,
          collect: async () => matches,
        };
        return result;
      },
      get: async (id: string) => rows.get(id) ?? null,
      async insert(table: string, value: Record<string, unknown>) {
        const id = `row-${++serial}`;
        rows.set(id, { ...value, _id: id, table });
        return id;
      },
      async patch(id: string, patch: Record<string, unknown>) { Object.assign(rows.get(id) ?? {}, patch); },
      async delete(id: string) { rows.delete(id); },
    },
  } as unknown as MutationCtx;
  const ping = (key: string, clientId = "client-1234567890", receivedRevision = 0, receivedReloadVersion = 0) => heartbeat._handler(ctx, {
    key, clientId, initialPreset: "entradas", width: 2560, height: 1080,
    url: `https://hackspain.app/tv?screen=${key}&token=private`, receivedRevision, receivedReloadVersion,
  });
  return { ctx, ping, anonymous: () => { admin = false; } };
}

test("screens register by URL and retain separate commands and reload versions", async () => {
  const { ctx, ping } = venue();
  await ping("entrada");
  await ping("auditorio", "client-0987654321");
  await setScreen._handler(ctx, { key: "entrada", preset: "avisos", message: "Comenzamos en 5 minutos" });
  await reloadScreen._handler(ctx, { key: "entrada" });
  const next = await ping("entrada");
  assert.deepEqual(next, { preset: "avisos", message: "Comenzamos en 5 minutos", revision: 1, reloadVersion: 1 });
  const other = await ping("auditorio", "client-0987654321");
  assert.equal(other.preset, "entradas");
  assert.equal(other.reloadVersion, 0);
  // A heartbeat's URL preset cannot undo an admin command.
  assert.equal((await ping("entrada", "client-1234567890", 1, 1)).preset, "avisos");
  const list = await screens._handler(ctx, {});
  const entry = list.screens.find((row) => row.key === "entrada");
  assert.equal(entry?.connections[0].receivedRevision, 1);
  assert.equal(entry?.connections[0].receivedReloadVersion, 1);
  assert.equal(entry?.connections[0].width, 2560);
  assert.equal(entry?.connections[0].url, "https://hackspain.app/tv?screen=entrada");
});

test("multiple devices with the same name are visible and share only that name's config", async () => {
  const { ctx, ping } = venue();
  await setScreen._handler(ctx, { key: "Entrada", preset: "patrocinadores", message: "" });
  await ping("entrada", "first-1234567890");
  await ping("entrada", "second-1234567890");
  const result = await screens._handler(ctx, {});
  assert.equal(result.screens.length, 1);
  assert.equal(result.screens[0].connections.length, 2);
  assert.equal(result.screens[0].preset, "patrocinadores");
});

test("kiosks cannot issue admin commands, while anonymous presence remains available", async () => {
  const { ctx, ping, anonymous } = venue();
  anonymous();
  await ping("entrada");
  await assert.rejects(setScreen._handler(ctx, { key: "entrada", preset: "avisos", message: "No" }), /sesión/);
  await assert.rejects(reloadScreen._handler(ctx, { key: "entrada" }), /sesión/);
  await assert.rejects(screens._handler(ctx, {}), /sesión/);
  assert.equal((await ping("entrada")).preset, "entradas");
});

test("invalid identifiers and messages are rejected without creating extra screens", async () => {
  const { ctx, ping } = venue();
  await assert.rejects(ping("bad/name"), /letras/);
  await assert.rejects(setScreen._handler(ctx, { key: "entrada", preset: "avisos", message: "x".repeat(501) }), /500/);
  assert.equal((await screens._handler(ctx, {})).screens.length, 0);
});
