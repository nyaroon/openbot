import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/vault";

export const messages = {
  "error.vault.unavailable": "Deze computer heeft geen opslag voor geheimen, dus de Kluis kan geen items opslaan.",
  "error.vault.unreadable": "Het bestand van de Kluis is onleesbaar. Zet de Kluis terug om hem weer te gebruiken.",
  "error.vault.tooLarge": "De Kluis is vol. Verwijder een paar items en probeer het opnieuw.",
  "error.vault.itemMissing": "Dit item staat niet meer in de Kluis.",
  "error.vault.valueTooLong": "Een waarde is te lang.",
  "error.vault.websiteInvalid": "Voer een HTTP/HTTPS-websiteadres in.",
  "error.vault.passwordRequired": "Voer een wachtwoord in.",
  "error.vault.twoStepKeyInvalid":
    "Dit is geen sleutel voor verificatie in twee stappen. Voer de instelsleutel of de otpauth://-link van de site in.",
  "error.vault.cardNumberInvalid": "Voer een geldig kaartnummer in.",
  "error.vault.securityCodeInvalid": "Voer een beveiligingscode van 3 of 4 cijfers in.",
  "error.vault.expiryInvalid": "Voer een geldige vervalmaand en vervaljaar in.",
  "error.vault.contactEmpty": "Voer een naam, adres, telefoonnummer of e-mailadres in.",
  "error.vault.contactMissing": "Het factuurcontact staat niet meer in de Kluis.",
  "error.vault.csvInvalid": "Dit bestand is geen wachtwoordexport in CSV-indeling.",
  "error.vault.csvTooLarge": "Het CSV-bestand is te groot.",
  "error.vault.universalWrongPassphrase": "Die wachtwoordzin is niet juist.",
  "error.vault.universalPassphraseShort": "Gebruik een wachtwoordzin van minstens 10 tekens.",
  "error.vault.universalSignIn": "Meld je aan bij je OpenBot-account om de universele kluis te gebruiken.",
  "error.vault.universalNotSetUp": "De universele kluis is nog niet ingesteld.",
  "error.vault.universalLocked": "Ontgrendel eerst de universele kluis.",
  "error.vault.universalExists": "Dit account heeft al een universele kluis. Ontgrendel hem met zijn wachtwoordzin.",
  "error.vault.universalChanged": "De wachtwoordzin is op een andere computer gewijzigd. Probeer het opnieuw.",
  "error.vault.universalUnavailable": "De universele kluis kon op deze computer niet worden gelezen.",
  "error.vault.universalSkillUnsupported":
    "Deze vaardigheid kan niet worden gedeeld. Ingebouwde vaardigheden en vaardigheden uit de thuismap blijven op deze computer.",
} as const satisfies PartialTranslation<typeof source>;
