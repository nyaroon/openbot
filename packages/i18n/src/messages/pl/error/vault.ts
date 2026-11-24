import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Ta fraza dostępu jest nieprawidłowa.",
  "error.vault.universalPassphraseShort": "Użyj frazy dostępu mającej co najmniej 10 znaków.",
  "error.vault.universalSignIn": "Zaloguj się na swoje konto OpenBot, aby korzystać z uniwersalnego sejfu.",
  "error.vault.universalNotSetUp": "Uniwersalny sejf nie został jeszcze skonfigurowany.",
  "error.vault.universalLocked": "Najpierw odblokuj uniwersalny sejf.",
  "error.vault.universalExists": "To konto ma już uniwersalny sejf. Odblokuj go jego frazą dostępu.",
  "error.vault.universalChanged": "Fraza dostępu została zmieniona na innym komputerze. Spróbuj ponownie.",
  "error.vault.universalUnavailable": "Nie udało się odczytać uniwersalnego sejfu na tym komputerze.",
} as const satisfies PartialTranslation<typeof source>;
