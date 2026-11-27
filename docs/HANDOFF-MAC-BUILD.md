# Handoff: build Jujurly on a Mac

Written on 2026-11-27, after release 0.78.3 for Windows. Nothing in this document was run on a Mac.
Each step that is a guess says so.

## Where the project stands

- Repository: `https://github.com/nyaroon/openbot` (private fork of OpenBot, product name "Jujurly").
  `main` and `kirimi-whatsapp-signin` point to the same commit.
- Account service: Cloudflare Worker `openbot-auth-api` on `https://jujurly.id`. Sign-in is by
  WhatsApp number.
- Update feed: `https://jujurly.id/updates/<file>`. Windows reads `latest.yml`, macOS reads
  `latest-mac.yml`. The files are in the private bucket `wahyu-39oiud`; the feed gives a
  short-lived download link.
- Windows: 0.78.3 is in the feed. It has the OpenBot import and it was tried on the Windows host.
- macOS: no build exists yet.

## What the Mac needs

1. macOS 13 or newer, and the Xcode command line tools: `xcode-select --install`.
2. Node 24 (see `.nvmrc`) and Bun 1.4.2 (see `packageManager` in `package.json`).
3. The repository:

   ```sh
   git clone https://github.com/nyaroon/openbot.git
   cd openbot
   bun install
   ```

4. The upload token. It is not in git. Copy `apps/auth-api/.env.release-token` from the Windows
   computer to the same path on the Mac by hand, or set the `JUJURLY_RELEASE_TOKEN` variable. Do not
   commit it and do not paste it into a chat.

## Build and release

```sh
bun run release:mac
```

The script (`scripts/release-desktop.ts`) does this on a Mac:

1. Raises the patch version in `package.json`.
2. Runs `bun run dist:mac`, which builds for the processor of this Mac.
3. Uploads each file that `dist/latest-mac.yml` names (the `.zip`), its `.blockmap` if there is one,
   and the `.dmg`.
4. Uploads `latest-mac.yml` last.

Flags: `--no-bump` keeps the version, `--no-build` uploads what is in `dist/` already.

To build without a release, run `bun run dist:mac`. The `.dmg` in `dist/` is the file for a first
install.

### Keep one version number for both systems

Windows and macOS share the version in `package.json`. Version 0.78.3 is released for Windows, so
build the same version for the Mac first:

```sh
bun run release:mac --no-bump
```

For a new version, release on one system, commit and push `package.json` and `CHANGELOG.md`, pull on
the other system, and release there with `--no-bump`.

### The changelog rule

The commit hook refuses a new version in `package.json` unless `CHANGELOG.md` has a section
`## [<version>]`. Add the section, then commit. Notes for unreleased changes go in
`changelog.d/kirimi-whatsapp-signin.md`.

## Signature and notarization

`dist:mac` builds without a signature: it passes `--config.mac.identity=null` and
`--config.mac.notarize=false`. Expect this from such a build (not tested):

- macOS blocks the first start. Open the app with a right-click and "Open", or remove the quarantine
  mark: `xattr -dr com.apple.quarantine /Applications/Jujurly.app`.
- On a Mac with Apple silicon, an app with no signature at all does not start. If that happens, sign
  it for this computer only: `codesign --force --deep --sign - /Applications/Jujurly.app`.
- Automatic updates do not work. The macOS updater accepts only a signed app.

For a build that other Macs accept and that updates itself, you need an Apple Developer account:

1. A "Developer ID Application" certificate, exported as a `.p12` file.
2. These variables in the shell (`scripts/release-preflight.ts` lists them): `CSC_LINK`,
   `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
3. In `electron-builder.yml`, replace `ElectronTeamID: ZTRDTUL87R` with your own team. That value is
   the team of the OpenBot project.
4. A build command without the two flags that turn the signature off. `dist:mac` has them, so add a
   script next to it, for example `dist:mac:signed`, that ends with `electron-builder --mac`, and
   make `scripts/release-desktop.ts` call it when `CSC_LINK` is set.

Step 4 is not written yet.

## What happens at the first start on the Mac

1. Jujurly starts with an empty data folder (`~/Library/Application Support/Jujurly`).
2. If the Mac has OpenBot data (`~/Library/Application Support/OpenBot/openbot.db`), Jujurly asks,
   before the sign-in screen: "Import and restart", "Not now" or "Do not ask again". This is a system
   dialog, not a page in the app.
3. "Import and restart" copies the data and restarts. The old Jujurly data moves to
   `before-openbot-import-<time>` inside the Jujurly data folder.
4. Then sign in with the WhatsApp number. The OpenBot account sign-in does not carry over.

To get the question again later, start the app with `--import-openbot`:

```sh
open -a Jujurly --args --import-openbot
```

Rules of the import:

- Quit OpenBot first. The import refuses while OpenBot runs, and the two apps must not run at the
  same time afterwards, because both would host the same server.
- The import refuses OpenBot data that is newer than schema version 70. The Windows host had
  OpenBot 0.80 at schema 70.
- If the Mac has no OpenBot data, there is no question. Jujurly starts as a new installation, and you
  create or join a server after the sign-in.

### Risk on macOS: encrypted items

On Windows the key that encrypts the vault, the provider tokens and the remote sessions is in the
file `Local State`, which the import copies. On macOS the key is in the Keychain, in an item named
after the app ("OpenBot Safe Storage"). Jujurly will ask the Keychain for "Jujurly Safe Storage",
which is another key. So on a Mac the agents, threads, skills and settings should arrive, but the
encrypted items may not open, and you may have to sign in to the providers and pair the remote
servers again. This is reasoning from how Electron stores the key. It is not tested.

The code is in `src/main/openbot-import.ts`, and the question is in `src/main/index.ts`
(`offerOpenBotImport`).

## Not verified

- Any build, start or release on macOS.
- That `dist:mac` writes `latest-mac.yml` when it does not publish.
- The automatic update from one installed version to the next, on Windows and on macOS.
- Hosting a server from Jujurly, and the links from Jujurly to the Mac servers.
- Provider sign-ins and the vault after an import.

## Open items

- The server on the VPS still takes its updates from the OpenBot releases.
- The prompts that ask users to star the repository or to post about the app are off
  (`PROMOTION_PROMPTS_ENABLED` in `src/renderer/src/features/conversation/github-star-prompt.tsx`).
  Their texts and links still name OpenBot. The plan is a setting in the owner dashboard.
- Other OpenBot names remain in the app, for example the web title in
  `apps/auth-api/src/routes/app.tsx`.
- The file `updates/probe-test.yml` in the bucket is a leftover of a test and can go.
