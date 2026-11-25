import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Inicia sesión en tu cuenta de OpenBot para usar las organizaciones.",
  "error.organization.unreadable":
    "Los datos de la organización en este equipo no se pueden leer. Se volverán a obtener del servicio de cuentas.",
  "error.organization.tooLarge":
    "Los elementos compartidos de tus organizaciones son demasiado grandes para guardarlos en este equipo.",
  "error.organization.forbidden": "No tienes permiso para hacer esto.",
  "error.organization.notFound": "Esta organización ya no existe o no eres miembro de ella.",
  "error.organization.lastOwner": "Una organización necesita al menos un propietario.",
  "error.organization.memberNotFound": "Esta persona no es miembro de la organización.",
  "error.organization.memberExists": "Esta persona ya es miembro de la organización.",
  "error.organization.memberLimit": "La organización tiene el número máximo de miembros.",
  "error.organization.invalidPhone": "Introduce un número de WhatsApp válido con el prefijo del país.",
  "error.organization.organizationLimit": "Se alcanzó el número máximo de organizaciones.",
  "error.organization.notConfigured":
    "La bóveda compartida aún no está configurada en el servicio de cuentas. Pide al propietario de la plataforma que termine la configuración.",
  "error.organization.itemConflict":
    "Este elemento se cambió en otro equipo. Se actualizó, así que inténtalo de nuevo.",
  "error.organization.itemLimit":
    "La bóveda de la organización está llena. Quita algunos elementos e inténtalo de nuevo.",
  "error.organization.itemMissing": "Este elemento ya no está en la bóveda de la organización.",
  "error.organization.vaultUnreadable":
    "El servicio de cuentas no pudo leer la bóveda de la organización. Pide al propietario de la plataforma que revise su clave.",
  "error.organization.itemInvalid": "Este elemento no se puede compartir con una organización.",
  "error.organization.personalMissing": "Este elemento ya no está en tu bóveda.",
} as const satisfies PartialTranslation<typeof source>;
