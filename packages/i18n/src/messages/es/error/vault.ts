import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Esa frase de contraseña no es correcta.",
  "error.vault.universalPassphraseShort": "Usa una frase de contraseña de al menos 10 caracteres.",
  "error.vault.universalSignIn": "Inicia sesión en tu cuenta de OpenBot para usar la bóveda universal.",
  "error.vault.universalNotSetUp": "La bóveda universal aún no está configurada.",
  "error.vault.universalLocked": "Primero desbloquea la bóveda universal.",
  "error.vault.universalExists": "Esta cuenta ya tiene una bóveda universal. Desbloquéala con su frase de contraseña.",
  "error.vault.universalChanged": "La frase de contraseña cambió en otro equipo. Inténtalo de nuevo.",
  "error.vault.universalUnavailable": "No se pudo leer la bóveda universal en este equipo.",
  "error.vault.universalSkillUnsupported":
    "Esta habilidad no se puede compartir. Las habilidades integradas y las de la carpeta personal se quedan en este ordenador.",
} as const satisfies PartialTranslation<typeof source>;
