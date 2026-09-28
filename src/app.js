import express from "express";
import cors from "cors";
import { crearPedido, registrarVenta } from "./pedidos.js";
import { requerirUsuarioNegocio } from "./autenticacion.js";
import { ErrorApi } from "./errores.js";

export function crearApp() {
  const app = express();

  const origenes = (
    process.env.CORS_ORIGINS ||
    "https://mitienda-ee0e8.web.app,https://mitienda-ee0e8.firebaseapp.com,http://localhost:8080,http://127.0.0.1:8080"
  ).split(",");

  app.use(cors({ origin: origenes }));
  app.use(express.json());

  // Usado por Docker, Azure y el pipeline para comprobar que el servicio está arriba.
  app.get("/health", (_req, res) => {
    res.json({ estado: "ok", servicio: "mitienda-api" });
  });

  // El cliente (sin login todavía) se identifica con negocio_id + cliente_id, igual que el carrito.
  app.post("/pedidos", async (req, res, next) => {
    try {
      const { negocio_id, cliente_id } = req.body || {};
      if (!negocio_id || !cliente_id) {
        throw new ErrorApi(400, "Faltan negocio_id y/o cliente_id.");
      }
      const resultado = await crearPedido({ negocioId: negocio_id, clienteId: cliente_id });
      res.status(201).json({ correcto: true, ...resultado });
    } catch (error) {
      next(error);
    }
  });

  // Solo personal autenticado del negocio puede registrar la venta.
  app.post("/pedidos/:id/venta", requerirUsuarioNegocio, async (req, res, next) => {
    try {
      const resultado = await registrarVenta({
        pedidoId: req.params.id,
        negocioId: req.usuario.negocio_id,
      });
      res.status(201).json({ correcto: true, ...resultado });
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res) => res.status(404).json({ correcto: false, error: "Ruta no encontrada." }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    const estado = error instanceof ErrorApi ? error.estado : 500;
    if (estado === 500) console.error("Error interno:", error);
    res.status(estado).json({
      correcto: false,
      error: estado === 500 ? "Error interno del servidor." : error.message,
    });
  });

  return app;
}