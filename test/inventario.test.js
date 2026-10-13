import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../src/app.js";
import { validarMovimiento } from "../src/inventario.js";
import { ErrorApi } from "../src/errores.js";

let servidor;
let base;

before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

test("POST /inventario/movimientos sin token devuelve 401", async () => {
  const res = await fetch(`${base}/inventario/movimientos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ producto_id: "p1", tipo: "entrada", cantidad: 5 }),
  });
  assert.equal(res.status, 401);
});

test("validarMovimiento normaliza un movimiento válido", () => {
  const r = validarMovimiento({ producto_id: " p1 ", tipo: "salida", cantidad: 3, motivo: "  Merma  " });
  assert.deepEqual(r, { productoId: "p1", tipo: "salida", cantidad: 3, motivo: "Merma" });
});

test("validarMovimiento usa «Sin especificar» si no hay motivo", () => {
  assert.equal(validarMovimiento({ producto_id: "p1", tipo: "entrada", cantidad: 1 }).motivo, "Sin especificar");
});

test("validarMovimiento recorta el motivo a 100 caracteres", () => {
  const r = validarMovimiento({ producto_id: "p1", tipo: "entrada", cantidad: 1, motivo: "x".repeat(300) });
  assert.equal(r.motivo.length, 100);
});

for (const [nombre, cuerpo] of [
  ["sin producto_id", { tipo: "entrada", cantidad: 1 }],
  ["producto_id con barra", { producto_id: "a/b", tipo: "entrada", cantidad: 1 }],
  ["tipo desconocido", { producto_id: "p1", tipo: "ajuste", cantidad: 1 }],
  ["cantidad cero", { producto_id: "p1", tipo: "entrada", cantidad: 0 }],
  ["cantidad negativa", { producto_id: "p1", tipo: "salida", cantidad: -2 }],
  ["cantidad decimal", { producto_id: "p1", tipo: "entrada", cantidad: 1.5 }],
  ["cantidad como texto", { producto_id: "p1", tipo: "entrada", cantidad: "5" }],
  ["cantidad enorme", { producto_id: "p1", tipo: "entrada", cantidad: 1e9 }],
]) {
  test(`validarMovimiento rechaza ${nombre} con 400`, () => {
    assert.throws(
      () => validarMovimiento(cuerpo),
      (e) => e instanceof ErrorApi && e.estado === 400
    );
  });
}
