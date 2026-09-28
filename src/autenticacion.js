import { auth, db } from "./firebase.js";
import { ErrorApi } from "./errores.js";

// Equivale a protegerPanelAdmin() del frontend: token válido + usuario activo + negocio asignado.
export async function requerirUsuarioNegocio(req, _res, next) {
  try {
    const cabecera = req.headers.authorization || "";
    const [tipo, token] = cabecera.split(" ");

    if (tipo !== "Bearer" || !token) {
      throw new ErrorApi(401, "Falta el token de autenticación.");
    }

    let decodificado;
    try {
      decodificado = await auth().verifyIdToken(token);
    } catch {
      throw new ErrorApi(401, "Token inválido o vencido.");
    }

    const snap = await db().collection("usuarios").doc(decodificado.uid).get();
    if (!snap.exists) throw new ErrorApi(403, "No se encontró tu perfil de usuario.");

    const usuario = snap.data();
    if (!usuario.activo) throw new ErrorApi(403, "Tu cuenta está deshabilitada.");
    if (!usuario.negocio_id) throw new ErrorApi(403, "Tu usuario no está asociado a ninguna tienda.");

    req.usuario = { uid: decodificado.uid, rol: usuario.rol, negocio_id: usuario.negocio_id };
    next();
  } catch (error) {
    next(error);
  }
}