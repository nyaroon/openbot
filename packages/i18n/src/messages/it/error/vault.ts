import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Questa passphrase non è corretta.",
  "error.vault.universalPassphraseShort": "Usa una passphrase di almeno 10 caratteri.",
  "error.vault.universalSignIn": "Accedi al tuo account OpenBot per usare la cassaforte universale.",
  "error.vault.universalNotSetUp": "La cassaforte universale non è ancora configurata.",
  "error.vault.universalLocked": "Sblocca prima la cassaforte universale.",
  "error.vault.universalExists": "Questo account ha già una cassaforte universale. Sbloccala con la sua passphrase.",
  "error.vault.universalChanged": "La passphrase è cambiata su un altro computer. Riprova.",
  "error.vault.universalUnavailable": "Impossibile leggere la cassaforte universale su questo computer.",
  "error.vault.universalSkillUnsupported":
    "Questa skill non può essere condivisa. Le skill integrate e quelle della cartella home restano su questo computer.",
} as const satisfies PartialTranslation<typeof source>;
