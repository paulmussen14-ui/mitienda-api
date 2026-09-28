import { obtenerNegocioActual } from "./negocios.js";
import { obtenerClienteId } from "../cliente/auth-cliente.js";
import { llamarApi } from "../config/api.js";

/* =====================================================
   CREAR PEDIDO
   La lógica de negocio (validar carrito, numerar el pedido
   y convertir el carrito) vive en mitienda-api.
===================================================== */

export async function crearPedido() {

    const negocio = await obtenerNegocioActual();

    if (!negocio) {
        throw new Error("No se encontró la tienda actual.");
    }

    const clienteId = await obtenerClienteId();

    const respuesta = await llamarApi("/pedidos", {
        metodo: "POST",
        cuerpo: {
            negocio_id: negocio.id,
            cliente_id: clienteId
        }
    });

    return {
        correcto: true,
        pedidoId: respuesta.pedido_id,
        numeroPedido: respuesta.numero_pedido,
        total: respuesta.total,
        clienteId: clienteId,
        negocioId: negocio.id
    };
}
