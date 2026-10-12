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

// Valida el token de Firebase del CLIENTE. El uid sale del token verificado,
// nunca del body, para que nadie pueda crear pedidos a nombre de otra persona.
// Con EXIGIR_CLIENTE_REGISTRADO=true además se rechaza la sesión anónima y se
// exige que exista el perfil en la colección "clientes".
export async function requerirCliente(req, _res, next) {
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

    if (process.env.EXIGIR_CLIENTE_REGISTRADO === "true") {
      if (decodificado.firebase?.sign_in_provider === "anonymous") {
        throw new ErrorApi(403, "Debes crear tu cuenta o iniciar sesión para hacer un pedido.");
      }
      const snap = await db().collection("clientes").doc(decodificado.uid).get();
      if (!snap.exists) {
        throw new ErrorApi(403, "Completa tu registro de cliente para hacer un pedido.");
      }
    }

    req.cliente = { uid: decodificado.uid };
    next();
  } catch (error) {
    next(error);
  }
}
