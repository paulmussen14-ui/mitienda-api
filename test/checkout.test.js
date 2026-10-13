import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCheckout } from "../src/checkout.js";
import { ErrorApi } from "../src/errores.js";

const rechaza = (cuerpo) => assert.throws(() => validarCheckout(cuerpo), ErrorApi);

test("sin datos: recojo en tienda y efectivo", () => {
  const r = validarCheckout({});
  assert.equal(r.entrega.tipo, "recojo");
  assert.equal(r.pago.metodo, "efectivo");
  assert.equal(r.pago.estado, "Pendiente");
  assert.equal(r.pago.simulado, true);
});

test("delivery exige dirección", () => {
  rechaza({ entrega: { tipo: "delivery" } });
  rechaza({ entrega: { tipo: "delivery", direccion: "abc" } });
  const r = validarCheckout({ entrega: { tipo: "delivery", direccion: "  Av. Lima 123  ", nota: "Timbre malo" } });
  assert.equal(r.entrega.direccion, "Av. Lima 123");
  assert.equal(r.entrega.nota, "Timbre malo");
});

test("tipo de entrega y método de pago inválidos se rechazan", () => {
  rechaza({ entrega: { tipo: "dron" } });
  rechaza({ pago: { metodo: "bitcoin" } });
});

test("yape/plin exigen código de operación de 6 a 12 dígitos y quedan pagados (simulado)", () => {
  rechaza({ pago: { metodo: "yape" } });
  rechaza({ pago: { metodo: "plin", codigo_operacion: "12ab56" } });
  const r = validarCheckout({ pago: { metodo: "yape", codigo_operacion: "123456789" } });
  assert.equal(r.pago.estado, "Pagado");
  assert.equal(r.pago.referencia, "123456789");
});

test("tarjeta: solo se aceptan los últimos 4 dígitos; el número completo se rechaza", () => {
  rechaza({ pago: { metodo: "tarjeta" } });
  rechaza({ pago: { metodo: "tarjeta", ultimos4: "4242424242424242" } });
  const r = validarCheckout({ pago: { metodo: "tarjeta", ultimos4: "4242" } });
  assert.equal(r.pago.referencia, "****4242");
  assert.equal(r.pago.estado, "Pagado");
});
