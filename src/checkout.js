import { ErrorApi } from "./errores.js";

export const TIPOS_ENTREGA = ["recojo", "delivery"];
export const METODOS_PAGO = ["efectivo", "yape", "plin", "tarjeta"];

function texto(valor, maximo) {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
}

/* Valida y normaliza los datos de entrega y pago del pedido.
   Los pagos son una SIMULACIÓN académica: no se cobra nada ni se reciben datos de tarjeta
   (de la tarjeta solo llegan los últimos 4 dígitos). Si el cliente no envía nada, se
   asume recojo en tienda y pago en efectivo (compatibilidad con el frontend anterior). */
export function validarCheckout(cuerpo = {}) {
  const entregaIn = cuerpo.entrega ?? { tipo: "recojo" };
  const pagoIn = cuerpo.pago ?? { metodo: "efectivo" };

  // ---- Entrega
  const tipo = entregaIn.tipo;
  if (!TIPOS_ENTREGA.includes(tipo)) {
    throw new ErrorApi(400, "Tipo de entrega no válido.");
  }
  const entrega = { tipo, direccion: null, nota: texto(entregaIn.nota, 140) || null };
  if (tipo === "delivery") {
    const direccion = texto(entregaIn.direccion, 150);
    if (direccion.length < 5) {
      throw new ErrorApi(400, "Escribe la dirección de entrega (mínimo 5 caracteres).");
    }
    entrega.direccion = direccion;
  }

  // ---- Pago (simulado)
  const metodo = pagoIn.metodo;
  if (!METODOS_PAGO.includes(metodo)) {
    throw new ErrorApi(400, "Método de pago no válido.");
  }

  const pago = { metodo, estado: "Pendiente", simulado: true, referencia: null };

  if (metodo === "yape" || metodo === "plin") {
    const codigo = texto(String(pagoIn.codigo_operacion ?? ""), 20);
    if (!/^\d{6,12}$/.test(codigo)) {
      throw new ErrorApi(400, "El código de operación debe tener entre 6 y 12 dígitos.");
    }
    pago.estado = "Pagado";
    pago.referencia = codigo;
  }

  if (metodo === "tarjeta") {
    // Sin recortar: si llegara un número completo de tarjeta, debe rechazarse.
    const ultimos4 = String(pagoIn.ultimos4 ?? "").trim();
    if (!/^\d{4}$/.test(ultimos4)) {
      throw new ErrorApi(400, "Tarjeta no válida.");
    }
    pago.estado = "Pagado";
    pago.referencia = `****${ultimos4}`;
  }

  return { entrega, pago };
}
