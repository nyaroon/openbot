import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Cette phrase secrète n’est pas correcte.",
  "error.vault.universalPassphraseShort": "Utilisez une phrase secrète d’au moins 10 caractères.",
  "error.vault.universalSignIn": "Connectez-vous à votre compte OpenBot pour utiliser le coffre universel.",
  "error.vault.universalNotSetUp": "Le coffre universel n’est pas encore configuré.",
  "error.vault.universalLocked": "Déverrouillez d’abord le coffre universel.",
  "error.vault.universalExists": "Ce compte possède déjà un coffre universel. Déverrouillez-le avec sa phrase secrète.",
  "error.vault.universalChanged": "La phrase secrète a changé sur un autre ordinateur. Réessayez.",
  "error.vault.universalUnavailable": "Le coffre universel n’a pas pu être lu sur cet ordinateur.",
  "error.vault.universalSkillUnsupported":
    "Cette compétence ne peut pas être partagée. Les compétences intégrées et celles du dossier personnel restent sur cet ordinateur.",
} as const satisfies PartialTranslation<typeof source>;
