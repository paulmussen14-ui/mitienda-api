import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Inicialización perezosa: así /health y las pruebas no necesitan credenciales.
function iniciar() {
  if (getApps().length) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  initializeApp({
    credential: json ? cert(JSON.parse(json)) : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || "mitienda-ee0e8",
  });
}

export function db() {
  iniciar();
  return getFirestore();
}

export function auth() {
  iniciar();
  return getAuth();
}