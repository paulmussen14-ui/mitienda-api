// Error controlado: lleva el código HTTP que debe devolver la API.
export class ErrorApi extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}