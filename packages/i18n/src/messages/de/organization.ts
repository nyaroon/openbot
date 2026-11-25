import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/organization";

export const messages = {
  "organization.tab": "Organisationen",
  "organization.title": "Organisationen",
  "organization.intro":
    "Teams, denen du angehörst. Elemente, die eine Organisation teilt, erscheinen mit dem Namen der Organisation in deinem Tresor und lassen sich dort nicht ändern.",
  "organization.signedOut": "Melde dich bei deinem OpenBot-Konto an, um deine Organisationen zu sehen.",
  "organization.empty": "Du bist noch in keiner Organisation.",
  "organization.refresh": "Aktualisieren",
  "organization.syncing": "Synchronisierung läuft …",
  "organization.counts": "Mitglieder {members} · Geteilte Elemente {items}",
  "organization.issue.offline":
    "Der Kontodienst ist nicht erreichbar. Es wird der zuletzt synchronisierte Stand angezeigt.",
  "organization.issue.notConfigured":
    "Der geteilte Tresor ist im Kontodienst noch nicht eingerichtet. Organisationen und Mitglieder funktionieren, geteilte Elemente sind aber nicht verfügbar.",
  "organization.issue.data": "Einige geteilte Elemente konnten nicht gelesen werden und wurden übersprungen.",
  "organization.role.owner": "Inhaber",
  "organization.role.admin": "Admin",
  "organization.role.member": "Mitglied",
  "organization.role.platformOwner": "Plattforminhaber",
  "organization.badgeHint": "Geteilt von {name}. Hier lässt es sich nicht ändern.",
  "organization.new": "Neue Organisation",
  "organization.nameLabel": "Name",
  "organization.ownerNumberLabel": "WhatsApp-Nummer des Inhabers",
  "organization.ownerNumberHint": "Gib die Landesvorwahl an, zum Beispiel +628123456789.",
  "organization.create": "Erstellen",
  "organization.open": "{name} öffnen",
  "organization.back": "Zurück zu den Organisationen",
  "organization.save": "Speichern",
  "organization.delete": "Organisation löschen",
  "organization.deleteTitle": "{name} löschen?",
  "organization.deleteBody":
    "Dadurch werden die Organisation, ihre Mitglieder und ihr geteilter Tresor für alle entfernt. Das lässt sich nicht rückgängig machen.",
  "organization.leave": "Organisation verlassen",
  "organization.leaveTitle": "{name} verlassen?",
  "organization.leaveBody":
    "Die geteilten Elemente verschwinden aus deinem Tresor. Ein Inhaber kann dich wieder hinzufügen.",
  "organization.members": "Mitglieder",
  "organization.memberRole": "Rolle von {name}",
  "organization.memberRemove": "{name} entfernen",
  "organization.memberRemoveTitle": "{name} entfernen?",
  "organization.memberRemoveBody":
    "Diese Person verliert den Zugriff auf die Organisation und ihre geteilten Elemente.",
  "organization.addMember": "Mitglied hinzufügen",
  "organization.addMemberNumber": "WhatsApp-Nummer",
  "organization.addMemberRole": "Rolle",
  "organization.vault.title": "Organisationstresor",
  "organization.vault.intro":
    "Kopiere Elemente aus deinem Tresor in diese Organisation. Nur Elemente, die du mit dem Team teilst, erscheinen im Tresor jedes Mitglieds.",
  "organization.vault.managersOnly": "Nur Inhaber und Admins verwalten diesen Tresor.",
  "organization.vault.empty": "Diese Organisation hat noch keine Tresorelemente.",
  "organization.vault.share": "Mit dem Team teilen",
  "organization.vault.shareHint":
    "Mitglieder sehen dieses Element in ihrem Tresor und ihre Agenten können es verwenden.",
  "organization.vault.remove": "{name} aus dem Organisationstresor entfernen",
  "organization.vault.removeTitle": "{name} entfernen?",
  "organization.vault.removeBody":
    "Es verschwindet aus dem Organisationstresor und aus dem Tresor jedes Mitglieds. Deine eigene Kopie bleibt unverändert.",
  "organization.vault.add": "Aus meinem Tresor hinzufügen",
  "organization.vault.addPick": "Element auswählen",
  "organization.vault.addEmpty": "In deinem Tresor gibt es keine Elemente zum Hinzufügen.",
  "organization.vault.addConfirm": "Hinzufügen",
  "organization.failed": "Etwas ist schiefgelaufen. Versuche es erneut.",
} as const satisfies PartialTranslation<typeof source>;
