import {
  ORGANIZATION_ISSUES,
  ORGANIZATION_ROLES,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationSummary,
  type OrganizationsState,
  type OrganizationVault,
  type OrganizationVaultItem,
  type VaultItemKind,
} from "@openbot/contracts/ipc";
import {
  decodeList,
  decodeRecord,
  nullableString,
  requiredBoolean,
  requiredNumber,
  requiredString,
} from "@openbot/contracts/ipc-decoding";
import { type DynamicRecord, isOneOf } from "@openbot/contracts/runtime-values";

const KINDS: readonly VaultItemKind[] = ["login", "card", "contact", "apiKey"];

function decodeRole(value: unknown): OrganizationRole {
  if (!isOneOf(ORGANIZATION_ROLES, value)) throw new Error("Invalid organization role.");
  return value;
}

function decodeSummary(record: DynamicRecord): OrganizationSummary {
  return {
    id: requiredString(record, "id"),
    name: requiredString(record, "name"),
    role: record.role === null ? null : decodeRole(record.role),
    platformOwner: requiredBoolean(record, "platformOwner"),
    canManage: requiredBoolean(record, "canManage"),
    memberCount: requiredNumber(record, "memberCount"),
    sharedCount: requiredNumber(record, "sharedCount"),
    itemCount: requiredNumber(record, "itemCount"),
  };
}

export function decodeOrganizationsState(value: unknown): OrganizationsState {
  const state = decodeRecord(value, "Organizations state");
  const { issue, lastSyncAt } = state;
  if (issue !== null && !isOneOf(ORGANIZATION_ISSUES, issue)) throw new Error("Invalid organizations issue.");
  if (lastSyncAt !== null && typeof lastSyncAt !== "number") throw new Error("Invalid organizations state.");
  return {
    signedIn: requiredBoolean(state, "signedIn"),
    busy: requiredBoolean(state, "busy"),
    lastSyncAt,
    issue,
    platformOwner: requiredBoolean(state, "platformOwner"),
    organizations: decodeList(state.organizations, "Organization", decodeSummary),
  };
}

export function decodeOrganizationMembers(value: unknown): OrganizationMember[] {
  return decodeList(value, "Organization member", (record) => ({
    userId: requiredString(record, "userId"),
    phone: requiredString(record, "phone"),
    name: nullableString(record, "name"),
    role: decodeRole(record.role),
  }));
}

function decodeVaultItem(record: DynamicRecord): OrganizationVaultItem {
  const kind = KINDS.find((candidate) => candidate === record.kind);
  if (!kind) throw new Error("Invalid organization vault item.");
  return {
    id: requiredString(record, "id"),
    kind,
    title: requiredString(record, "title"),
    detail: requiredString(record, "detail"),
    shared: requiredBoolean(record, "shared"),
  };
}

export function decodeOrganizationVault(value: unknown): OrganizationVault {
  const record = decodeRecord(value, "Organization vault");
  return {
    organizationId: requiredString(record, "organizationId"),
    items: decodeList(record.items, "Organization vault item", decodeVaultItem),
  };
}
