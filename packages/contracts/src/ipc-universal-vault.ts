import type { VaultItemKind } from "./ipc-vault";
import { isDynamicRecord, isString } from "./runtime-values";

export const UNIVERSAL_VAULT_STATUSES = ["signedOut", "notSetUp", "locked", "unlocked"] as const;
export type UniversalVaultStatus = (typeof UNIVERSAL_VAULT_STATUSES)[number];

export const UNIVERSAL_VAULT_ISSUES = ["offline", "limit", "data"] as const;
export type UniversalVaultIssue = (typeof UNIVERSAL_VAULT_ISSUES)[number];

export type UniversalVaultUnshareScope = "all-devices" | "this-device";

export const UNIVERSAL_RESOURCE_KINDS = ["mcp", "skill"] as const;
export type UniversalResourceKind = (typeof UNIVERSAL_RESOURCE_KINDS)[number];

export const UNIVERSAL_SKILL_AGENTS = ["all", "none"] as const;
export type UniversalSkillAgents = (typeof UNIVERSAL_SKILL_AGENTS)[number];

export const UNIVERSAL_COUNT_KINDS = ["login", "card", "contact", "apiKey", "mcp", "skill", "device"] as const;
export type UniversalCountKind = (typeof UNIVERSAL_COUNT_KINDS)[number];

export const UNIVERSAL_DEVICE_NAME_MAX = 60;
export const UNIVERSAL_DEVICE_LIMIT = 50;

export type UniversalTargets = { mode: "all" } | { mode: "only"; deviceIds: readonly string[] };

export interface UniversalComputer {
  id: string;
  name: string;
  platform: string;
  lastSeenAt: number;
  current: boolean;
}

export interface UniversalResource {
  id: string;
  kind: UniversalResourceKind;
  localId: string | null;
  name: string;
  slug: string | null;
  targets: UniversalTargets;
  agents: UniversalSkillAgents;
  on: boolean;
}

export type UniversalCounts = Record<UniversalCountKind, number>;

export interface UniversalVaultState {
  status: UniversalVaultStatus;
  busy: boolean;
  pending: number;
  lastSyncAt: number | null;
  issue: UniversalVaultIssue | null;
  failed: number;
  conflicts: number;
  counts: UniversalCounts;
  deviceId: string;
  computers: UniversalComputer[];
  resources: UniversalResource[];
}

export interface UniversalVaultSetUpInput {
  passphrase: string;
}

export interface UniversalVaultChangePassphraseInput {
  current: string;
  next: string;
}

export interface UniversalVaultSetItemInput {
  id: string;
  kind: VaultItemKind;
  universal: boolean;
  scope?: UniversalVaultUnshareScope;
}

export interface UniversalVaultSetResourceInput {
  kind: UniversalResourceKind;
  localId: string;
  agentId?: string;
  universal: boolean;
  targets?: UniversalTargets;
  agents?: UniversalSkillAgents;
}

export interface UniversalVaultSetTargetsInput {
  id: string;
  targets: UniversalTargets;
  agents?: UniversalSkillAgents;
}

export interface UniversalVaultRenameComputerInput {
  name: string;
}

export interface UniversalVaultRemoveComputerInput {
  id: string;
}

export function emptyUniversalCounts(): UniversalCounts {
  return { login: 0, card: 0, contact: 0, apiKey: 0, mcp: 0, skill: 0, device: 0 };
}

export const EMPTY_UNIVERSAL_VAULT: UniversalVaultState = {
  status: "signedOut",
  busy: false,
  pending: 0,
  lastSyncAt: null,
  issue: null,
  failed: 0,
  conflicts: 0,
  counts: emptyUniversalCounts(),
  deviceId: "",
  computers: [],
  resources: [],
};

export function decodeUniversalTargets(value: unknown): UniversalTargets {
  if (!isDynamicRecord(value)) throw new Error("Invalid targets.");
  if (value.mode === "all") return { mode: "all" };
  if (
    value.mode === "only" &&
    Array.isArray(value.deviceIds) &&
    value.deviceIds.length <= UNIVERSAL_DEVICE_LIMIT &&
    value.deviceIds.every((id) => isString(id) && id.length > 0 && id.length <= 64)
  )
    return { mode: "only", deviceIds: [...new Set(value.deviceIds.filter(isString))] };
  throw new Error("Invalid targets.");
}

export function universalTargetsOn(targets: UniversalTargets, deviceId: string): boolean {
  return targets.mode === "all" || targets.deviceIds.includes(deviceId);
}
