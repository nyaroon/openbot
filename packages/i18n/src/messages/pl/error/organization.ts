import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Zaloguj się na konto OpenBot, aby korzystać z organizacji.",
  "error.organization.unreadable":
    "Dane organizacji na tym komputerze są nieczytelne. Zostaną ponownie pobrane z usługi kont.",
  "error.organization.tooLarge":
    "Udostępnione elementy Twoich organizacji są zbyt duże, aby przechowywać je na tym komputerze.",
  "error.organization.forbidden": "Nie masz uprawnień do tej czynności.",
  "error.organization.notFound": "Ta organizacja już nie istnieje albo nie jesteś jej członkiem.",
  "error.organization.lastOwner": "Organizacja potrzebuje co najmniej jednego właściciela.",
  "error.organization.memberNotFound": "Ta osoba nie jest członkiem organizacji.",
  "error.organization.memberExists": "Ta osoba jest już członkiem organizacji.",
  "error.organization.memberLimit": "Organizacja ma już maksymalną liczbę członków.",
  "error.organization.invalidPhone": "Wpisz prawidłowy numer WhatsApp z numerem kierunkowym kraju.",
  "error.organization.organizationLimit": "Osiągnięto maksymalną liczbę organizacji.",
  "error.organization.notConfigured":
    "Wspólny sejf nie jest jeszcze skonfigurowany w usłudze kont. Poproś właściciela platformy o dokończenie konfiguracji.",
  "error.organization.itemConflict":
    "Ten element został zmieniony na innym komputerze. Odświeżono go, spróbuj ponownie.",
  "error.organization.itemLimit": "Sejf organizacji jest pełny. Usuń kilka elementów i spróbuj ponownie.",
  "error.organization.itemMissing": "Tego elementu nie ma już w sejfie organizacji.",
  "error.organization.vaultUnreadable":
    "Usługa kont nie mogła odczytać sejfu organizacji. Poproś właściciela platformy o sprawdzenie jego klucza.",
  "error.organization.itemInvalid": "Tego elementu nie można udostępnić organizacji.",
  "error.organization.personalMissing": "Tego elementu nie ma już w Twoim sejfie.",
  "error.organization.serverNotFound": "Ten serwer nie jest przypisany do organizacji albo już nie istnieje.",
  "error.organization.serverTaken": "Ten serwer należy już do organizacji.",
  "error.organization.serverRevoked":
    "Administrator serwera usunął Cię z tego serwera. Poproś zamiast tego o zaproszenie.",
  "error.organization.serverFull": "Serwer osiągnął największą dozwoloną liczbę członków.",
} as const satisfies PartialTranslation<typeof source>;
