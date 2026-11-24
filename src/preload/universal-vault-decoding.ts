import {
  decodeUniversalTargets,
  UNIVERSAL_COUNT_KINDS,
  UNIVERSAL_RESOURCE_KINDS,
  UNIVERSAL_SKILL_AGENTS,
  UNIVERSAL_VAULT_ISSUES,
  UNIVERSAL_VAULT_STATUSES,
  type UniversalComputer,
  type UniversalCounts,
  type UniversalResource,
  type UniversalVaultState,
} from "@openbot/contracts/ipc";
import {
  decodeList,
  decodeRecord,
  requiredBoolean,
  requiredNumber,
  requiredString,
} from "@openbot/contracts/ipc-decoding";
import { isOneOf, isString } from "@openbot/contracts/runtime-values";

function decodeCounts(value: unknown): UniversalCounts {
  const record = decodeRecord(value, "Universal vault counts");
  const counts: UniversalCounts = { login: 0, card: 0, contact: 0, apiKey: 0, mcp: 0, skill: 0, device: 0 };
  for (const kind of UNIVERSAL_COUNT_KINDS) counts[kind] = requiredNumber(record, kind);
  return counts;
}

function decodeComputer(record: ReturnType<typeof decodeRecord>): UniversalComputer {
  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    platform: requiredString(record, "platform"),
    lastSeenAt: requiredNumber(record, "lastSeenAt"),
    current: requiredBoolean(record, "current"),
  };
}

function decodeResource(record: ReturnType<typeof decodeRecord>): UniversalResource {
  const { kind, agents, localId, slug } = record;
  if (!isOneOf(UNIVERSAL_RESOURCE_KINDS, kind) || !isOneOf(UNIVERSAL_SKILL_AGENTS, agents))
    throw new Error("Invalid Universal resource.");
  if ((localId !== null && !isString(localId)) || (slug !== null && !isString(slug)))
    throw new Error("Invalid Universal resource.");
  return {
    id: requiredString(record, "id"),
    kind,
    localId,
    name: requiredString(record, "name"),
    slug,
    targets: decodeUniversalTargets(record.targets),
    agents,
    on: requiredBoolean(record, "on"),
  };
}

export function decodeUniversalVaultState(value: unknown): UniversalVaultState {
  const state = decodeRecord(value, "Universal vault state");
  if (!isOneOf(UNIVERSAL_VAULT_STATUSES, state.status)) throw new Error("Invalid Universal vault status.");
  const issue = state.issue;
  if (issue !== null && !isOneOf(UNIVERSAL_VAULT_ISSUES, issue)) throw new Error("Invalid Universal vault issue.");
  const lastSyncAt = state.lastSyncAt;
  if (lastSyncAt !== null && typeof lastSyncAt !== "number") throw new Error("Invalid Universal vault sync time.");
  return {
    status: state.status,
    busy: requiredBoolean(state, "busy"),
    pending: requiredNumber(state, "pending"),
    lastSyncAt,
    issue,
    failed: requiredNumber(state, "failed"),
    conflicts: requiredNumber(state, "conflicts"),
    counts: decodeCounts(state.counts),
    deviceId: requiredString(state, "deviceId"),
    computers: decodeList(state.computers, "Universal computers", decodeComputer),
    resources: decodeList(state.resources, "Universal resources", decodeResource),
  };
}
