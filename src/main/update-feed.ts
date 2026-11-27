/**
 * Whether the desktop app checks for and installs updates by itself.
 *
 * The feed is the `publish:` location in `electron-builder.yml`. `scripts/release-desktop.ts` uploads a
 * release to it. Set this to `false` before `publish:` names a location that this product does not own.
 */
export const AUTOMATIC_UPDATES_ENABLED = true;
