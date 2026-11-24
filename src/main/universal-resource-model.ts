import { createHash } from "node:crypto";
import {
  decodeUniversalTargets,
  isMcpKeyValue,
  type McpKeyValue,
  type McpServerConfig,
  UNIVERSAL_DEVICE_NAME_MAX,
  type UniversalSkillAgents,
  type UniversalTargets,
} from "@openbot/contracts/ipc";
import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Schema } from "effect";
import { canonicalJson } from "./universal-vault-crypto";

export const DEVICE_REFRESH_MS = 24 * 60 * 60_000;

const targetsSchema = Schema.Union([
  Schema.Struct({ mode: Schema.Literal("all") }),
  Schema.Struct({ mode: Schema.Literal("only"), deviceIds: Schema.Array(Schema.String) }),
]);

const blobSchema = Schema.Struct({ blobId: Schema.String, sha256: Schema.String, size: Schema.Number });

const installSchema = Schema.Struct({ agentId: Schema.String, skillId: Schema.String });

const entrySchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["mcp", "skill"]),
  localId: Schema.NullOr(Schema.String),
  name: Schema.String,
  revision: Schema.Number,
  dirty: Schema.Boolean,
  targets: targetsSchema,
  agents: Schema.Literals(["all", "none"]),
  hash: Schema.NullOr(Schema.String),
  source: Schema.NullOr(Schema.Literals(["marketplace", "bundle"])),
  skillId: Schema.NullOr(Schema.String),
  slug: Schema.NullOr(Schema.String),
  blob: Schema.NullOr(blobSchema),
  appliedSha: Schema.NullOr(Schema.String),
  created: Schema.Boolean,
  origin: Schema.Boolean,
  installs: Schema.Array(installSchema),
  disabledBySync: Schema.Boolean,
  conflict: Schema.Boolean,
  failed: Schema.Boolean,
});

const deviceSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  platform: Schema.String,
  lastSeenAt: Schema.Number,
  revision: Schema.Number,
});

const removalSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["device", "mcp", "skill"]),
  revision: Schema.Number,
  mode: Schema.Literals(["deleted", "unshared"]),
  blobId: Schema.NullOr(Schema.String),
});

export const resourceFileSchema = Schema.Struct({
  version: Schema.Literal(1),
  deviceId: Schema.String,
  deviceName: Schema.String,
  account: Schema.NullOr(Schema.String),
  deviceRevision: Schema.Number,
  deviceDirty: Schema.Boolean,
  devicePublishedAt: Schema.Number,
  entries: Schema.Array(entrySchema),
  devices: Schema.Array(deviceSchema),
  removals: Schema.Array(removalSchema),
  staleBlobs: Schema.Array(Schema.String),
});

export type ResourceFile = typeof resourceFileSchema.Type;
export type ResourceEntry = typeof entrySchema.Type;
export type DeviceRecord = typeof deviceSchema.Type;
export type ResourceRemoval = typeof removalSchema.Type;
export type BlobRef = typeof blobSchema.Type;

export const ALL_TARGETS: UniversalTargets = { mode: "all" };

export function emptyResourceFile(deviceId: string, deviceName: string): ResourceFile {
  return {
    version: 1,
    deviceId,
    deviceName,
    account: null,
    deviceRevision: 0,
    deviceDirty: true,
    devicePublishedAt: 0,
    entries: [],
    devices: [],
    removals: [],
    staleBlobs: [],
  };
}

export function newEntry(id: string, kind: "mcp" | "skill", localId: string | null, name: string): ResourceEntry {
  return {
    id,
    kind,
    localId,
    name,
    revision: 0,
    dirty: true,
    targets: ALL_TARGETS,
    agents: "all",
    hash: null,
    source: null,
    skillId: null,
    slug: null,
    blob: null,
    appliedSha: null,
    created: false,
    origin: false,
    installs: [],
    disabledBySync: false,
    conflict: false,
    failed: false,
  };
}

