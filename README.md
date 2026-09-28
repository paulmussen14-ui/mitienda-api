# mitienda-api

Capa de lógica de negocio de MiTienda (Node.js + Express) sobre Firestore.
Componente 2 de 3 de la solución (frontend, API y datos en Firestore).

## Endpoints

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| GET | /health | Público | Comprueba que el servicio está arriba |
| POST | /pedidos | Cliente | Convierte el carrito activo en pedido. Body: { "negocio_id": "...", "cliente_id": "..." } |
| POST | /pedidos/:id/venta | Personal del negocio (Authorization: Bearer ID token de Firebase) | Descuenta stock, registra el movimiento, crea la venta y marca el pedido como Entregado |

## Local

    npm install
    npm test
    npm start

## Docker

    docker build -t mitienda-api .
    docker run -p 8080:8080 --env-file .env mitienda-api