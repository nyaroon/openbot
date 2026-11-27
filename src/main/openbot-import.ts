import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Brings the data of an OpenBot installation on this computer into this app: agents, threads,
 * provider sign-ins, skills, the vault and the server that this computer hosts.
 *
 * It runs in two steps, because the files must be in place before the app reads any of them.
 * The app asks after it started, writes a request file and restarts. The next start finds the
 * request file and copies the data before anything else opens the data folder.
 */

const REQUEST_FILE = "openbot-import-request-v1.json";
const RESULT_FILE = "openbot-import-result-v1.json";
const DECISION_FILE = "openbot-import-decision-v1.json";
const DATABASE_FILE = "openbot.db";
const BACKUP_PREFIX = "before-openbot-import-";

/**
 * The newest OpenBot database that this app reads. In a newer one, the migration numbers mean
 * other changes than the same numbers here, so the app cannot tell what the database holds.
 */
export const NEWEST_IMPORTABLE_OPENBOT_SCHEMA = 70;

/** Folders that the app builds again, or that are only useful to the installation they came from. */
const SKIPPED_DIRECTORIES = new Set([
  "Cache",
  "Code Cache",
  "GPUCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "GrShaderCache",
  "GPUPersistentCache",
  "ShaderCache",
  "Crashpad",
  "blob_storage",
  "Session Storage",
  "Shared Dictionary",
  "WebStorage",
  "Network",
  "Partitions",
  "IndexedDB",
  "Local Storage",
  "logs",
  "provider-runtimes",
  "provider-temp",
  "runtimes",
  "remote-desktop-runtime",
  "cua-driver",
]);

/**
 * Files that must not move. The sign-in belongs to the account service of OpenBot, and the rest
 * describes one run of that installation.
 */
const SKIPPED_FILES = new Set([
  "openbot-central-auth-v1.bin",
  "openbot-run-marker-v1.json",
  "openbot-start-attempts-v1.json",
  "openbot-analytics-install-id-v1.json",
  "startup-history.json",
  ".updaterId",
  "lockfile",
  "SingletonLock",
  "SingletonCookie",
  "SingletonSocket",
]);

/** What stays in the data folder of this app when its old content moves to the backup. */
const KEPT_ON_BACKUP = new Set(["logs", "lockfile", "SingletonLock", "SingletonCookie", "SingletonSocket"]);

function skipped(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name) || SKIPPED_FILES.has(name) || name.startsWith("DIPS") || name.endsWith(".tmp");
}

export type OpenBotImportRefusal = "no_data" | "running" | "newer_data";

export interface OpenBotImportSource {
  directory: string;
  schemaVersion: number;
}

/** The folder where an OpenBot installation of this user keeps its data. */
export function openBotDataDirectory(appDataPath: string): string {
  return join(appDataPath, "OpenBot");
}

/** Whether an OpenBot that uses this data folder is running now. */
export function openBotIsRunning(directory: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform === "win32") {
    const lock = join(directory, "lockfile");
    if (!existsSync(lock)) return false;
    try {
      closeSync(openSync(lock, "r+"));
      return false;
    } catch {
      return true;
    }
  }
  try {
    const pid = Number(readlinkSync(join(directory, "SingletonLock")).split("-").at(-1));
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Looks at the OpenBot data of this user and says whether this app can take it. */
export function inspectOpenBotData(
  directory: string,
  platform: NodeJS.Platform = process.platform,
): OpenBotImportSource | OpenBotImportRefusal {
  const database = join(directory, DATABASE_FILE);
  if (!existsSync(database)) return "no_data";
  if (openBotIsRunning(directory, platform)) return "running";
  let schemaVersion = 0;
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const row = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get();
    schemaVersion = typeof row?.version === "number" ? row.version : 0;
  } catch {
    return "no_data";
  } finally {
    db.close();
  }
  return schemaVersion > NEWEST_IMPORTABLE_OPENBOT_SCHEMA ? "newer_data" : { directory, schemaVersion };
}

export interface OpenBotImportResult {
  ok: boolean;
  at: string;
  from: string;
  backup: string | null;
  copied: number;
  error: string | null;
}

/**
 * Replaces the data of this app with a copy of the OpenBot data. The old data of this app moves
 * to a backup folder inside the data folder, and comes back when the copy fails. The OpenBot data
 * is only read.
 */
