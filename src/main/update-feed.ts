/**
 * Whether the desktop app checks for and installs updates by itself.
 *
 * It is off because the feed in `electron-builder.yml` (`publish:`) still names the upstream project's
 * releases, and this product has no release location of its own yet. Set it to `true` only after `publish:`
 * names that location.
 */
export const AUTOMATIC_UPDATES_ENABLED = false;
