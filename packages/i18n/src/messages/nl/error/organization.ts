import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Meld je aan bij je OpenBot-account om organisaties te gebruiken.",
  "error.organization.unreadable":
    "De organisatiegegevens op deze computer zijn onleesbaar. Ze worden opnieuw opgehaald bij de accountservice.",
  "error.organization.tooLarge": "De gedeelde items van je organisaties zijn te groot om op deze computer te bewaren.",
  "error.organization.forbidden": "Je hebt hier geen toestemming voor.",
  "error.organization.notFound": "Deze organisatie bestaat niet meer of je bent er geen lid van.",
  "error.organization.lastOwner": "Een organisatie heeft minstens één eigenaar nodig.",
  "error.organization.memberNotFound": "Deze persoon is geen lid van de organisatie.",
  "error.organization.memberExists": "Deze persoon is al lid van de organisatie.",
  "error.organization.memberLimit": "De organisatie heeft het maximale aantal leden bereikt.",
  "error.organization.invalidPhone": "Voer een geldig WhatsApp-nummer met landcode in.",
  "error.organization.organizationLimit": "Het maximale aantal organisaties is bereikt.",
  "error.organization.notConfigured":
    "De gedeelde kluis is op de accountservice nog niet ingesteld. Vraag de platformeigenaar de installatie af te ronden.",
  "error.organization.itemConflict":
    "Dit item is op een andere computer gewijzigd. Het is vernieuwd, probeer het opnieuw.",
  "error.organization.itemLimit": "De organisatiekluis is vol. Verwijder enkele items en probeer het opnieuw.",
  "error.organization.itemMissing": "Dit item staat niet meer in de organisatiekluis.",
  "error.organization.vaultUnreadable":
    "De accountservice kon de organisatiekluis niet lezen. Vraag de platformeigenaar de sleutel te controleren.",
  "error.organization.itemInvalid": "Dit item kan niet met een organisatie worden gedeeld.",
  "error.organization.personalMissing": "Dit item staat niet meer in je kluis.",
} as const satisfies PartialTranslation<typeof source>;
