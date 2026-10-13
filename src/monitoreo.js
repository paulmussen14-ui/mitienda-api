// Monitoreo de la API: logs JSON por petición y métricas en formato Prometheus.
// Compatible con Grafana Cloud / Prometheus (scrape de GET /metrics) y con
// UptimeRobot (GET /health). Las métricas viven en memoria: se reinician con el servidor.

export const AMBIENTE = process.env.AMBIENTE || "desarrollo";
const inicio = Date.now();

const peticiones = new Map(); // "metodo|ruta|estado" -> cantidad
const duracionTotal = new Map(); // "metodo|ruta" -> { suma, cantidad }
let enCurso = 0;

export function middlewareMonitoreo(req, res, next) {
  const t0 = process.hrtime.bigint();
  enCurso++;

  res.on("finish", () => {
    enCurso--;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    // Se usa la ruta declarada (/pedidos/:id/venta) y no la real, para no crear una serie por cada id.
    const ruta = req.route ? req.baseUrl + req.route.path : "(no encontrada)";
    const estado = res.statusCode;

    const clave = `${req.method}|${ruta}|${estado}`;
    peticiones.set(clave, (peticiones.get(clave) || 0) + 1);
    const claveDur = `${req.method}|${ruta}`;
    const dur = duracionTotal.get(claveDur) || { suma: 0, cantidad: 0 };
    dur.suma += ms;
    dur.cantidad += 1;
    duracionTotal.set(claveDur, dur);

    // Nivel según el estado: los 5xx son incidentes, los 401/403 se vigilan (posible abuso).
    const nivel = estado >= 500 ? "error" : estado === 401 || estado === 403 ? "alerta" : "info";
    // /health (Render, UptimeRobot) y /metrics (Grafana) se consultan cada pocos segundos o minutos.
    // Si responden bien no se escriben en el log, para que las incidencias reales no queden
    // enterradas; las métricas sí los cuentan y, si fallan, sí se registran.
    const rutaDeSistema = ruta === "/health" || ruta === "/metrics";
    const silenciar = rutaDeSistema && estado < 400;
    if (process.env.NODE_ENV !== "test" && !silenciar) {
      console.log(
        JSON.stringify({
          fecha: new Date().toISOString(),
          nivel,
          ambiente: AMBIENTE,
          metodo: req.method,
          ruta,
          estado,
          duracion_ms: Math.round(ms),
        })
      );
    }
  });
  next();
}

export function estadoSalud() {
  return {
    estado: "ok",
    servicio: "mitienda-api",
    ambiente: AMBIENTE,
    uptime_segundos: Math.round((Date.now() - inicio) / 1000),
    memoria_mb: Math.round(process.memoryUsage().rss / 1048576),
  };
}

export function metricasPrometheus() {
  const l = [];
  l.push("# HELP mitienda_peticiones_total Peticiones HTTP recibidas.");
  l.push("# TYPE mitienda_peticiones_total counter");
  for (const [clave, n] of peticiones) {
    const [metodo, ruta, estado] = clave.split("|");
    l.push(`mitienda_peticiones_total{ambiente="${AMBIENTE}",metodo="${metodo}",ruta="${ruta}",estado="${estado}"} ${n}`);
  }
  l.push("# HELP mitienda_duracion_ms_suma Suma de milisegundos de respuesta.");
  l.push("# TYPE mitienda_duracion_ms_suma counter");
  l.push("# HELP mitienda_duracion_ms_cantidad Peticiones medidas (para calcular el promedio).");
  l.push("# TYPE mitienda_duracion_ms_cantidad counter");
  for (const [clave, d] of duracionTotal) {
    const [metodo, ruta] = clave.split("|");
    const etq = `ambiente="${AMBIENTE}",metodo="${metodo}",ruta="${ruta}"`;
    l.push(`mitienda_duracion_ms_suma{${etq}} ${d.suma.toFixed(2)}`);
    l.push(`mitienda_duracion_ms_cantidad{${etq}} ${d.cantidad}`);
  }
  l.push("# HELP mitienda_peticiones_en_curso Peticiones que se están atendiendo ahora.");
  l.push("# TYPE mitienda_peticiones_en_curso gauge");
  l.push(`mitienda_peticiones_en_curso{ambiente="${AMBIENTE}"} ${enCurso}`);
  l.push("# HELP mitienda_uptime_segundos Tiempo encendido del servidor.");
  l.push("# TYPE mitienda_uptime_segundos gauge");
  l.push(`mitienda_uptime_segundos{ambiente="${AMBIENTE}"} ${Math.round((Date.now() - inicio) / 1000)}`);
  l.push("# HELP mitienda_memoria_bytes Memoria residente del proceso.");
  l.push("# TYPE mitienda_memoria_bytes gauge");
  l.push(`mitienda_memoria_bytes{ambiente="${AMBIENTE}"} ${process.memoryUsage().rss}`);
  return l.join("\n") + "\n";
}
