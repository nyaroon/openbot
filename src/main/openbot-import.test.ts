import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  importOpenBotData,
  inspectOpenBotData,
  requestOpenBotImport,
  runRequestedOpenBotImport,
  shouldOfferOpenBotImport,
  takeOpenBotImportReport,
} from "./openbot-import";

const roots: string[] = [];

function folders(schemaVersion: number): { source: string; target: string } {
  const root = mkdtempSync(join(tmpdir(), "openbot-import-"));
  roots.push(root);
  const source = join(root, "OpenBot");
  const target = join(root, "Jujurly");
  mkdirSync(join(source, "local-skills"), { recursive: true });
  mkdirSync(join(source, "Cache"), { recursive: true });
  mkdirSync(target, { recursive: true });
  const db = new DatabaseSync(join(source, "openbot.db"));
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  db.prepare("INSERT INTO schema_migrations VALUES (?, 'now')").run(schemaVersion);
  db.close();
  writeFileSync(join(source, "local-skills", "skill.md"), "skill");
  writeFileSync(join(source, "Cache", "junk"), "junk");
  writeFileSync(join(source, "Local State"), "key");
  writeFileSync(join(source, "openbot-vault-v1.json"), "vault");
  writeFileSync(join(source, "openbot-central-auth-v1.bin"), "openbot sign-in");
  writeFileSync(join(target, "openbot-central-auth-v1.bin"), "own sign-in");
  writeFileSync(join(target, "openbot-setup-v2.json"), "own setup");
  return { source, target };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OpenBot import", () => {
  it("copies the data, leaves the OpenBot sign-in and caches, and backs up the old data", () => {
    const { source, target } = folders(70);
    const result = importOpenBotData(source, target, new Date("2026-11-27T10:00:00.000Z"));
    expect(result.ok).toBe(true);
    expect(readFileSync(join(target, "local-skills", "skill.md"), "utf8")).toBe("skill");
    expect(readFileSync(join(target, "Local State"), "utf8")).toBe("key");
    expect(existsSync(join(target, "openbot.db"))).toBe(true);
    expect(existsSync(join(target, "Cache"))).toBe(false);
    expect(existsSync(join(target, "openbot-central-auth-v1.bin"))).toBe(false);
    expect(readFileSync(join(result.backup ?? "", "openbot-central-auth-v1.bin"), "utf8")).toBe("own sign-in");
    expect(readFileSync(join(source, "openbot-vault-v1.json"), "utf8")).toBe("vault");
  });

  it("refuses data that a newer OpenBot saved", () => {
    const { source } = folders(71);
    expect(inspectOpenBotData(source)).toBe("newer_data");
  });

  it("reports a folder without a database as no data", () => {
    const { target } = folders(70);
    expect(inspectOpenBotData(target)).toBe("no_data");
  });

  it("runs a requested import one time and reports it one time", () => {
    const { source, target } = folders(70);
    expect(runRequestedOpenBotImport(target, new Date())).toBeNull();
    requestOpenBotImport(target, source);
    expect(runRequestedOpenBotImport(target, new Date("2026-11-27T10:00:00.000Z"))?.ok).toBe(true);
    expect(runRequestedOpenBotImport(target, new Date())).toBeNull();
    expect(takeOpenBotImportReport(target)?.ok).toBe(true);
    expect(takeOpenBotImportReport(target)).toBeNull();
    expect(readdirSync(target).filter((name) => name.startsWith("before-openbot-import-"))).toHaveLength(1);
  });

  it("keeps the old data when the requested source is gone", () => {
    const { source, target } = folders(70);
    requestOpenBotImport(target, join(source, "missing"));
    expect(runRequestedOpenBotImport(target, new Date())?.error).toBe("no_data");
    expect(readFileSync(join(target, "openbot-setup-v2.json"), "utf8")).toBe("own setup");
  });

  it("offers the import only to an app without data, unless forced", () => {
    const { source, target } = folders(70);
    expect(shouldOfferOpenBotImport(target, false)).toBe(true);
    expect(shouldOfferOpenBotImport(source, false)).toBe(false);
    expect(shouldOfferOpenBotImport(source, true)).toBe(true);
  });
});
