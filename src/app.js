import express from "express";
import cors from "cors";
import { crearPedido, registrarVenta } from "./pedidos.js";
import { validarMovimiento, registrarMovimiento } from "./inventario.js";
import { requerirUsuarioNegocio, requerirCliente } from "./autenticacion.js";
import { ErrorApi } from "./errores.js";
import { validarCheckout } from "./checkout.js";
import { middlewareMonitoreo, estadoSalud, metricasPrometheus } from "./monitoreo.js";

export function crearApp() {
  const app = express();
  // Entre el cliente y la API hay 3 saltos de confianza: el proxy interno de Render (10.x), otro
  // salto interno (10.x) y la capa pública de Cloudflare (162.159.x). Se confía en 3 saltos para que
  // req.ip sea la IP real del cliente (4.ª de la cadena) y no la de Cloudflare. Se cuenta desde la
  // derecha, así que una IP falsa que el cliente anteponga en X-Forwarded-For no cambia el resultado.
  app.set("trust proxy", 3);

  const origenes = (
    process.env.CORS_ORIGINS ||
    "https://mitienda-ee0e8.web.app,https://mitienda-ee0e8.firebaseapp.com,http://localhost:8080,http://127.0.0.1:8080"
  ).split(",");

  app.use(cors({ origin: origenes }));
  app.use(express.json());
  app.use(middlewareMonitoreo);

  // Usado por Docker, Azure y el pipeline para comprobar que el servicio está arriba.
  app.get("/health", (_req, res) => {
    res.json(estadoSalud());
  });

  // Métricas en formato Prometheus (Grafana Cloud / Prometheus las leen con scrape).
  app.get("/metrics", (req, res) => {
    // trim(): al copiar y pegar el token suelen colarse espacios o saltos de línea al final.
    const token = (process.env.METRICS_TOKEN || "").trim();
    const recibido = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (token && recibido !== token) {
      return res.status(401).json({ correcto: false, error: "No autorizado." });
    }
    res.type("text/plain; version=0.0.4").send(metricasPrometheus());
  });

  // El cliente se identifica con su token de Firebase: el cliente_id sale del token, no del body.
  app.post("/pedidos", requerirCliente, async (req, res, next) => {
    try {
      const { negocio_id } = req.body || {};
      if (!negocio_id) {
        throw new ErrorApi(400, "Falta negocio_id.");
      }
      const { entrega, pago } = validarCheckout(req.body);
      const resultado = await crearPedido({
        negocioId: negocio_id,
        clienteId: req.cliente.uid,
        entrega,
        pago,
      });
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

  // Entradas y salidas manuales de stock. Solo personal autenticado del negocio.
  app.post("/inventario/movimientos", requerirUsuarioNegocio, async (req, res, next) => {
    try {
      const datos = validarMovimiento(req.body);
      const resultado = await registrarMovimiento({ ...datos, negocioId: req.usuario.negocio_id });
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