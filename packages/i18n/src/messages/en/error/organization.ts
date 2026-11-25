import { defineMessages } from "../../../message";

export const messages = defineMessages("error.organization", {
  "error.organization.signIn": "Sign in to your OpenBot account to use organizations.",
  "error.organization.unreadable":
    "The organization data on this computer is unreadable. It will be fetched again from the account service.",
  "error.organization.tooLarge": "The shared items of your organizations are too large to keep on this computer.",
  "error.organization.forbidden": "You do not have permission to do this.",
  "error.organization.notFound": "This organization no longer exists, or you are not a member of it.",
  "error.organization.lastOwner": "An organization needs at least one owner.",
  "error.organization.memberNotFound": "This person is not a member of the organization.",
  "error.organization.memberExists": "This person is a member of the organization already.",
  "error.organization.memberLimit": "The organization has the largest number of members it can have.",
  "error.organization.invalidPhone": "Enter a valid WhatsApp number with the country code.",
  "error.organization.organizationLimit": "The largest number of organizations has been reached.",
  "error.organization.notConfigured":
    "The shared vault is not set up on the account service yet. Ask the platform owner to finish its setup.",
  "error.organization.itemConflict": "This item was changed on another computer. It has been refreshed, so try again.",
  "error.organization.itemLimit": "The organization vault is full. Remove some items, then try again.",
  "error.organization.itemMissing": "This item is no longer in the organization vault.",
  "error.organization.vaultUnreadable":
    "The account service could not read the organization vault. Ask the platform owner to check its key.",
  "error.organization.itemInvalid": "This item cannot be shared with an organization.",
  "error.organization.personalMissing": "This item is no longer in your Vault.",
  "error.organization.serverNotFound": "This server is not attached to the organization, or it no longer exists.",
  "error.organization.serverTaken": "This server already belongs to an organization.",
  "error.organization.serverRevoked": "A server admin removed you from this server. Ask for an invitation instead.",
  "error.organization.serverFull": "The server has the largest number of members it can have.",
});
