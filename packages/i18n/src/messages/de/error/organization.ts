import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/organization";

export const messages = {
  "error.organization.signIn": "Melde dich bei deinem OpenBot-Konto an, um Organisationen zu nutzen.",
  "error.organization.unreadable":
    "Die Organisationsdaten auf diesem Computer sind nicht lesbar. Sie werden erneut vom Kontodienst abgerufen.",
  "error.organization.tooLarge":
    "Die geteilten Elemente deiner Organisationen sind zu groß, um sie auf diesem Computer zu speichern.",
  "error.organization.forbidden": "Dafür fehlt dir die Berechtigung.",
  "error.organization.notFound": "Diese Organisation existiert nicht mehr oder du bist kein Mitglied.",
  "error.organization.lastOwner": "Eine Organisation braucht mindestens einen Inhaber.",
  "error.organization.memberNotFound": "Diese Person ist kein Mitglied der Organisation.",
  "error.organization.memberExists": "Diese Person ist bereits Mitglied der Organisation.",
  "error.organization.memberLimit": "Die Organisation hat die größtmögliche Zahl an Mitgliedern erreicht.",
  "error.organization.invalidPhone": "Gib eine gültige WhatsApp-Nummer mit Landesvorwahl ein.",
  "error.organization.organizationLimit": "Die größtmögliche Zahl an Organisationen ist erreicht.",
  "error.organization.notConfigured":
    "Der geteilte Tresor ist im Kontodienst noch nicht eingerichtet. Bitte den Plattforminhaber, die Einrichtung abzuschließen.",
  "error.organization.itemConflict":
    "Dieses Element wurde auf einem anderen Computer geändert. Es wurde aktualisiert, versuche es erneut.",
  "error.organization.itemLimit": "Der Organisationstresor ist voll. Entferne einige Elemente und versuche es erneut.",
  "error.organization.itemMissing": "Dieses Element ist nicht mehr im Organisationstresor.",
  "error.organization.vaultUnreadable":
    "Der Kontodienst konnte den Organisationstresor nicht lesen. Bitte den Plattforminhaber, den Schlüssel zu prüfen.",
  "error.organization.itemInvalid": "Dieses Element lässt sich nicht mit einer Organisation teilen.",
  "error.organization.personalMissing": "Dieses Element ist nicht mehr in deinem Tresor.",
  "error.organization.serverNotFound": "Dieser Server ist der Organisation nicht zugeordnet oder existiert nicht mehr.",
  "error.organization.serverTaken": "Dieser Server gehört bereits zu einer Organisation.",
  "error.organization.serverRevoked":
    "Ein Server-Admin hat dich von diesem Server entfernt. Bitte stattdessen um eine Einladung.",
  "error.organization.serverFull": "Der Server hat die höchstmögliche Mitgliederzahl erreicht.",
} as const satisfies PartialTranslation<typeof source>;
