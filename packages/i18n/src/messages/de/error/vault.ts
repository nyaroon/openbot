import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.universalWrongPassphrase": "Diese Passphrase ist nicht korrekt.",
  "error.vault.universalPassphraseShort": "Verwende eine Passphrase mit mindestens 10 Zeichen.",
  "error.vault.universalSignIn": "Melde dich bei deinem OpenBot-Konto an, um den Universellen Tresor zu nutzen.",
  "error.vault.universalNotSetUp": "Der Universelle Tresor ist noch nicht eingerichtet.",
  "error.vault.universalLocked": "Entsperre zuerst den Universellen Tresor.",
  "error.vault.universalExists":
    "Dieses Konto hat bereits einen Universellen Tresor. Entsperre ihn mit seiner Passphrase.",
  "error.vault.universalChanged": "Die Passphrase wurde auf einem anderen Computer geändert. Versuche es erneut.",
  "error.vault.universalUnavailable": "Der Universelle Tresor konnte auf diesem Computer nicht gelesen werden.",
  "error.vault.universalSkillUnsupported":
    "Diese Fähigkeit kann nicht geteilt werden. Integrierte Fähigkeiten und Fähigkeiten aus dem Home-Ordner bleiben auf diesem Computer.",
  "error.vault.sharedReadOnly": "Dieses Element wird von einer Organisation geteilt und lässt sich hier nicht ändern.",
} as const satisfies PartialTranslation<typeof source>;
