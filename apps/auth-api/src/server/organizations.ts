import { normalizePhoneNumber, phoneFromIdentityEmail, phoneIdentityEmail } from "@openbot/contracts/phone-identity";
import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import { D1AuthRepository } from "./d1-auth-repository";
import { decryptOrgVaultValue, encryptOrgVaultValue, importOrgVaultKey } from "./org-vault-crypto";

export const ORG_LIMIT = 100;
export const ORG_MEMBER_LIMIT = 200;
export const ORG_VAULT_LIVE_ITEM_LIMIT = 2000;
export const ORG_VAULT_ITEM_BYTES_LIMIT = 64 * 1024;
export const ORG_VAULT_ITEM_BODY_LIMIT = 96 * 1024;
export const ORG_VAULT_PAGE_DEFAULT = 200;
export const ORG_VAULT_PAGE_MAX = 500;
const NAME_MAX = 80;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const KINDS = ["login", "card", "contact", "apiKey"] as const;
const ROLES = ["owner", "admin", "member"] as const;

export type OrgVaultKind = (typeof KINDS)[number];
export type OrganizationRole = (typeof ROLES)[number];
export type OrgVaultRemoval = "deleted" | "unshared";

export interface OrganizationActor {
  id: string;
  email: string;
}

export class OrganizationError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details: { currentRevision?: number; removed?: boolean } = {},
  ) {
    super(message);
  }
}

export class OrganizationStorageError extends Error {}

