import { crearApp } from "./app.js";

const puerto = process.env.PORT || 8080;

crearApp().listen(puerto, () => {
  console.log(`mitienda-api escuchando en el puerto ${puerto}`);
});