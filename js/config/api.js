// URL pública de la API (mitienda-api, desplegada en Render).
export const API_URL = "https://mitienda-api-dcd6.onrender.com";

// El plan gratuito de Render "duerme" el servicio tras un rato sin uso;
// la primera petición puede tardar, por eso el límite es amplio.
const LIMITE_MS = 60000;

/**
 * Llama a la API de MiTienda y devuelve el JSON de la respuesta.
 * Si la API responde con error, lanza un Error con el mensaje de la API.
 */
export async function llamarApi(ruta, { metodo = "GET", cuerpo, token } = {}) {

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), LIMITE_MS);

    try {

        const cabeceras = {};
        if (cuerpo) cabeceras["Content-Type"] = "application/json";
        if (token) cabeceras["Authorization"] = `Bearer ${token}`;

        const respuesta = await fetch(`${API_URL}${ruta}`, {
            method: metodo,
            headers: cabeceras,
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
            signal: controlador.signal
        });

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            // La respuesta no era JSON.
        }

        if (!respuesta.ok) {
            throw new Error(
                datos?.error || `Error del servidor (${respuesta.status}).`
            );
        }

        return datos;

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error("El servidor tardó demasiado en responder. Intenta de nuevo.");
        }

        if (error instanceof TypeError) {
            throw new Error("No se pudo conectar con el servidor. Revisa tu conexión.");
        }

        throw error;

    } finally {
        clearTimeout(temporizador);
    }
}
