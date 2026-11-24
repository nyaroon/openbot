import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/vault";

export const messages = {
  "vault.universal.title": "Cassaforte universale",
  "vault.universal.intro":
    "Gli elementi che contrassegni come Universale vengono cifrati su questo computer e sincronizzati con ogni computer collegato al tuo account. Il servizio account non li vede mai, né vede la tua passphrase.",
  "vault.universal.signedOut": "Accedi al tuo account OpenBot per usare la cassaforte universale.",
  "vault.universal.passphrase": "Passphrase",
  "vault.universal.passphraseHint":
    "Usa almeno 10 caratteri. Se la perdi, gli elementi sincronizzati non possono essere recuperati.",
  "vault.universal.setUp": "Configura",
  "vault.universal.unlock": "Sblocca",
  "vault.universal.lockedHint": "Inserisci la passphrase per sbloccare la cassaforte universale su questo computer.",
  "vault.universal.syncing": "Sincronizzazione in corso…",
  "vault.universal.upToDate": "Aggiornato",
  "vault.universal.neverSynced": "Non ancora sincronizzato",
  "vault.universal.pending": {
    one: "{count} modifica è in attesa di sincronizzazione",
    other: "{count} modifiche sono in attesa di sincronizzazione",
  },
  "vault.universal.issueOffline": "Il servizio account non è raggiungibile. OpenBot riproverà.",
  "vault.universal.issueLimit":
    "La cassaforte universale è piena. Interrompi la sincronizzazione di alcuni elementi per aggiungerne altri.",
  "vault.universal.issueData": "Alcuni elementi non sono stati sincronizzati.",
  "vault.universal.syncNow": "Sincronizza ora",
  "vault.universal.changePassphrase": "Cambia passphrase",
  "vault.universal.currentPassphrase": "Passphrase attuale",
  "vault.universal.newPassphrase": "Nuova passphrase",
  "vault.universal.applyChange": "Cambia",
  "vault.universal.dismiss": "Annulla",
  "vault.universal.forget": "Dimentica su questo dispositivo",
  "vault.universal.toggle": "Universale",
  "vault.universal.toggleHint": "Sincronizza questo elemento con tutti i tuoi computer",
  "vault.universal.badge": "Universale",
  "vault.universal.unshareTitle": "Interrompere la sincronizzazione di questo elemento?",
  "vault.universal.unshareBody": "Scegli cosa succede alle copie sugli altri computer.",
  "vault.universal.unshareEverywhere": "Interrompi la sincronizzazione ovunque",
  "vault.universal.unshareEverywhereHint": "Ogni computer conserva la propria copia.",
  "vault.universal.unshareHere": "Interrompi la sincronizzazione su questo computer",
  "vault.universal.unshareHereHint": "Gli altri computer continuano a sincronizzarlo.",
  "vault.universal.deleteNote": "Questo elemento universale verrà eliminato su tutti i tuoi computer.",
  "vault.universal.conflictCopy": "(copia per conflitto)",
} as const satisfies PartialTranslation<typeof source>;