export interface OrganizationView {
  id: string;
  name: string;
  role: OrganizationRole | null;
  platformOwner: boolean;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationMemberView {
  userId: string;
  phone: string;
  name: string | null;
  role: OrganizationRole;
  createdAt: number;
}

export interface OrgVaultContentEntry {
  itemId: string;
  kind: OrgVaultKind;
  revision: number;
  shared: boolean;
  item: DynamicRecord;
  updatedAt: number;
  updatedBy: string | null;
  seq: number;
}

export interface OrgVaultRemovalEntry {
  itemId: string;
  removal: OrgVaultRemoval;
  revision: number;
  seq: number;
}

export type OrgVaultEntry = OrgVaultContentEntry | OrgVaultRemovalEntry;

export interface OrgVaultPage {
  role: OrganizationRole;
  changeSeq: number;
  items: OrgVaultEntry[];
  next: number;
  more: boolean;
}

export interface OrgVaultItemInput {
  kind: OrgVaultKind;
  item: DynamicRecord | null;
  shared: boolean | null;
  baseRevision: number;
}

interface OrganizationRow {
  id: string;
  name: string;
  role: OrganizationRole | null;
  member_count: number;
  created_at: number;
  updated_at: number;
}

interface MemberRow {
  user_id: string;
  email: string;
  name: string | null;
  role: OrganizationRole;
  created_at: number;
}

interface ItemRow {
  item_id: string;
  kind: OrgVaultKind;
  revision: number;
  ciphertext: string | null;
  shared: number;
  deleted_at: number | null;
  updated_at: number;
  updated_by: string | null;
  change_seq: number;
}

interface Access {
  role: OrganizationRole | null;
  platformOwner: boolean;
  /** Platform owners act as org owner in every organization. */
  effective: OrganizationRole;
}

function readRole(value: unknown): OrganizationRole | null {
  return ROLES.find((role) => role === value) ?? null;
}

export function readOrganizationName(value: unknown): string | null {
  if (!isString(value)) return null;
  const name = value.trim().replaceAll(/\s+/gu, " ");
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

export function readOrganizationInput(body: DynamicRecord): { name: string; ownerNumber: string } | null {
  const name = readOrganizationName(body.name);
  return name && isString(body.ownerNumber) ? { name, ownerNumber: body.ownerNumber } : null;
}

export function readMemberInput(body: DynamicRecord): { number: string; role: "admin" | "member" } | null {
  const role = body.role === undefined ? "member" : body.role;
  if (!isString(body.number) || (role !== "admin" && role !== "member")) return null;
  return { number: body.number, role };
}

export function readMemberRole(body: DynamicRecord): OrganizationRole | null {
  return readRole(body.role);
}

export function readOrgVaultItemId(value: string): string | null {
  return ITEM_ID.test(value) ? value : null;
}

function readRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readOrgVaultItemInput(body: DynamicRecord): OrgVaultItemInput | null {
  const kind = KINDS.find((candidate) => candidate === body.kind);
  const baseRevision = readRevision(body.baseRevision);
  if (!kind || baseRevision === null) return null;
  if (body.shared !== undefined && typeof body.shared !== "boolean") return null;
  const item = body.item === undefined ? null : body.item;
  if (item !== null && !isDynamicRecord(item)) return null;
  if (item !== null && new TextEncoder().encode(JSON.stringify(item)).length > ORG_VAULT_ITEM_BYTES_LIMIT) return null;
  return { kind, item, shared: body.shared === undefined ? null : body.shared, baseRevision };
}

export function readOrgVaultRemoval(body: DynamicRecord): { baseRevision: number } | null {
  const baseRevision = readRevision(body.baseRevision);
  return baseRevision === null ? null : { baseRevision };
}

export function readOrgVaultPageQuery(url: URL): { since: number; limit: number } | null {
  const since = url.searchParams.has("since") ? Number(url.searchParams.get("since")) : 0;
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : ORG_VAULT_PAGE_DEFAULT;
  if (!Number.isSafeInteger(since) || since < 0) return null;
  if (!Number.isSafeInteger(limit) || limit < 1) return null;
  return { since, limit: Math.min(limit, ORG_VAULT_PAGE_MAX) };
}

const notFound = () => new OrganizationError(404, "organization_not_found", "Organization not found.");
const forbidden = () => new OrganizationError(403, "forbidden", "You do not have permission to do this.");
const lastOwner = () => new OrganizationError(409, "last_owner", "An organization needs at least one owner.");
const memberNotFound = () => new OrganizationError(404, "member_not_found", "Member not found.");
const vaultNotConfigured = () =>
  new OrganizationError(503, "org_vault_not_configured", "The organization vault is not configured.");

function itemConflict(current: ItemRow | null): OrganizationError {
  return new OrganizationError(409, "org_vault_item_conflict", "The item changed on another device.", {
    currentRevision: current?.revision ?? 0,
    removed: current !== null && current.deleted_at !== null,
  });
}

function canManage(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

function parseItem(plaintext: string): DynamicRecord | null {
  try {
    const value = JSON.parse(plaintext);
    return isDynamicRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function memberFromRow(row: MemberRow): OrganizationMemberView {
  return {
    userId: row.user_id,
    phone: phoneFromIdentityEmail(row.email) ?? "",
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function organizationFromRow(row: OrganizationRow, platformOwner: boolean): OrganizationView {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    platformOwner,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class Organizations {
  readonly #database: D1Database;
  readonly #ownerEmails: ReadonlySet<string>;
  readonly #vaultKey: string | undefined;
  readonly #now: () => number;
  readonly #accounts: D1AuthRepository;

  constructor(options: {
    database: D1Database;
    ownerEmails: ReadonlySet<string>;
    vaultKey?: string | undefined;
    now?: () => number;
  }) {
    this.#database = options.database;
    this.#ownerEmails = options.ownerEmails;
    this.#vaultKey = options.vaultKey;
    this.#now = options.now ?? Date.now;
    this.#accounts = new D1AuthRepository(options.database);
  }

  #run<T>(work: () => Promise<T>): Effect.Effect<T, OrganizationStorageError> {
    return Effect.tryPromise({ try: work, catch: () => new OrganizationStorageError() });
  }

  #isPlatformOwner(actor: OrganizationActor): boolean {
    return this.#ownerEmails.has(actor.email);
  }

  /** 404 when the organization does not exist or the actor cannot see it. */
  readonly #access = Effect.fn("Organizations.access")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
  ) {
    const row = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT o.id, m.role AS role
           FROM organizations o
           LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ?
           WHERE o.id = ?`,
        )
        .bind(actor.id, organizationId)
        .first<{ id: string; role: OrganizationRole | null }>(),
    );
    const platformOwner = this.#isPlatformOwner(actor);
    if (!row || (row.role === null && !platformOwner)) return yield* Effect.fail(notFound());
    const access: Access = {
      role: row.role,
      platformOwner,
      effective: platformOwner ? "owner" : (row.role ?? "member"),
    };
    return access;
  });

  readonly #view = Effect.fn("Organizations.view")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
  ) {
    const row = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT o.id, o.name, o.created_at, o.updated_at, m.role AS role,
                  (SELECT COUNT(*) FROM organization_members c WHERE c.organization_id = o.id) AS member_count
           FROM organizations o
           LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ?
           WHERE o.id = ?`,
        )
        .bind(actor.id, organizationId)
        .first<OrganizationRow>(),
    );
    if (!row) return yield* Effect.fail(notFound());
    return organizationFromRow(row, this.#isPlatformOwner(actor));
  });

  /** Finds the account for a WhatsApp number, creating it when missing. */
  readonly #ensureAccount = Effect.fn("Organizations.ensureAccount")(function* (this: Organizations, number: string) {
    const phone = normalizePhoneNumber(number);
    if (!phone)
      return yield* Effect.fail(new OrganizationError(400, "invalid_phone", "Enter a valid WhatsApp number."));
    const email = phoneIdentityEmail(phone);
    yield* this.#accounts.createAccount({ email, name: null, now: this.#now() });
    const user = yield* this.#run(() =>
      this.#database
        .prepare("SELECT id, name FROM users WHERE email = ?")
        .bind(email)
        .first<{ id: string; name: string | null }>(),
    );
    if (!user) return yield* Effect.fail(new OrganizationStorageError());
    return { id: user.id, name: user.name, phone };
  });

