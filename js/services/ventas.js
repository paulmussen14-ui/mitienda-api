import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db, auth } from "../config/firebase.js";
import { llamarApi } from "../config/api.js";

/**
 * Registrar la venta de un pedido.
 * La lógica (verificar y descontar stock, crear la venta, marcar el
 * pedido como Entregado) vive en mitienda-api; aquí solo se envía el
 * token de Firebase del personal del negocio.
 */
export async function registrarVenta(pedidoId) {

    try {

        await auth.authStateReady();

        if (!auth.currentUser) {
            throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
        }

        const token = await auth.currentUser.getIdToken();

        const respuesta = await llamarApi(
            `/pedidos/${encodeURIComponent(pedidoId)}/venta`,
            { metodo: "POST", token }
        );

        return {
            correcto: true,
            venta_id: respuesta.venta_id
        };

    } catch (error) {

        console.error(
            "❌ Error registrando venta:",
            error
        );

        throw error;
    }
}


/**
 * Obtener una venta por ID
 */
export async function obtenerVenta(ventaId) {

    try {

        const referencia = doc(
            db,
            "ventas",
            ventaId
        );

        const resultado =
            await getDoc(referencia);

        if (!resultado.exists()) {
            return null;
        }

        return {
            id: resultado.id,
            ...resultado.data()
        };

    } catch (error) {

        console.error(
            "❌ Error obteniendo venta:",
            error
        );

        throw error;
    }
}