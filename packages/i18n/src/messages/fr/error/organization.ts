import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Connectez-vous à votre compte OpenBot pour utiliser les organisations.",
  "error.organization.unreadable":
    "Les données d'organisation sur cet ordinateur sont illisibles. Elles seront récupérées de nouveau auprès du service de comptes.",
  "error.organization.tooLarge":
    "Les éléments partagés de vos organisations sont trop volumineux pour être conservés sur cet ordinateur.",
  "error.organization.forbidden": "Vous n'avez pas l'autorisation d'effectuer cette action.",
  "error.organization.notFound": "Cette organisation n'existe plus ou vous n'en êtes pas membre.",
  "error.organization.lastOwner": "Une organisation a besoin d'au moins un propriétaire.",
  "error.organization.memberNotFound": "Cette personne n'est pas membre de l'organisation.",
  "error.organization.memberExists": "Cette personne est déjà membre de l'organisation.",
  "error.organization.memberLimit": "L'organisation a atteint le nombre maximal de membres.",
  "error.organization.invalidPhone": "Saisissez un numéro WhatsApp valide avec l'indicatif du pays.",
  "error.organization.organizationLimit": "Le nombre maximal d'organisations est atteint.",
  "error.organization.notConfigured":
    "Le coffre partagé n'est pas encore configuré sur le service de comptes. Demandez au propriétaire de la plateforme de terminer sa configuration.",
  "error.organization.itemConflict":
    "Cet élément a été modifié sur un autre ordinateur. Il a été actualisé, réessayez.",
  "error.organization.itemLimit": "Le coffre de l'organisation est plein. Retirez quelques éléments, puis réessayez.",
  "error.organization.itemMissing": "Cet élément n'est plus dans le coffre de l'organisation.",
  "error.organization.vaultUnreadable":
    "Le service de comptes n'a pas pu lire le coffre de l'organisation. Demandez au propriétaire de la plateforme de vérifier sa clé.",
  "error.organization.itemInvalid": "Cet élément ne peut pas être partagé avec une organisation.",
  "error.organization.personalMissing": "Cet élément n'est plus dans votre coffre.",
} as const satisfies PartialTranslation<typeof source>;
