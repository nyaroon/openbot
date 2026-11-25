import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/organization";

export const messages = {
  "organization.tab": "Organisations",
  "organization.title": "Organisations",
  "organization.intro":
    "Les équipes dont vous faites partie. Les éléments qu'une organisation partage apparaissent dans votre coffre avec le nom de l'organisation et ne peuvent pas y être modifiés.",
  "organization.signedOut": "Connectez-vous à votre compte OpenBot pour voir vos organisations.",
  "organization.empty": "Vous ne faites encore partie d'aucune organisation.",
  "organization.refresh": "Actualiser",
  "organization.syncing": "Synchronisation…",
  "organization.counts": "Membres {members} · Éléments partagés {items}",
  "organization.issue.offline":
    "Le service de comptes est inaccessible. Les dernières données synchronisées s'affichent.",
  "organization.issue.notConfigured":
    "Le coffre partagé n'est pas encore configuré sur le service de comptes. Les organisations et les membres fonctionnent, mais les éléments partagés ne sont pas disponibles.",
  "organization.issue.data": "Certains éléments partagés n'ont pas pu être lus et ont été ignorés.",
  "organization.role.owner": "Propriétaire",
  "organization.role.admin": "Administrateur",
  "organization.role.member": "Membre",
  "organization.role.platformOwner": "Propriétaire de la plateforme",
  "organization.badgeHint": "Partagé par {name}. Il ne peut pas être modifié ici.",
  "organization.new": "Nouvelle organisation",
  "organization.nameLabel": "Nom",
  "organization.ownerNumberLabel": "Numéro WhatsApp du propriétaire",
  "organization.ownerNumberHint": "Indiquez l'indicatif du pays, par exemple +628123456789.",
  "organization.create": "Créer",
  "organization.open": "Ouvrir {name}",
  "organization.back": "Retour aux organisations",
  "organization.save": "Enregistrer",
  "organization.delete": "Supprimer l'organisation",
  "organization.deleteTitle": "Supprimer {name} ?",
  "organization.deleteBody":
    "Cela supprime l'organisation, ses membres et son coffre partagé pour tout le monde. Cette action est irréversible.",
  "organization.leave": "Quitter l'organisation",
  "organization.leaveTitle": "Quitter {name} ?",
  "organization.leaveBody":
    "Ses éléments partagés disparaissent de votre coffre. Un propriétaire peut vous ajouter de nouveau.",
  "organization.members": "Membres",
  "organization.memberRole": "Rôle de {name}",
  "organization.memberRemove": "Retirer {name}",
  "organization.memberRemoveTitle": "Retirer {name} ?",
  "organization.memberRemoveBody": "Cette personne perd l'accès à cette organisation et à ses éléments partagés.",
  "organization.addMember": "Ajouter un membre",
  "organization.addMemberNumber": "Numéro WhatsApp",
  "organization.addMemberRole": "Rôle",
  "organization.vault.title": "Coffre de l'organisation",
  "organization.vault.intro":
    "Copiez des éléments de votre coffre dans cette organisation. Seuls les éléments que vous partagez avec l'équipe apparaissent dans le coffre de chaque membre.",
  "organization.vault.managersOnly": "Seuls les propriétaires et les administrateurs gèrent ce coffre.",
  "organization.vault.empty": "Cette organisation n'a pas encore d'éléments dans son coffre.",
  "organization.vault.share": "Partager avec l'équipe",
  "organization.vault.shareHint": "Les membres voient cet élément dans leur coffre et leurs agents peuvent l'utiliser.",
  "organization.vault.remove": "Retirer {name} du coffre de l'organisation",
  "organization.vault.removeTitle": "Retirer {name} ?",
  "organization.vault.removeBody":
    "Il disparaît du coffre de l'organisation et du coffre de chaque membre. Votre propre copie ne change pas.",
  "organization.vault.add": "Ajouter depuis mon coffre",
  "organization.vault.addPick": "Choisir un élément",
  "organization.vault.addEmpty": "Votre coffre n'a aucun élément à ajouter.",
  "organization.vault.addConfirm": "Ajouter",
  "organization.failed": "Une erreur s'est produite. Réessayez.",
} as const satisfies PartialTranslation<typeof source>;
