import type { VaultItemKind } from "./ipc-vault";

export const UNIVERSAL_VAULT_STATUSES = ["signedOut", "notSetUp", "locked", "unlocked"] as const;
export type UniversalVaultStatus = (typeof UNIVERSAL_VAULT_STATUSES)[number];

export const UNIVERSAL_VAULT_ISSUES = ["offline", "limit", "data"] as const;
export type UniversalVaultIssue = (typeof UNIVERSAL_VAULT_ISSUES)[number];

export type UniversalVaultUnshareScope = "all-devices" | "this-device";

export interface UniversalVaultState {
  status: UniversalVaultStatus;
  busy: boolean;
  pending: number;
  lastSyncAt: number | null;
  issue: UniversalVaultIssue | null;
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

export const EMPTY_UNIVERSAL_VAULT: UniversalVaultState = {
  status: "signedOut",
  busy: false,
  pending: 0,
  lastSyncAt: null,
  issue: null,
};
