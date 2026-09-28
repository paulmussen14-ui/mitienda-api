import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import { ErrorApi } from "./errores.js";

/* CREAR PEDIDO (antes en js/cliente/pedidos.js)
   Convierte el carrito activo del cliente en un pedido. */
export async function crearPedido({ negocioId, clienteId }) {
  const firestore = db();

  const carritos = await firestore
    .collection("carritos")
    .where("cliente_id", "==", clienteId)
    .where("negocio_id", "==", negocioId)
    .where("estado", "==", "activo")
    .limit(1)
    .get();

  if (carritos.empty) throw new ErrorApi(404, "El carrito está vacío.");

  const carritoRef = carritos.docs[0].ref;
  const carrito = carritos.docs[0].data();

  if (!Array.isArray(carrito.items) || carrito.items.length === 0) {
    throw new ErrorApi(400, "El carrito está vacío.");
  }

  const detalle = carrito.items.map((item) => {
    const precio = Number(item.precio || 0);
    const cantidad = Number(item.cantidad || 0);
    return {
      producto_id: item.producto_id,
      nombre: item.nombre || "Producto",
      precio,
      cantidad,
      subtotal: precio * cantidad,
    };
  });

  const total = detalle.reduce((suma, item) => suma + item.subtotal, 0);

  const negocioRef = firestore.collection("negocios").doc(negocioId);
  const pedidoRef = firestore.collection("pedidos").doc();

  // Número correlativo + pedido + carrito convertido, todo en una sola transacción.
  const numeroPedido = await firestore.runTransaction(async (tx) => {
    const negocioSnap = await tx.get(negocioRef);
    if (!negocioSnap.exists) throw new ErrorApi(404, "No se encontró la tienda.");

    const siguiente = (negocioSnap.data().ultimo_numero_pedido || 0) + 1;

    tx.update(negocioRef, { ultimo_numero_pedido: siguiente });
    tx.set(pedidoRef, {
      numero_pedido: siguiente,
      cliente_id: clienteId,
      negocio_id: negocioId,
      detalle_pedido: detalle,
      estado: "Pendiente",
      fecha: FieldValue.serverTimestamp(),
      subtotal: total,
      total,
    });
    tx.update(carritoRef, {
      estado: "convertido",
      fecha_actualizacion: FieldValue.serverTimestamp(),
    });

    return siguiente;
  });

  return { pedido_id: pedidoRef.id, numero_pedido: numeroPedido, total };
}

/* REGISTRAR VENTA (antes en js/services/ventas.js)
   Verifica y descuenta stock, registra el movimiento, crea la venta
   y marca el pedido como Entregado. */
export async function registrarVenta({ pedidoId, negocioId }) {
  const firestore = db();
  const pedidoRef = firestore.collection("pedidos").doc(pedidoId);
  const ventaRef = firestore.collection("ventas").doc();

  await firestore.runTransaction(async (tx) => {
    const pedidoSnap = await tx.get(pedidoRef);
    if (!pedidoSnap.exists) throw new ErrorApi(404, "El pedido no existe.");

    const pedido = pedidoSnap.data();
    if (pedido.negocio_id !== negocioId) {
      throw new ErrorApi(403, "El pedido pertenece a otro negocio.");
    }
    if (pedido.estado === "Cancelado") {
      throw new ErrorApi(409, "No se puede registrar una venta de un pedido cancelado.");
    }
    if (pedido.estado === "Entregado") {
      throw new ErrorApi(409, "Este pedido ya fue entregado.");
    }

    const detalle = pedido.detalle_pedido || [];
    if (detalle.length === 0) throw new ErrorApi(400, "El pedido no contiene productos.");

    // En Firestore todas las lecturas van antes de las escrituras.
    const productos = [];
    for (const item of detalle) {
      const productoRef = firestore.collection("productos").doc(item.producto_id);
      const productoSnap = await tx.get(productoRef);

      if (!productoSnap.exists) {
        throw new ErrorApi(404, `El producto "${item.nombre}" no existe.`);
      }

      const producto = productoSnap.data();
      if (producto.negocio_id !== negocioId) {
        throw new ErrorApi(403, `El producto "${item.nombre}" pertenece a otro negocio.`);
      }

      const stockActual = Number(producto.stock) || 0;
      const cantidad = Number(item.cantidad) || 0;

      if (cantidad <= 0) throw new ErrorApi(400, `Cantidad inválida para "${item.nombre}".`);
      if (cantidad > stockActual) {
        throw new ErrorApi(409, `Stock insuficiente para "${item.nombre}". Disponible: ${stockActual}.`);
      }

      productos.push({ id: item.producto_id, ref: productoRef, stockActual, cantidad });
    }

    for (const p of productos) {
      tx.update(p.ref, { stock: p.stockActual - p.cantidad });
      tx.set(firestore.collection("movimientos_inventario").doc(), {
        producto_id: p.id,
        negocio_id: negocioId,
        tipo: "salida",
        cantidad: p.cantidad,
        motivo: "Venta",
        fecha: FieldValue.serverTimestamp(),
      });
    }

    tx.set(ventaRef, {
      cliente_id: pedido.cliente_id || null,
      negocio_id: pedido.negocio_id,
      detalle_venta: detalle,
      subtotal: Number(pedido.subtotal) || 0,
      total: Number(pedido.total) || 0,
      estado: "Completada",
      fecha: FieldValue.serverTimestamp(),
      pedido_id: pedidoId,
    });

    tx.update(pedidoRef, { estado: "Entregado" });
  });

  return { venta_id: ventaRef.id };
}