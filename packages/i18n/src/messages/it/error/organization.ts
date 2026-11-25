import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Accedi al tuo account OpenBot per usare le organizzazioni.",
  "error.organization.unreadable":
    "I dati dell'organizzazione su questo computer non sono leggibili. Verranno scaricati di nuovo dal servizio account.",
  "error.organization.tooLarge":
    "Gli elementi condivisi delle tue organizzazioni sono troppo grandi per essere conservati su questo computer.",
  "error.organization.forbidden": "Non hai il permesso di farlo.",
  "error.organization.notFound": "Questa organizzazione non esiste più oppure non ne fai parte.",
  "error.organization.lastOwner": "Un'organizzazione ha bisogno di almeno un proprietario.",
  "error.organization.memberNotFound": "Questa persona non è membro dell'organizzazione.",
  "error.organization.memberExists": "Questa persona è già membro dell'organizzazione.",
  "error.organization.memberLimit": "L'organizzazione ha raggiunto il numero massimo di membri.",
  "error.organization.invalidPhone": "Inserisci un numero WhatsApp valido con il prefisso internazionale.",
  "error.organization.organizationLimit": "È stato raggiunto il numero massimo di organizzazioni.",
  "error.organization.notConfigured":
    "La cassaforte condivisa non è ancora configurata sul servizio account. Chiedi al proprietario della piattaforma di completare la configurazione.",
  "error.organization.itemConflict":
    "Questo elemento è stato modificato su un altro computer. È stato aggiornato, riprova.",
  "error.organization.itemLimit": "La cassaforte dell'organizzazione è piena. Rimuovi alcuni elementi e riprova.",
  "error.organization.itemMissing": "Questo elemento non è più nella cassaforte dell'organizzazione.",
  "error.organization.vaultUnreadable":
    "Il servizio account non ha potuto leggere la cassaforte dell'organizzazione. Chiedi al proprietario della piattaforma di controllare la sua chiave.",
  "error.organization.itemInvalid": "Questo elemento non si può condividere con un'organizzazione.",
  "error.organization.personalMissing": "Questo elemento non è più nella tua cassaforte.",
} as const satisfies PartialTranslation<typeof source>;
