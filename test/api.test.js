import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../src/app.js";

let servidor;
let base;

before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

test("GET /health responde ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { estado: "ok", servicio: "mitienda-api" });
});

test("POST /pedidos sin datos devuelve 400", async () => {
  const res = await fetch(`${base}/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test("POST /pedidos/:id/venta sin token devuelve 401", async () => {
  const res = await fetch(`${base}/pedidos/abc/venta`, { method: "POST" });
  assert.equal(res.status, 401);
});