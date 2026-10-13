import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { ErrorApi } from "./errores.js";

export const TIPOS_MOVIMIENTO = ["entrada", "salida"];
const CANTIDAD_MAXIMA = 100000;

/* Valida y normaliza el cuerpo de POST /inventario/movimientos. */
export function validarMovimiento(cuerpo = {}) {
  const { producto_id, tipo, cantidad, motivo } = cuerpo || {};

  if (typeof producto_id !== "string" || !producto_id.trim() || producto_id.includes("/")) {
    throw new ErrorApi(400, "Falta producto_id.");
  }
  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw new ErrorApi(400, "Tipo de movimiento no válido (entrada o salida).");
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new ErrorApi(400, "La cantidad debe ser un número entero mayor que 0.");
  }
  if (cantidad > CANTIDAD_MAXIMA) {
    throw new ErrorApi(400, `La cantidad no puede superar ${CANTIDAD_MAXIMA}.`);
  }

  const motivoLimpio = typeof motivo === "string" ? motivo.trim().slice(0, 100) : "";
  return {
    productoId: producto_id.trim(),
    tipo,
    cantidad,
    motivo: motivoLimpio || "Sin especificar",
  };
}

/* REGISTRAR MOVIMIENTO MANUAL (antes en js/services/inventario.js)
   Cambia el stock y crea el movimiento en una sola transacción: o se guardan los dos o ninguno.
   El negocio sale del usuario autenticado, no del cuerpo. */
export async function registrarMovimiento({ productoId, tipo, cantidad, motivo, negocioId }) {
  const firestore = db();
  const productoRef = firestore.collection("productos").doc(productoId);
  const movimientoRef = firestore.collection("movimientos_inventario").doc();

  const stock = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(productoRef);
    if (!snap.exists) throw new ErrorApi(404, "El producto no existe.");

    const producto = snap.data();
    if (producto.negocio_id !== negocioId) {
      throw new ErrorApi(403, "El producto pertenece a otro negocio.");
    }

    const stockActual = Number(producto.stock) || 0;
    if (tipo === "salida" && cantidad > stockActual) {
      throw new ErrorApi(409, `No hay suficiente stock disponible. Disponible: ${stockActual}.`);
    }

    const nuevoStock = tipo === "entrada" ? stockActual + cantidad : stockActual - cantidad;

    tx.update(productoRef, { stock: nuevoStock });
    tx.set(movimientoRef, {
      producto_id: productoId,
      negocio_id: negocioId,
      tipo,
      cantidad,
      motivo,
      fecha: FieldValue.serverTimestamp(),
    });

    return nuevoStock;
  });

  return { movimiento_id: movimientoRef.id, stock };
}
