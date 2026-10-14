# mitienda-api

Capa de lógica de negocio de MiTienda (Node.js + Express) sobre Firestore.
Componente 2 de 3 de la solución: frontend ([`mitienda`](https://github.com/paulmussen14-ui/mitienda)), API (este repo) y datos en Firestore.

|                    |                                                |
| ------------------ | ---------------------------------------------- |
| API en producción  | https://mitienda-api-dcd6.onrender.com         |
| Tienda             | https://mitienda-ee0e8.web.app                 |
| Lenguaje y versión | JavaScript (ES Modules), Node.js 20 o superior |

## Endpoints

| Método | Ruta                 | Acceso                                                                | Qué hace                                                                                                          |
| ------ | -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`            | Público                                                               | Estado del servicio: ambiente, tiempo encendido y memoria. Lo usan Docker, Render, UptimeRobot y el pipeline      |
| GET    | `/metrics`           | `Authorization: Bearer <METRICS_TOKEN>`                               | Métricas en formato Prometheus. Si `METRICS_TOKEN` no está definido, es público (solo recomendable en desarrollo) |
| POST   | `/pedidos`           | Cliente registrado (`Authorization: Bearer <ID token de Firebase>`)   | Convierte el carrito activo en pedido                                                                             |
| POST   | `/pedidos/:id/venta` | Personal del negocio (`Authorization: Bearer <ID token de Firebase>`) | Descuenta stock, registra el movimiento, crea la venta y marca el pedido como Entregado                           |
| POST   | `/inventario/movimientos` | Personal del negocio (`Authorization: Bearer <ID token de Firebase>`) | Registra una entrada o salida manual de stock y su movimiento en una sola transacción |

**`POST /pedidos`** — cuerpo:

```json
{
  "negocio_id": "...",
  "entrega": { "tipo": "recojo | delivery", "direccion": "...", "nota": "..." },
  "pago": {
    "metodo": "efectivo | yape | plin | tarjeta",
    "codigo_operacion": "...",
    "ultimos4": "..."
  }
}
```

- El cliente se toma del token verificado, nunca del cuerpo.
- Delivery exige una dirección de al menos 5 caracteres.
- Yape y Plin exigen un código de operación de 6 a 12 dígitos; tarjeta solo acepta los últimos 4 dígitos (un número completo se rechaza).
- Los pagos son una **simulación académica**: no se cobra nada.
- Respuesta 201: `{ "correcto": true, "pedido_id", "numero_pedido", "total" }`.

**`POST /pedidos/:id/venta`** — respuesta 201: `{ "correcto": true, "venta_id" }`.

**`POST /inventario/movimientos`** — cuerpo:

```json
{ "producto_id": "...", "tipo": "entrada | salida", "cantidad": 5, "motivo": "Compra" }
```

- La cantidad debe ser un entero mayor que 0 (máximo 100000); el motivo se recorta a 100 caracteres.
- El negocio sale del usuario autenticado. Un producto de otro negocio responde 403 y un producto inexistente, 404.
- Una salida mayor que el stock disponible responde 409 y no cambia nada.
- Respuesta 201: `{ "correcto": true, "movimiento_id", "stock" }` (stock resultante).

**Errores:** todas las respuestas de error tienen la forma `{ "correcto": false, "error": "mensaje" }`.

| Código | Cuándo                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Datos inválidos (entrega, pago, carrito vacío, cantidad inválida)                                                                  |
| 401    | Falta el token, es inválido o está vencido                                                                                         |
| 403    | Sesión anónima con registro obligatorio, cliente sin perfil, usuario deshabilitado o sin tienda, pedido o producto de otro negocio |
| 404    | Ruta, tienda, carrito, pedido o producto inexistente                                                                               |
| 409    | Venta de un pedido cancelado o ya entregado, o stock insuficiente                                                                  |
| 500    | Error interno (el detalle va solo al log, no a la respuesta)                                                                       |

## Variables de ambiente

| Variable                        | Obligatoria               | Valor por defecto                                         | Para qué sirve                                                                                  |
| ------------------------------- | ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `PORT`                          | No                        | `8080`                                                    | Puerto de escucha                                                                               |
| `AMBIENTE`                      | No                        | `desarrollo`                                              | `desarrollo` o `produccion`. Aparece en cada log y en cada métrica                              |
| `FIREBASE_PROJECT_ID`           | No                        | `mitienda-ee0e8`                                          | Proyecto de Firebase                                                                            |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Sí, en producción         | Credenciales por defecto de Google                        | JSON completo de la cuenta de servicio, en una sola línea. **Secreto: nunca va al repositorio** |
| `CORS_ORIGINS`                  | No                        | Tienda en `web.app`, `firebaseapp.com` y `localhost:8080` | Orígenes permitidos, separados por coma                                                         |
| `EXIGIR_CLIENTE_REGISTRADO`     | No                        | `false`                                                   | `true` rechaza sesiones anónimas y clientes sin perfil en `clientes`                            |
| `METRICS_TOKEN`                 | Recomendada en producción | Sin token                                                 | Token Bearer para `/metrics`. Se compara sin espacios ni saltos de línea al final               |

En Render, `AMBIENTE`, `FIREBASE_PROJECT_ID`, `CORS_ORIGINS` y `EXIGIR_CLIENTE_REGISTRADO` vienen en `render.yaml`; `FIREBASE_SERVICE_ACCOUNT_JSON` y `METRICS_TOKEN` se escriben a mano en el panel de Render (`sync: false`).

## Estructura

```
src/
├── server.js         Arranca el servidor
├── app.js            Rutas, CORS, manejo de errores
├── autenticacion.js  Verifica tokens de Firebase: requerirCliente, requerirUsuarioNegocio
├── checkout.js       Valida y normaliza entrega y pago
├── pedidos.js        crearPedido y registrarVenta (transacciones de Firestore)
├── monitoreo.js      Logs JSON, /health y métricas Prometheus
├── firebase.js       Admin SDK (inicialización perezosa)
└── errores.js        ErrorApi
test/                 Pruebas con node --test
Dockerfile            Imagen node:20-alpine
render.yaml           Servicio en Render como código
azure-pipelines.yml   Pruebas, contenedor y despliegue
```

## Monitoreo

### Logs

Cada petición escribe una línea JSON en la salida estándar:

```json
{
  "fecha": "2026-10-13T03:11:56.199Z",
  "nivel": "info",
  "ambiente": "produccion",
  "metodo": "GET",
  "ruta": "(no encontrada)",
  "estado": 404,
  "duracion_ms": 1
}
```

| Nivel    | Cuándo                                           | Cómo reaccionar                                            |
| -------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `info`   | Respuestas 2xx, 3xx y 4xx distintas de 401 y 403 | Sin acción; revisar solo si hay un patrón                  |
| `alerta` | 401 y 403                                        | Posible token mal configurado o intento de acceso indebido |
| `error`  | 5xx                                              | Incidente: revisar el log completo en Render               |

- `ruta` es la ruta declarada (`/pedidos/:id/venta`), no la real, para no crear una serie por cada id. Una ruta inexistente aparece como `(no encontrada)`.
- `/health` y `/metrics` **no se escriben** en el log cuando responden bien (se consultan cada pocos segundos o minutos); sí cuentan en las métricas y, si fallan, sí se registran.
- En los rechazos 401 y 403 se guardan además `ip`, `x_forwarded_for` y `user_agent`, para distinguir una prueba propia de un intento externo. La IP es un dato personal: solo se registra en esos casos y los logs del plan gratuito de Render se conservan poco tiempo.
- Con `NODE_ENV=test` no se escribe el log.

### Métricas (`GET /metrics`)

| Métrica                         | Tipo    | Qué mide                                               |
| ------------------------------- | ------- | ------------------------------------------------------ |
| `mitienda_peticiones_total`     | counter | Peticiones por `ambiente`, `metodo`, `ruta` y `estado` |
| `mitienda_duracion_ms_suma`     | counter | Suma de milisegundos de respuesta por ruta             |
| `mitienda_duracion_ms_cantidad` | counter | Peticiones medidas (el promedio es suma / cantidad)    |
| `mitienda_peticiones_en_curso`  | gauge   | Peticiones que se están atendiendo ahora               |
| `mitienda_uptime_segundos`      | gauge   | Tiempo encendido del servidor                          |
| `mitienda_memoria_bytes`        | gauge   | Memoria residente del proceso                          |

Las métricas viven en memoria: **se reinician con cada reinicio de la API**, por eso las gráficas muestran saltos hacia abajo.

### Herramientas conectadas

| Herramienta    | Qué vigila               | Configuración                                                                              |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| UptimeRobot    | Que `/health` responda   | Monitor HTTP cada 5 minutos                                                                |
| Grafana Cloud  | Métricas de `/metrics`   | Integración Metrics Endpoint, job `mitienda-api`, autenticación Bearer, scrape cada minuto |
| Logs de Render | Líneas JSON por petición | Panel de Render (historial corto en el plan gratuito)                                      |

Dashboard de Grafana: peticiones por minuto por ruta, errores 5xx, tiempo promedio de respuesta y accesos no autorizados (401 y 403).

Consultas útiles (PromQL):

```
sum by (ruta) (rate(mitienda_peticiones_total[5m]))
sum(rate(mitienda_peticiones_total{estado=~"5.."}[5m]))
sum(rate(mitienda_duracion_ms_suma[5m])) / sum(rate(mitienda_duracion_ms_cantidad[5m]))
sum(rate(mitienda_peticiones_total{estado=~"401|403"}[5m]))
```

### Guía de primer nivel

| Síntoma                                            | Causa probable                                                                 | Qué hacer                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 401 repetidos en `/metrics` cada minuto            | `METRICS_TOKEN` en Render distinto del token del scrape job en Grafana         | Igualar el token en ambos lados y reiniciar el servicio                                           |
| `up` = 0 en Grafana o monitor caído en UptimeRobot | Servicio suspendido por inactividad o en reinicio                              | Abrir `/health`; si responde, esperar el siguiente scrape; si no, revisar el despliegue en Render |
| Primera petición lenta (varios segundos)           | Arranque en frío del plan gratuito de Render y primeras conexiones a Firestore | Normal tras un rato sin uso; confirmar que las siguientes peticiones bajan de tiempo              |
| 403 "Debes crear tu cuenta..."                     | Cliente con sesión anónima y `EXIGIR_CLIENTE_REGISTRADO=true`                  | El cliente debe registrarse o iniciar sesión                                                      |
| 409 "Stock insuficiente..."                        | La cantidad pedida supera el stock                                             | Reponer stock o ajustar el pedido                                                                 |
| 5xx                                                | Error interno                                                                  | Buscar la línea `error` y el mensaje "Error interno" en los logs de Render                        |

### Prometheus local (desarrollo)

Para ver las métricas con un servidor Prometheus propio (además de Grafana Cloud en producción):

1. Inicia la API: `npm run dev` (puerto 8080).
2. Inicia Prometheus: `docker compose -f docker-compose.monitoreo.yml up -d`.
3. Abre http://localhost:9090 → **Status → Targets**: `mitienda-api-local` debe estar en **UP**.
4. En **Graph**, prueba consultas como `mitienda_peticiones_total`, `mitienda_uptime_segundos` o `rate(mitienda_peticiones_total[1m])`.
5. Para apagarlo: `docker compose -f docker-compose.monitoreo.yml down`.

La configuración está en `monitoreo/prometheus.yml`. El job de producción viene comentado: usa el mismo `METRICS_TOKEN` desde un archivo local `monitoreo/metrics_token` que no se sube a Git.

## Pruebas

```bash
npm test
```

Ejecuta `node --test` con 11 pruebas: `/health`, `/metrics`, rechazo con 401 sin token, que un `cliente_id` en el cuerpo no se acepte, y la validación de entrega y pago. Pendiente: pruebas de `crearPedido` y `registrarVenta`.

## Ejecución local

```bash
npm install
cp .env.example .env     # completar los valores
node --env-file=.env src/server.js
# o con recarga automática:
node --env-file=.env --watch src/server.js
```

Comprobar: `curl http://localhost:8080/health`.

## Docker

```bash
docker build -t mitienda-api .
docker run -p 8080:8080 --env-file .env mitienda-api
```

## Despliegue

El despliegue es automático al subir a `main`, mediante Azure Pipelines:

1. Instala dependencias (`npm ci`) y ejecuta `npm test`.
2. Construye la imagen Docker y comprueba que el contenedor responde en `/health`.
3. Solo en `main` (no en pull requests), llama al deploy hook de Render (`RENDER_DEPLOY_HOOK`) y espera hasta 5 minutos a que `/health` responda en `RENDER_URL`.

El `autoDeploy` de Render está apagado a propósito: nada llega a producción sin pasar por las pruebas. Las variables `RENDER_DEPLOY_HOOK` y `RENDER_URL` se definen como variables secretas del pipeline en Azure DevOps.
