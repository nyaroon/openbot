import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Coffre universel",
  "vault.universal.intro":
    "Les éléments que vous marquez comme Universel sont chiffrés sur cet ordinateur et synchronisés avec chaque ordinateur connecté à votre compte. Le service de compte ne les voit jamais, pas plus que votre phrase secrète.",
  "vault.universal.signedOut": "Connectez-vous à votre compte OpenBot pour utiliser le coffre universel.",
  "vault.universal.passphrase": "Phrase secrète",
  "vault.universal.passphraseHint":
    "Utilisez au moins 10 caractères. Si vous la perdez, les éléments synchronisés ne pourront pas être récupérés.",
  "vault.universal.setUp": "Configurer",
  "vault.universal.unlock": "Déverrouiller",
  "vault.universal.lockedHint":
    "Saisissez votre phrase secrète pour déverrouiller le coffre universel sur cet ordinateur.",
  "vault.universal.syncing": "Synchronisation…",
  "vault.universal.upToDate": "À jour",
  "vault.universal.neverSynced": "Pas encore synchronisé",
  "vault.universal.pending": {
    one: "{count} modification attend d’être synchronisée",
    other: "{count} modifications attendent d’être synchronisées",
  },
  "vault.universal.issueOffline": "Le service de compte est injoignable. OpenBot réessaiera.",
  "vault.universal.issueLimit":
    "Le coffre universel est plein. Arrêtez la synchronisation de certains éléments pour en ajouter.",
  "vault.universal.issueData": "Certains éléments n’ont pas pu être synchronisés.",
  "vault.universal.syncNow": "Synchroniser maintenant",
  "vault.universal.changePassphrase": "Changer la phrase secrète",
  "vault.universal.currentPassphrase": "Phrase secrète actuelle",
  "vault.universal.newPassphrase": "Nouvelle phrase secrète",
  "vault.universal.applyChange": "Changer",
  "vault.universal.dismiss": "Annuler",
  "vault.universal.forget": "Oublier sur cet appareil",
  "vault.universal.toggle": "Universel",
  "vault.universal.toggleHint": "Synchroniser cet élément avec tous vos ordinateurs",
  "vault.universal.badge": "Universel",
  "vault.universal.unshareTitle": "Arrêter la synchronisation de cet élément ?",
  "vault.universal.unshareBody": "Choisissez ce qu’il advient des copies sur vos autres ordinateurs.",
  "vault.universal.unshareEverywhere": "Arrêter la synchronisation partout",
  "vault.universal.unshareEverywhereHint": "Chaque ordinateur garde sa propre copie.",
  "vault.universal.unshareHere": "Arrêter la synchronisation sur cet ordinateur",
  "vault.universal.unshareHereHint": "Les autres ordinateurs continuent de le synchroniser.",
  "vault.universal.deleteNote": "Cet élément universel sera supprimé sur tous vos ordinateurs.",
  "vault.universal.conflictCopy": "(copie de conflit)",
} as const satisfies PartialTranslation<typeof source>;
