import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/organization";

export const messages = {
  "organization.tab": "Organizzazioni",
  "organization.title": "Organizzazioni",
  "organization.intro":
    "I team di cui fai parte. Gli elementi condivisi da un'organizzazione compaiono nella tua cassaforte con il nome dell'organizzazione e lì non si possono modificare.",
  "organization.signedOut": "Accedi al tuo account OpenBot per vedere le tue organizzazioni.",
  "organization.empty": "Non fai ancora parte di nessuna organizzazione.",
  "organization.refresh": "Aggiorna",
  "organization.syncing": "Sincronizzazione…",
  "organization.counts": "Membri {members} · Elementi condivisi {items}",
  "organization.issue.offline":
    "Impossibile raggiungere il servizio account. Vengono mostrati gli ultimi dati sincronizzati.",
  "organization.issue.notConfigured":
    "La cassaforte condivisa non è ancora configurata sul servizio account. Organizzazioni e membri funzionano, ma gli elementi condivisi non sono disponibili.",
  "organization.issue.data": "Alcuni elementi condivisi non si sono potuti leggere e sono stati saltati.",
  "organization.role.owner": "Proprietario",
  "organization.role.admin": "Amministratore",
  "organization.role.member": "Membro",
  "organization.role.platformOwner": "Proprietario della piattaforma",
  "organization.badgeHint": "Condiviso da {name}. Qui non si può modificare.",
  "organization.new": "Nuova organizzazione",
  "organization.nameLabel": "Nome",
  "organization.ownerNumberLabel": "Numero WhatsApp del proprietario",
  "organization.ownerNumberHint": "Includi il prefisso internazionale, ad esempio +628123456789.",
  "organization.create": "Crea",
  "organization.open": "Apri {name}",
  "organization.back": "Torna alle organizzazioni",
  "organization.save": "Salva",
  "organization.delete": "Elimina organizzazione",
  "organization.deleteTitle": "Eliminare {name}?",
  "organization.deleteBody":
    "Questo rimuove l'organizzazione, i suoi membri e la sua cassaforte condivisa per tutti. Non si può annullare.",
  "organization.leave": "Esci dall'organizzazione",
  "organization.leaveTitle": "Uscire da {name}?",
  "organization.leaveBody":
    "I suoi elementi condivisi spariscono dalla tua cassaforte. Un proprietario può aggiungerti di nuovo.",
  "organization.members": "Membri",
  "organization.memberRole": "Ruolo di {name}",
  "organization.memberRemove": "Rimuovi {name}",
  "organization.memberRemoveTitle": "Rimuovere {name}?",
  "organization.memberRemoveBody": "Perde l'accesso a questa organizzazione e ai suoi elementi condivisi.",
  "organization.addMember": "Aggiungi membro",
  "organization.addMemberNumber": "Numero WhatsApp",
  "organization.addMemberRole": "Ruolo",
  "organization.vault.title": "Cassaforte dell'organizzazione",
  "organization.vault.intro":
    "Copia gli elementi dalla tua cassaforte in questa organizzazione. Solo gli elementi che condividi con il team compaiono nella cassaforte di ogni membro.",
  "organization.vault.managersOnly": "Solo proprietari e amministratori gestiscono questa cassaforte.",
  "organization.vault.empty": "Questa organizzazione non ha ancora elementi nella cassaforte.",
  "organization.vault.share": "Condividi con il team",
  "organization.vault.shareHint":
    "I membri vedono questo elemento nella loro cassaforte e i loro agenti possono usarlo.",
  "organization.vault.remove": "Rimuovi {name} dalla cassaforte dell'organizzazione",
  "organization.vault.removeTitle": "Rimuovere {name}?",
  "organization.vault.removeBody":
    "Sparisce dalla cassaforte dell'organizzazione e da quella di ogni membro. La tua copia non cambia.",
  "organization.vault.add": "Aggiungi dalla mia cassaforte",
  "organization.vault.addPick": "Scegli un elemento",
  "organization.vault.addEmpty": "La tua cassaforte non ha elementi da aggiungere.",
  "organization.vault.addConfirm": "Aggiungi",
  "organization.failed": "Qualcosa è andato storto. Riprova.",
} as const satisfies PartialTranslation<typeof source>;