  readonly list = Effect.fn("Organizations.list")(function* (this: Organizations, actor: OrganizationActor) {
    const platformOwner = this.#isPlatformOwner(actor);
    const rows = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT o.id, o.name, o.created_at, o.updated_at, m.role AS role,
                  (SELECT COUNT(*) FROM organization_members c WHERE c.organization_id = o.id) AS member_count
           FROM organizations o
           LEFT JOIN organization_members m ON m.organization_id = o.id AND m.user_id = ?
           ${platformOwner ? "" : "WHERE m.user_id IS NOT NULL"}
           ORDER BY o.name COLLATE NOCASE, o.id
           LIMIT ?`,
        )
        .bind(actor.id, ORG_LIMIT)
        .all<OrganizationRow>(),
    );
    return rows.results.map((row) => organizationFromRow(row, platformOwner));
  });

  readonly get = Effect.fn("Organizations.get")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
  ) {
    yield* this.#access(actor, organizationId);
    return yield* this.#view(actor, organizationId);
  });

  readonly create = Effect.fn("Organizations.create")(function* (
    this: Organizations,
    actor: OrganizationActor,
    input: { name: string; ownerNumber: string },
  ) {
    if (!this.#isPlatformOwner(actor)) return yield* Effect.fail(forbidden());
    const owner = yield* this.#ensureAccount(input.ownerNumber);
    const now = this.#now();
    const id = crypto.randomUUID();
    const results = yield* this.#run(() =>
      this.#database.batch([
        this.#database
          .prepare(
            `INSERT INTO organizations(id, name, created_by, vault_change_seq, created_at, updated_at)
             SELECT ?, ?, ?, 0, ?, ? WHERE (SELECT COUNT(*) FROM organizations) < ?`,
          )
          .bind(id, input.name, actor.id, now, now, ORG_LIMIT),
        this.#database
          .prepare(
            `INSERT INTO organization_members(organization_id, user_id, role, created_at)
             SELECT ?, ?, 'owner', ? WHERE EXISTS (SELECT 1 FROM organizations WHERE id = ?)`,
          )
          .bind(id, owner.id, now, id),
      ]),
    );
    if (results[0]?.meta.changes !== 1) {
      return yield* Effect.fail(new OrganizationError(409, "organization_limit", "There are too many organizations."));
    }
    return yield* this.#view(actor, id);
  });

  readonly rename = Effect.fn("Organizations.rename")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    name: string,
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!access.platformOwner) return yield* Effect.fail(forbidden());
    yield* this.#run(() =>
      this.#database
        .prepare("UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?")
        .bind(name, this.#now(), organizationId)
        .run(),
    );
    return yield* this.#view(actor, organizationId);
  });

  readonly remove = Effect.fn("Organizations.remove")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!access.platformOwner) return yield* Effect.fail(forbidden());
    yield* this.#run(() => this.#database.prepare("DELETE FROM organizations WHERE id = ?").bind(organizationId).run());
    return { deleted: true };
  });

  readonly members = Effect.fn("Organizations.members")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!canManage(access.effective)) return yield* Effect.fail(forbidden());
    const rows = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT m.user_id, u.email, u.name, m.role, m.created_at
           FROM organization_members m JOIN users u ON u.id = m.user_id
           WHERE m.organization_id = ?
           ORDER BY m.created_at, m.user_id
           LIMIT ?`,
        )
        .bind(organizationId, ORG_MEMBER_LIMIT)
        .all<MemberRow>(),
    );
    return rows.results.map(memberFromRow);
  });

  #member(organizationId: string, userId: string) {
    return this.#run(() =>
      this.#database
        .prepare(
          `SELECT m.user_id, u.email, u.name, m.role, m.created_at
           FROM organization_members m JOIN users u ON u.id = m.user_id
           WHERE m.organization_id = ? AND m.user_id = ?`,
        )
        .bind(organizationId, userId)
        .first<MemberRow>(),
    );
  }

  readonly addMember = Effect.fn("Organizations.addMember")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    input: { number: string; role: "admin" | "member" },
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!canManage(access.effective)) return yield* Effect.fail(forbidden());
    if (input.role === "admin" && access.effective !== "owner") return yield* Effect.fail(forbidden());
    const account = yield* this.#ensureAccount(input.number);
    const existing = yield* this.#member(organizationId, account.id);
    if (existing) return yield* Effect.fail(new OrganizationError(409, "member_exists", "Already a member."));
    const added = yield* this.#run(() =>
      this.#database
        .prepare(
          `INSERT INTO organization_members(organization_id, user_id, role, created_at)
           SELECT ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM organization_members WHERE organization_id = ?) < ?
           ON CONFLICT(organization_id, user_id) DO NOTHING`,
        )
        .bind(organizationId, account.id, input.role, this.#now(), organizationId, ORG_MEMBER_LIMIT)
        .run(),
    );
    if (added.meta.changes !== 1) {
      return yield* Effect.fail(new OrganizationError(409, "member_limit", "The organization has too many members."));
    }
    const member = yield* this.#member(organizationId, account.id);
    if (!member) return yield* Effect.fail(new OrganizationStorageError());
    return memberFromRow(member);
  });

  readonly setMemberRole = Effect.fn("Organizations.setMemberRole")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (access.effective !== "owner") return yield* Effect.fail(forbidden());
    const current = yield* this.#member(organizationId, userId);
    if (!current) return yield* Effect.fail(memberNotFound());
    const updated = yield* this.#run(() =>
      this.#database
        .prepare(
          `UPDATE organization_members SET role = ?
           WHERE organization_id = ? AND user_id = ?
             AND NOT (role = 'owner' AND ? <> 'owner'
                      AND (SELECT COUNT(*) FROM organization_members WHERE organization_id = ? AND role = 'owner') <= 1)`,
        )
        .bind(role, organizationId, userId, role, organizationId)
        .run(),
    );
    if (updated.meta.changes !== 1) return yield* Effect.fail(lastOwner());
    const member = yield* this.#member(organizationId, userId);
    if (!member) return yield* Effect.fail(new OrganizationStorageError());
    return memberFromRow(member);
  });

  readonly removeMember = Effect.fn("Organizations.removeMember")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    userId: string,
  ) {
    const access = yield* this.#access(actor, organizationId);
    const self = userId === actor.id;
    if (!self && !canManage(access.effective)) return yield* Effect.fail(forbidden());
    const current = yield* this.#member(organizationId, userId);
    if (!current) return yield* Effect.fail(memberNotFound());
    if (!self && access.effective === "admin" && current.role !== "member") return yield* Effect.fail(forbidden());
    const removed = yield* this.#run(() =>
      this.#database
        .prepare(
          `DELETE FROM organization_members
           WHERE organization_id = ? AND user_id = ?
             AND NOT (role = 'owner'
                      AND (SELECT COUNT(*) FROM organization_members WHERE organization_id = ? AND role = 'owner') <= 1)`,
        )
        .bind(organizationId, userId, organizationId)
        .run(),
    );
    if (removed.meta.changes !== 1) return yield* Effect.fail(lastOwner());
    return { removed: true };
  });

  #vaultCryptoKey(): Effect.Effect<CryptoKey, OrganizationError | OrganizationStorageError> {
    return this.#run(() => importOrgVaultKey(this.#vaultKey)).pipe(
      Effect.flatMap((key) => (key ? Effect.succeed(key) : Effect.fail(vaultNotConfigured()))),
    );
  }

  #item(organizationId: string, itemId: string) {
    return this.#run(() =>
      this.#database
        .prepare(
          `SELECT item_id, kind, revision, ciphertext, shared, deleted_at, updated_at, updated_by, change_seq
           FROM organization_vault_items WHERE organization_id = ? AND item_id = ?`,
        )
        .bind(organizationId, itemId)
        .first<ItemRow>(),
    );
  }

  readonly #contentEntry = Effect.fn("Organizations.contentEntry")(function* (
    this: Organizations,
    key: CryptoKey,
    organizationId: string,
    row: ItemRow,
  ) {
    const stored = row.ciphertext;
    const plaintext = stored
      ? yield* this.#run(() => decryptOrgVaultValue(key, `${organizationId}:${row.item_id}`, stored))
      : null;
    const item = plaintext === null ? null : parseItem(plaintext);
    if (!item) {
      return yield* Effect.fail(new OrganizationError(500, "org_vault_unreadable", "An item could not be decrypted."));
    }
    const entry: OrgVaultContentEntry = {
      itemId: row.item_id,
      kind: row.kind,
      revision: row.revision,
      shared: row.shared === 1,
      item,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      seq: row.change_seq,
    };
    return entry;
  });

  readonly #adminEntry = Effect.fn("Organizations.adminEntry")(function* (
    this: Organizations,
    key: CryptoKey,
    organizationId: string,
    row: ItemRow,
  ) {
    if (row.deleted_at !== null) {
      const removal: OrgVaultRemovalEntry = {
        itemId: row.item_id,
        removal: "deleted",
        revision: row.revision,
        seq: row.change_seq,
      };
      return removal;
    }
    return yield* this.#contentEntry(key, organizationId, row);
  });

  readonly vaultItems = Effect.fn("Organizations.vaultItems")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    query: { since: number; limit: number },
  ) {
    const access = yield* this.#access(actor, organizationId);
    const key = yield* this.#vaultCryptoKey();
    const org = yield* this.#run(() =>
      this.#database
        .prepare("SELECT vault_change_seq FROM organizations WHERE id = ?")
        .bind(organizationId)
        .first<{ vault_change_seq: number }>(),
    );
    const rows = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT item_id, kind, revision, ciphertext, shared, deleted_at, updated_at, updated_by, change_seq
           FROM organization_vault_items
           WHERE organization_id = ? AND change_seq > ?
           ORDER BY change_seq
           LIMIT ?`,
        )
        .bind(organizationId, query.since, query.limit + 1)
        .all<ItemRow>(),
    );
    const page = rows.results.slice(0, query.limit);
    const items: OrgVaultEntry[] = [];
    for (const row of page) {
      if (canManage(access.effective)) {
        // A first sync has nothing to remove, so deleted items are left out of it.
        if (row.deleted_at !== null && query.since === 0) continue;
        items.push(yield* this.#adminEntry(key, organizationId, row));
      } else if (row.deleted_at === null && row.shared === 1) {
        items.push(yield* this.#contentEntry(key, organizationId, row));
      } else if (query.since > 0) {
        items.push({
          itemId: row.item_id,
          removal: row.deleted_at !== null ? "deleted" : "unshared",
          revision: row.revision,
          seq: row.change_seq,
        });
      }
    }
    const result: OrgVaultPage = {
      role: access.effective,
      changeSeq: org?.vault_change_seq ?? 0,
      items,
      next: page.at(-1)?.change_seq ?? query.since,
      more: rows.results.length > query.limit,
    };
    return result;
  });

  readonly putVaultItem = Effect.fn("Organizations.putVaultItem")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    itemId: string,
    input: OrgVaultItemInput,
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!canManage(access.effective)) return yield* Effect.fail(forbidden());
    const key = yield* this.#vaultCryptoKey();
    const current = yield* this.#item(organizationId, itemId);
    if (current && current.kind !== input.kind) {
      return yield* Effect.fail(
        new OrganizationError(400, "org_vault_item_kind_mismatch", "The item kind cannot change."),
      );
    }
    const currentRevision = current?.revision ?? 0;
    if (input.baseRevision !== currentRevision) return yield* Effect.fail(itemConflict(current));
    const live = current !== null && current.deleted_at === null;
    const content = input.item;
    let ciphertext: string;
    if (content) {
      ciphertext = yield* this.#run(() =>
        encryptOrgVaultValue(key, `${organizationId}:${itemId}`, JSON.stringify(content)),
      );
    } else if (live && current.ciphertext !== null) {
      // A share toggle without new content keeps the stored ciphertext.
      ciphertext = current.ciphertext;
    } else {
      return yield* Effect.fail(new OrganizationError(400, "invalid_org_vault_item", "The vault item is not valid."));
    }
    if (!live) {
      const count = yield* this.#run(() =>
        this.#database
          .prepare(
            "SELECT COUNT(*) AS total FROM organization_vault_items WHERE organization_id = ? AND deleted_at IS NULL",
          )
          .bind(organizationId)
          .first<{ total: number }>(),
      );
      if ((count?.total ?? 0) >= ORG_VAULT_LIVE_ITEM_LIMIT) {
        return yield* Effect.fail(
          new OrganizationError(409, "org_vault_item_limit", "The organization vault has too many items."),
        );
      }
    }
    const shared = input.shared ?? (live && current.shared === 1);
    const now = this.#now();
    const results = yield* this.#run(() =>
      this.#database.batch([
        this.#database
          .prepare("UPDATE organizations SET vault_change_seq = vault_change_seq + 1 WHERE id = ?")
          .bind(organizationId),
        this.#database
          .prepare(
            `INSERT INTO organization_vault_items(
               organization_id, item_id, kind, revision, ciphertext, shared, deleted_at, updated_at, updated_by, change_seq
             )
             SELECT id, ?, ?, ?, ?, ?, NULL, ?, ?, vault_change_seq FROM organizations WHERE id = ?
             ON CONFLICT(organization_id, item_id) DO UPDATE SET
               revision = excluded.revision,
               ciphertext = excluded.ciphertext,
               shared = excluded.shared,
               deleted_at = NULL,
               updated_at = excluded.updated_at,
               updated_by = excluded.updated_by,
               change_seq = excluded.change_seq
             WHERE organization_vault_items.revision = ?`,
          )
          .bind(
            itemId,
            input.kind,
            currentRevision + 1,
            ciphertext,
            shared ? 1 : 0,
            now,
            actor.id,
            organizationId,
            currentRevision,
          ),
      ]),
    );
    const written = yield* this.#item(organizationId, itemId);
    if (results[1]?.meta.changes !== 1 || !written) return yield* Effect.fail(itemConflict(written));
    return yield* this.#adminEntry(key, organizationId, written);
  });

  readonly deleteVaultItem = Effect.fn("Organizations.deleteVaultItem")(function* (
    this: Organizations,
    actor: OrganizationActor,
    organizationId: string,
    itemId: string,
    input: { baseRevision: number },
  ) {
    const access = yield* this.#access(actor, organizationId);
    if (!canManage(access.effective)) return yield* Effect.fail(forbidden());
    const key = yield* this.#vaultCryptoKey();
    const current = yield* this.#item(organizationId, itemId);
    if (!current) {
      return yield* Effect.fail(new OrganizationError(404, "org_vault_item_not_found", "Item not found."));
    }
    if (input.baseRevision !== current.revision) return yield* Effect.fail(itemConflict(current));
    if (current.deleted_at !== null) return yield* this.#adminEntry(key, organizationId, current);
    const now = this.#now();
    const results = yield* this.#run(() =>
      this.#database.batch([
        this.#database
          .prepare("UPDATE organizations SET vault_change_seq = vault_change_seq + 1 WHERE id = ?")
          .bind(organizationId),
        this.#database
          .prepare(
            `UPDATE organization_vault_items
             SET revision = revision + 1, ciphertext = NULL, shared = 0, deleted_at = ?, updated_at = ?, updated_by = ?,
                 change_seq = (SELECT vault_change_seq FROM organizations WHERE id = ?)
             WHERE organization_id = ? AND item_id = ? AND revision = ?`,
          )
          .bind(now, now, actor.id, organizationId, organizationId, itemId, input.baseRevision),
      ]),
    );
    const removed = yield* this.#item(organizationId, itemId);
    if (results[1]?.meta.changes !== 1 || !removed) return yield* Effect.fail(itemConflict(removed));
    return yield* this.#adminEntry(key, organizationId, removed);
  });
}
