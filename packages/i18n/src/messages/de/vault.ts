import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Universeller Tresor",
  "vault.universal.intro":
    "Elemente, die du als Universell markierst, werden auf diesem Computer verschlüsselt und mit jedem Computer synchronisiert, der bei deinem Konto angemeldet ist. Der Kontodienst sieht weder die Elemente noch deine Passphrase.",
  "vault.universal.signedOut": "Melde dich bei deinem OpenBot-Konto an, um den Universellen Tresor zu nutzen.",
  "vault.universal.passphrase": "Passphrase",
  "vault.universal.passphraseHint":
    "Verwende mindestens 10 Zeichen. Wenn du sie verlierst, lassen sich die synchronisierten Elemente nicht wiederherstellen.",
  "vault.universal.setUp": "Einrichten",
  "vault.universal.unlock": "Entsperren",
  "vault.universal.lockedHint":
    "Gib deine Passphrase ein, um den Universellen Tresor auf diesem Computer zu entsperren.",
  "vault.universal.syncing": "Synchronisierung läuft …",
  "vault.universal.upToDate": "Auf dem neuesten Stand",
  "vault.universal.neverSynced": "Noch nicht synchronisiert",
  "vault.universal.pending": {
    one: "{count} Änderung wartet auf die Synchronisierung",
    other: "{count} Änderungen warten auf die Synchronisierung",
  },
  "vault.universal.issueOffline": "Der Kontodienst ist nicht erreichbar. OpenBot versucht es erneut.",
  "vault.universal.issueLimit":
    "Der Universelle Tresor ist voll. Beende die Synchronisierung einiger Elemente, um weitere hinzuzufügen.",
  "vault.universal.issueData": "Einige Elemente konnten nicht synchronisiert werden.",
  "vault.universal.syncNow": "Jetzt synchronisieren",
  "vault.universal.changePassphrase": "Passphrase ändern",
  "vault.universal.currentPassphrase": "Aktuelle Passphrase",
  "vault.universal.newPassphrase": "Neue Passphrase",
  "vault.universal.applyChange": "Ändern",
  "vault.universal.dismiss": "Abbrechen",
  "vault.universal.forget": "Auf diesem Gerät vergessen",
  "vault.universal.toggle": "Universell",
  "vault.universal.toggleHint": "Dieses Element mit allen deinen Computern synchronisieren",
  "vault.universal.badge": "Universell",
  "vault.universal.unshareTitle": "Synchronisierung dieses Elements beenden?",
  "vault.universal.unshareBody": "Wähle, was mit den Kopien auf deinen anderen Computern geschieht.",
  "vault.universal.unshareEverywhere": "Überall nicht mehr synchronisieren",
  "vault.universal.unshareEverywhereHint": "Jeder Computer behält seine eigene Kopie.",
  "vault.universal.unshareHere": "Auf diesem Computer nicht mehr synchronisieren",
  "vault.universal.unshareHereHint": "Andere Computer synchronisieren es weiter.",
  "vault.universal.deleteNote": "Dieses universelle Element wird auf allen deinen Computern gelöscht.",
  "vault.universal.conflictCopy": "(Konfliktkopie)",
} as const satisfies PartialTranslation<typeof source>;
