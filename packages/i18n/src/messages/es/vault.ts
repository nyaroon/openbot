import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Bóveda universal",
  "vault.universal.intro":
    "Los elementos que marques como Universal se cifran en este equipo y se sincronizan con todos los equipos que hayan iniciado sesión en tu cuenta. El servicio de cuentas nunca los ve, ni tampoco tu frase de contraseña.",
  "vault.universal.signedOut": "Inicia sesión en tu cuenta de OpenBot para usar la bóveda universal.",
  "vault.universal.passphrase": "Frase de contraseña",
  "vault.universal.passphraseHint":
    "Usa al menos 10 caracteres. Si la pierdes, los elementos sincronizados no se pueden recuperar.",
  "vault.universal.setUp": "Configurar",
  "vault.universal.unlock": "Desbloquear",
  "vault.universal.lockedHint": "Escribe tu frase de contraseña para desbloquear la bóveda universal en este equipo.",
  "vault.universal.syncing": "Sincronizando…",
  "vault.universal.upToDate": "Al día",
  "vault.universal.neverSynced": "Aún no se ha sincronizado",
  "vault.universal.pending": {
    one: "{count} cambio está esperando para sincronizarse",
    other: "{count} cambios están esperando para sincronizarse",
  },
  "vault.universal.issueOffline": "No se puede acceder al servicio de cuentas. OpenBot lo volverá a intentar.",
  "vault.universal.issueLimit":
    "La bóveda universal está llena. Deja de sincronizar algunos elementos para añadir más.",
  "vault.universal.issueData": "No se pudieron sincronizar algunos elementos.",
  "vault.universal.syncNow": "Sincronizar ahora",
  "vault.universal.changePassphrase": "Cambiar la frase de contraseña",
  "vault.universal.currentPassphrase": "Frase de contraseña actual",
  "vault.universal.newPassphrase": "Frase de contraseña nueva",
  "vault.universal.applyChange": "Cambiar",
  "vault.universal.dismiss": "Cancelar",
  "vault.universal.forget": "Olvidar en este dispositivo",
  "vault.universal.toggle": "Universal",
  "vault.universal.toggleHint": "Sincronizar este elemento con todos tus equipos",
  "vault.universal.badge": "Universal",
  "vault.universal.unshareTitle": "¿Dejar de sincronizar este elemento?",
  "vault.universal.unshareBody": "Elige qué ocurre con las copias de tus otros equipos.",
  "vault.universal.unshareEverywhere": "Dejar de sincronizar en todas partes",
  "vault.universal.unshareEverywhereHint": "Cada equipo conserva su propia copia.",
  "vault.universal.unshareHere": "Dejar de sincronizar en este equipo",
  "vault.universal.unshareHereHint": "Los demás equipos lo siguen sincronizando.",
  "vault.universal.deleteNote": "Este elemento universal se eliminará en todos tus equipos.",
  "vault.universal.conflictCopy": "(copia por conflicto)",
} as const satisfies PartialTranslation<typeof source>;
