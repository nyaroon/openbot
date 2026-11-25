import type { VaultItemKind } from "./ipc-vault";

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ORGANIZATION_ISSUES = ["offline", "notConfigured", "data"] as const;
export type OrganizationsIssue = (typeof ORGANIZATION_ISSUES)[number];

export const ORGANIZATION_NAME_MAX = 80;

export interface OrganizationSummary {
  id: string;
  name: string;
  /** The signed-in account's own role. Null for a platform owner who is not a member. */
  role: OrganizationRole | null;
  platformOwner: boolean;
  /** Owners, admins and platform owners manage members and the organization vault. */
  canManage: boolean;
  memberCount: number;
  /** Shared items every member can use. */
  sharedCount: number;
  /** Managers also see items that are not shared. */
  itemCount: number;
}

export interface OrganizationsState {
  signedIn: boolean;
  busy: boolean;
  lastSyncAt: number | null;
  issue: OrganizationsIssue | null;
  platformOwner: boolean;
  organizations: OrganizationSummary[];
}

export const EMPTY_ORGANIZATIONS: OrganizationsState = {
  signedIn: false,
  busy: false,
  lastSyncAt: null,
  issue: null,
  platformOwner: false,
  organizations: [],
};

export interface OrganizationMember {
  userId: string;
  phone: string;
  name: string | null;
  role: OrganizationRole;
}

export interface OrganizationVaultItem {
  id: string;
  kind: VaultItemKind;
  title: string;
  detail: string;
  shared: boolean;
}

export interface OrganizationVault {
  organizationId: string;
  items: OrganizationVaultItem[];
}

export interface OrganizationCreateInput {
  name: string;
  ownerNumber: string;
}

export interface OrganizationRenameInput {
  organizationId: string;
  name: string;
}

export interface OrganizationTarget {
  organizationId: string;
}

export interface OrganizationAddMemberInput {
  organizationId: string;
  number: string;
  role: "admin" | "member";
}

export interface OrganizationSetRoleInput {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

export interface OrganizationRemoveMemberInput {
  organizationId: string;
  userId: string;
}

export interface OrganizationVaultAddInput {
  organizationId: string;
  itemId: string;
  kind: VaultItemKind;
}

export interface OrganizationVaultShareInput {
  organizationId: string;
  itemId: string;
  shared: boolean;
}

export interface OrganizationServer {
  hostId: string;
  name: string;
  /** The signed-in account is already a member of the server. */
  member: boolean;
  owner: boolean;
  canUnbind: boolean;
}

/** A server the signed-in account owns that is not attached to any organization yet. */
export interface OrganizationBindableServer {
  hostId: string;
  name: string;
}

export interface OrganizationServers {
  organizationId: string;
  servers: OrganizationServer[];
  bindable: OrganizationBindableServer[];
}

export interface OrganizationServerTarget {
  organizationId: string;
  hostId: string;
}

export interface OrganizationVaultRemoveInput {
  organizationId: string;
  itemId: string;
}