export function importOpenBotData(source: string, userDataPath: string, now: Date): OpenBotImportResult {
  const at = now.toISOString();
  const backup = join(userDataPath, `${BACKUP_PREFIX}${at.replace(/[:.]/gu, "-")}`);
  mkdirSync(backup, { recursive: true });
  const moved: string[] = [];
  const copied: string[] = [];
  try {
    for (const name of readdirSync(userDataPath)) {
      if (name.startsWith(BACKUP_PREFIX) || KEPT_ON_BACKUP.has(name)) continue;
      if (name === REQUEST_FILE || name === RESULT_FILE || name === DECISION_FILE) continue;
      renameSync(join(userDataPath, name), join(backup, name));
      moved.push(name);
    }
    for (const name of readdirSync(source)) {
      if (skipped(name)) continue;
      cpSync(join(source, name), join(userDataPath, name), { recursive: true, errorOnExist: true, force: false });
      copied.push(name);
    }
    return { ok: true, at, from: source, backup, copied: copied.length, error: null };
  } catch (error) {
    for (const name of copied) rmSync(join(userDataPath, name), { recursive: true, force: true });
    for (const name of readdirSync(source)) {
      if (!skipped(name) && !moved.includes(name)) rmSync(join(userDataPath, name), { recursive: true, force: true });
    }
    for (const name of moved) {
      try {
        renameSync(join(backup, name), join(userDataPath, name));
      } catch {
        // The backup folder keeps what could not move back.
      }
    }
    return {
      ok: false,
      at,
      from: source,
      backup,
      copied: 0,
      error: error instanceof Error ? error.message : "The copy failed.",
    };
  }
}

/** Asks the next start of the app to import the OpenBot data. */
export function requestOpenBotImport(userDataPath: string, source: string): void {
  writeFileSync(join(userDataPath, REQUEST_FILE), JSON.stringify({ version: 1, source }));
}

/** Remembers that the user does not want the question again. */
export function declineOpenBotImport(userDataPath: string, now: Date): void {
  writeFileSync(join(userDataPath, DECISION_FILE), JSON.stringify({ version: 1, declinedAt: now.toISOString() }));
}

/**
 * Runs an import that the previous run asked for. Call it before anything reads the data folder.
 * Returns null when no import was asked for.
 */
export function runRequestedOpenBotImport(userDataPath: string, now: Date): OpenBotImportResult | null {
  const request = join(userDataPath, REQUEST_FILE);
  if (!existsSync(request)) return null;
  let source = "";
  try {
    const parsed: { source?: unknown } = JSON.parse(readFileSync(request, "utf8"));
    source = typeof parsed.source === "string" ? parsed.source : "";
  } catch {
    source = "";
  }
  // The request goes first, so that a failed import cannot repeat on every start.
  rmSync(request, { force: true });
  const inspected = source ? inspectOpenBotData(source) : "no_data";
  const result: OpenBotImportResult =
    typeof inspected === "string"
      ? { ok: false, at: now.toISOString(), from: source, backup: null, copied: 0, error: inspected }
      : importOpenBotData(inspected.directory, userDataPath, now);
  writeFileSync(join(userDataPath, RESULT_FILE), JSON.stringify({ version: 1, ...result }));
  return result;
}

/** Whether the app should ask the user now: nobody decided yet and this app holds no data of its own. */
export function shouldOfferOpenBotImport(userDataPath: string, forced: boolean): boolean {
  if (forced) return true;
  return (
    !existsSync(join(userDataPath, DECISION_FILE)) &&
    !existsSync(join(userDataPath, RESULT_FILE)) &&
    !existsSync(join(userDataPath, DATABASE_FILE))
  );
}

/** Takes the result of an import that just ran, so that the app reports it one time. */
export function takeOpenBotImportReport(userDataPath: string): OpenBotImportResult | null {
  const file = join(userDataPath, RESULT_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed: Partial<OpenBotImportResult> & { reported?: unknown } = JSON.parse(readFileSync(file, "utf8"));
    if (parsed.reported === true || typeof parsed.ok !== "boolean") return null;
    writeFileSync(file, JSON.stringify({ ...parsed, reported: true }));
    return {
      ok: parsed.ok,
      at: typeof parsed.at === "string" ? parsed.at : "",
      from: typeof parsed.from === "string" ? parsed.from : "",
      backup: typeof parsed.backup === "string" ? parsed.backup : null,
      copied: typeof parsed.copied === "number" ? parsed.copied : 0,
      error: typeof parsed.error === "string" ? parsed.error : null,
    };
  } catch {
    return null;
  }
}
