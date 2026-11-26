/** The product name people see. The `OpenBot` identifiers in code, packages and protocols stay as they are. */
export const PRODUCT_NAME = "Jujurly";

/** The name the upstream catalogs still contain. The i18n layer renders it as the product name. */
export const UPSTREAM_PRODUCT_NAME = "OpenBot";

export const UPSTREAM_WORD = /\bOpenBot\b/gu;

/**
 * Replaces the whole word `OpenBot` with the product name. It does not touch `openbot://`, `@openbot/*`,
 * `OpenBotDatabase` or other identifiers, because those have no word boundary around `OpenBot`.
 */
export function brandText(text: string): string {
  return text.includes(UPSTREAM_PRODUCT_NAME) ? text.replace(UPSTREAM_WORD, PRODUCT_NAME) : text;
}

/** The one host that serves both the account service API and the site. */
export const ACCOUNT_SERVICE_ORIGIN = "https://jujurly.id";

/** Where people download the app. The account service shows a page there until an own download location exists. */
export const DOWNLOAD_URL = `${ACCOUNT_SERVICE_ORIGIN}/download`;

/** The application id of the packaged desktop app, which `electron-builder.yml` (`appId`) must match. */
export const DESKTOP_APP_ID = "id.jujurly.bot.desktop";
