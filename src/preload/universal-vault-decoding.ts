import { UNIVERSAL_VAULT_ISSUES, UNIVERSAL_VAULT_STATUSES, type UniversalVaultState } from "@openbot/contracts/ipc";
import { decodeRecord, requiredBoolean, requiredNumber } from "@openbot/contracts/ipc-decoding";
import { isOneOf } from "@openbot/contracts/runtime-values";

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
  };
}
