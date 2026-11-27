/**
 * Releases the Windows desktop app to the update feed, so that installed apps update themselves.
 *
 *   bun scripts/release-desktop.ts              raise the patch version, build, upload
 *   bun scripts/release-desktop.ts --no-bump    build and upload the version in package.json
 *   bun scripts/release-desktop.ts --no-build   upload what is in dist/ already
 *
 * Run it from PowerShell: the Windows build needs it. The upload token is read from the
 * JUJURLY_RELEASE_TOKEN variable, or from apps/auth-api/.env.release-token, which git ignores.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const origin = (process.env.JUJURLY_UPDATE_ORIGIN ?? "https://jujurly.id").replace(/\/+$/u, "");
const flags = new Set(process.argv.slice(2));

function say(message: string): void {
  process.stdout.write(`${message}
`);
}

function fail(message: string): never {
  process.stderr.write(`${message}
`);
  process.exit(1);
}

function releaseToken(): string {
  const file = join(root, "apps", "auth-api", ".env.release-token");
  const token =
    process.env.JUJURLY_RELEASE_TOKEN?.trim() || (existsSync(file) ? readFileSync(file, "utf8").trim() : "");
  return token || fail("No upload token. Set JUJURLY_RELEASE_TOKEN or write apps/auth-api/.env.release-token.");
}

function raiseVersion(): string {
  const file = join(root, "package.json");
  const text = readFileSync(file, "utf8");
  const match = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/u.exec(text);
  if (!match) fail("package.json has no version of the form 1.2.3.");
  const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  writeFileSync(file, text.replace(match[0], `"version": "${next}"`));
  return next;
}

async function build(): Promise<void> {
  const child = Bun.spawn(["bun", "run", "dist:win"], { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) fail("The build failed. Nothing was uploaded.");
}

async function upload(token: string, name: string): Promise<void> {
  const file = Bun.file(join(root, "dist", name));
  if (!(await file.exists())) fail(`dist/${name} is missing.`);
  const asked = await fetch(`${origin}/v1/admin/updates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file: name }),
  });
  if (!asked.ok) fail(`The account service refused the upload of ${name} (${asked.status}).`);
  const answer = await asked.json();
  const url = typeof answer === "object" && answer !== null && "url" in answer ? answer.url : null;
  if (typeof url !== "string") fail(`The account service gave no upload link for ${name}.`);
  const sent = await fetch(url, { method: "PUT", body: file });
  if (!sent.ok) {
    const code = /<Code>([^<]+)<\/Code>/u.exec(await sent.text())?.[1];
    fail(`The storage refused ${name} (${sent.status}${code ? `, ${code}` : ""}).`);
  }
  say(`Uploaded ${name} (${Math.round(file.size / 1_048_576)} MB).`);
}

const token = releaseToken();
if (!flags.has("--no-build")) {
  if (!flags.has("--no-bump")) say(`Version ${raiseVersion()}.`);
  await build();
}
const manifest = readFileSync(join(root, "dist", "latest.yml"), "utf8");
const installer = /^path:\s*(\S+)\s*$/mu.exec(manifest)?.[1];
if (!installer) fail("dist/latest.yml names no installer.");
const version = /^version:\s*(\S+)\s*$/mu.exec(manifest)?.[1] ?? "?";
// The feed file goes last: an app that reads it must find the installer that it names.
await upload(token, installer);
await upload(token, `${installer}.blockmap`);
await upload(token, "latest.yml");
say(`Released ${version}. Installed apps find it at ${origin}/updates/latest.yml.`);
