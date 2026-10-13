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
  const cuerpo = await res.json();
  assert.equal(cuerpo.estado, "ok");
  assert.equal(cuerpo.servicio, "mitienda-api");
  assert.ok(cuerpo.ambiente);
  assert.ok(cuerpo.uptime_segundos >= 0);
});

test("GET /metrics expone métricas Prometheus y cuenta las peticiones", async () => {
  await fetch(`${base}/pedidos/abc/venta`, { method: "POST" }); // genera un 401
  const res = await fetch(`${base}/metrics`);
  assert.equal(res.status, 200);
  const texto = await res.text();
  assert.match(texto, /# TYPE mitienda_peticiones_total counter/);
  assert.match(texto, /ruta="\/pedidos\/:id\/venta",estado="401"\} 1/);
  assert.match(texto, /mitienda_uptime_segundos/);
});

test("POST /pedidos sin token devuelve 401", async () => {
  const res = await fetch(`${base}/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ negocio_id: "n1" }),
  });
  assert.equal(res.status, 401);
});

test("POST /pedidos ignora un cliente_id enviado en el body (sigue exigiendo token)", async () => {
  const res = await fetch(`${base}/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ negocio_id: "n1", cliente_id: "otra-persona" }),
  });
  assert.equal(res.status, 401);
});

test("POST /pedidos/:id/venta sin token devuelve 401", async () => {
  const res = await fetch(`${base}/pedidos/abc/venta`, { method: "POST" });
  assert.equal(res.status, 401);
});