export function cleanDeviceName(value: string, fallback: string): string {
  const name = value.replace(/\s+/gu, " ").trim().slice(0, UNIVERSAL_DEVICE_NAME_MAX);
  return name === "" ? fallback : name;
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function targetsPlain(targets: UniversalTargets): DynamicRecord {
  return targets.mode === "all" ? { mode: "all" } : { mode: "only", deviceIds: [...targets.deviceIds] };
}

export type McpSyncFields = Pick<
  McpServerConfig,
  "name" | "transport" | "command" | "args" | "env" | "envPassthrough" | "url" | "headers"
>;

export function mcpSyncFields(config: McpServerConfig): McpSyncFields {
  return {
    name: config.name,
    transport: config.transport,
    command: config.command,
    args: [...config.args],
    env: config.env.map(({ key, value }) => ({ key, value })),
    envPassthrough: [...config.envPassthrough],
    url: config.url,
    headers: config.headers.map(({ key, value }) => ({ key, value })),
  };
}

export function mcpHash(config: McpServerConfig): string {
  return sha256Hex(canonicalJson(mcpSyncFields(config)));
}

export function mcpPlain(config: McpServerConfig, targets: UniversalTargets): DynamicRecord {
  return { ...mcpSyncFields(config), targets: targetsPlain(targets) };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(isString)) throw new Error("Invalid list.");
  return [...value];
}

function pairList(value: unknown): McpKeyValue[] {
  if (!Array.isArray(value) || !value.every(isMcpKeyValue)) throw new Error("Invalid list.");
  return value.map(({ key, value: text }) => ({ key, value: text }));
}

export function decodeMcpPlain(plain: DynamicRecord): { fields: McpSyncFields; targets: UniversalTargets } {
  const { name, transport, command, url } = plain;
  if (!isString(name) || !isString(command) || !isString(url) || (transport !== "stdio" && transport !== "http"))
    throw new Error("Invalid MCP item.");
  return {
    fields: {
      name,
      transport,
      command,
      args: stringList(plain.args),
      env: pairList(plain.env),
      envPassthrough: stringList(plain.envPassthrough),
      url,
      headers: pairList(plain.headers),
    },
    targets: decodeUniversalTargets(plain.targets),
  };
}

export function skillPlain(entry: ResourceEntry): DynamicRecord {
  return {
    source: entry.source,
    skillId: entry.skillId,
    slug: entry.slug,
    name: entry.name,
    blob: entry.blob ? { ...entry.blob } : null,
    agents: entry.agents,
    targets: targetsPlain(entry.targets),
  };
}

export interface SkillPlain {
  source: "marketplace" | "bundle";
  skillId: string | null;
  slug: string;
  name: string;
  blob: BlobRef | null;
  agents: UniversalSkillAgents;
  targets: UniversalTargets;
}

export function decodeSkillPlain(plain: DynamicRecord): SkillPlain {
  const { source, skillId, slug, name, blob, agents } = plain;
  if ((source !== "marketplace" && source !== "bundle") || !isString(slug) || !isString(name))
    throw new Error("Invalid skill item.");
  if (agents !== "all" && agents !== "none") throw new Error("Invalid skill item.");
  if (skillId !== null && !isString(skillId)) throw new Error("Invalid skill item.");
  let decodedBlob: BlobRef | null = null;
  if (blob !== null) {
    if (!isDynamicRecord(blob) || !isString(blob.blobId) || !isString(blob.sha256) || typeof blob.size !== "number")
      throw new Error("Invalid skill item.");
    decodedBlob = { blobId: blob.blobId, sha256: blob.sha256, size: blob.size };
  }
  if (source === "marketplace" ? skillId === null : decodedBlob === null) throw new Error("Invalid skill item.");
  return { source, skillId, slug, name, blob: decodedBlob, agents, targets: decodeUniversalTargets(plain.targets) };
}

export function devicePlain(file: ResourceFile, platform: string, now: number): DynamicRecord {
  return { deviceId: file.deviceId, name: file.deviceName, platform, lastSeenAt: now };
}

export function decodeDevicePlain(plain: DynamicRecord): {
  deviceId: string;
  name: string;
  platform: string;
  lastSeenAt: number;
} {
  const { deviceId, name, platform, lastSeenAt } = plain;
  if (!isString(deviceId) || !isString(name) || !isString(platform) || typeof lastSeenAt !== "number")
    throw new Error("Invalid device item.");
  return {
    deviceId,
    name: cleanDeviceName(name, deviceId),
    platform: platform.slice(0, 32),
    lastSeenAt,
  };
}
