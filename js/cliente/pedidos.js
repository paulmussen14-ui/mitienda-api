import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { dbCliente as db } from "../config/firebase-cliente.js";
import { obtenerNegocioActual, configurarNavegacionNegocio } from "../services/negocios.js";
import { obtenerClienteId } from "./auth-cliente.js";



/* =====================================================
   CARGAR PEDIDOS
===================================================== */

async function cargarPedidos() {

    const lista =
        document.getElementById(
            "lista-pedidos"
        );


    const vacios =
        document.getElementById(
            "pedidos-vacios"
        );


    const cargando =
        document.getElementById(
            "pedidos-cargando"
        );


    const plantilla =
        document.getElementById(
            "plantilla-pedido"
        );


    const plantillaProducto =
        document.getElementById(
            "plantilla-producto-pedido"
        );


    /* -------------------------------------------------
       COMPROBAR HTML
    ------------------------------------------------- */

    if (
        !lista ||
        !plantilla ||
        !plantillaProducto
    ) {

        return;

    }


    try {

        /* =================================================
           NEGOCIO
        ================================================= */

        const negocio =
            await obtenerNegocioActual();


        if (!negocio) {

            if (cargando) {

                cargando.textContent =
                    "No se encontró la tienda.";

            }

            return;

        }

        configurarNavegacionNegocio(negocio);
        /* =================================================
           CLIENTE
        ================================================= */

        const clienteId =
            await obtenerClienteId();


        console.log(
            "👤 Cliente actual:",
            clienteId
        );


        console.log(
            "🏪 Negocio actual:",
            negocio.id
        );


        /* =================================================
           BUSCAR PEDIDOS
        ================================================= */

        /*
         * MUY IMPORTANTE:
         *
         * Ahora solamente se buscan pedidos
         * del cliente actual dentro de la tienda actual.
         */

        const referencia =
            query(

                collection(
                    db,
                    "pedidos"
                ),

                where(
                    "cliente_id",
                    "==",
                    clienteId
                ),

                where(
                    "negocio_id",
                    "==",
                    negocio.id
                )

            );


        const resultado =
            await getDocs(
                referencia
            );


        const pedidos =
            resultado.docs.map(

                documento => ({

                    id:
                        documento.id,

                    ...documento.data()

                })

            );


        console.log(
            "📦 Pedidos del cliente:",
            pedidos
        );


        /* =================================================
           OCULTAR CARGANDO
        ================================================= */

        if (cargando) {

            cargando.style.display =
                "none";

        }


        /* =================================================
           SIN PEDIDOS
        ================================================= */

        if (
            pedidos.length === 0
        ) {

            lista.innerHTML =
                "";


            lista.style.display =
                "none";


            if (vacios) {

                vacios.style.display =
                    "block";

            }


            return;

        }


        /* =================================================
           MOSTRAR LISTA
        ================================================= */

        if (vacios) {

            vacios.style.display =
                "none";

        }


        lista.style.display =
            "block";


        /* =================================================
           ORDENAR POR FECHA
        ================================================= */

        pedidos.sort(

            (a, b) => {

                const fechaA =
                    a.fecha?.toMillis
                        ? a.fecha.toMillis()
                        : 0;


                const fechaB =
                    b.fecha?.toMillis
                        ? b.fecha.toMillis()
                        : 0;


                return (
                    fechaB -
                    fechaA
                );

            }

        );


        lista.innerHTML =
            "";


        /* =================================================
           MOSTRAR PEDIDOS
        ================================================= */

        pedidos.forEach(

            pedido => {

                const nodo =
                    plantilla.content
                        .cloneNode(true);


                /* =================================================
                   ID / NÚMERO DE PEDIDO
                ================================================= */

                const idElemento =
                    nodo.querySelector(
                        '[data-campo="id"]'
                    );


                if (idElemento) {

                    idElemento.textContent =
                        pedido.numero_pedido
                            ? `#${String(pedido.numero_pedido).padStart(4, "0")}`
                            : `#${pedido.id.slice(0, 6).toUpperCase()}`;

                }


                /* =================================================
                   ESTADO
                ================================================= */

                const estadoElemento =
                    nodo.querySelector(
                        '[data-campo="estado"]'
                    );


                if (estadoElemento) {

                    const estado =
                        pedido.estado ||
                        "Pendiente";


                    estadoElemento.textContent =
                        estado;


                    estadoElemento.className =
                        `pedido-estado estado-${estado
                            .toLowerCase()
                            .replace(
                                /\s+/g,
                                "-"
                            )}`;

                }


                /* =================================================
                   FECHA
                ================================================= */

                const fechaElemento =
                    nodo.querySelector(
                        '[data-campo="fecha"]'
                    );


                if (fechaElemento) {

                    if (
                        pedido.fecha &&
                        pedido.fecha.toDate
                    ) {

                        const fecha =
                            pedido.fecha.toDate();


                        fechaElemento.textContent =
                            fecha.toLocaleString(
                                "es-PE"
                            );

                    }

                    else {

                        fechaElemento.textContent =
                            "Fecha no disponible";

                    }

                }


                /* =================================================
                   DETALLE
                ================================================= */

                const detalle =
                    nodo.querySelector(
                        '[data-campo="detalle"]'
                    );


                if (detalle) {

                    detalle.innerHTML =
                        "";


                    const productos =
                        Array.isArray(
                            pedido.detalle_pedido
                        )
                            ? pedido.detalle_pedido
                            : [];


                    productos.forEach(

                        item => {

                            const productoNodo =
                                plantillaProducto
                                    .content
                                    .cloneNode(true);


                            const nombre =
                                productoNodo.querySelector(
                                    '[data-campo="nombre"]'
                                );


                            const cantidad =
                                productoNodo.querySelector(
                                    '[data-campo="cantidad"]'
                                );


                            const subtotal =
                                productoNodo.querySelector(
                                    '[data-campo="subtotal"]'
                                );


                            if (nombre) {

                                nombre.textContent =
                                    item.nombre ||
                                    "Producto";

                            }


                            if (cantidad) {

                                cantidad.textContent =
                                    `x${Number(
                                        item.cantidad || 0
                                    )}`;

                            }


                            if (subtotal) {

                                subtotal.textContent =
                                    `S/ ${Number(
                                        item.subtotal || 0
                                    ).toFixed(2)}`;

                            }


                            detalle.appendChild(
                                productoNodo
                            );

                        }

                    );

                }


                /* =================================================
                   TOTAL
                ================================================= */

                const totalElemento =
                    nodo.querySelector(
                        '[data-campo="total"]'
                    );


                if (totalElemento) {

                    totalElemento.textContent =
                        `S/ ${Number(
                            pedido.total || 0
                        ).toFixed(2)}`;

                }


                /* =================================================
                   AGREGAR PEDIDO
                ================================================= */

                lista.appendChild(
                    nodo
                );

            }

        );


    } catch (error) {

        console.error(
            "❌ Error cargando pedidos:",
            error
        );


        if (cargando) {

            cargando.textContent =
                "No se pudieron cargar los pedidos.";

            cargando.style.display =
                "block";

        }

    }

}


/* =====================================================
   INICIAR
===================================================== */

cargarPedidos();