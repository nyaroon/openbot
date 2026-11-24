import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";

export const VAULT_CIPHERTEXT_LIMIT = 64 * 1024;
export const VAULT_ITEM_BODY_LIMIT = 96 * 1024;
export const VAULT_LIVE_ITEM_LIMIT = 2000;
export const VAULT_PAGE_DEFAULT = 200;
export const VAULT_PAGE_MAX = 500;
export const VAULT_TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60_000;

const KINDS = ["login", "card", "contact", "apiKey"] as const;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
const SALT_BYTES_MIN = 16;
const SALT_BYTES_MAX = 64;
const WRAPPED_KEY_BYTES = 60;
const NONCE_BYTES = 12;
const SCRYPT_COST_MIN = 2 ** 15;
const SCRYPT_COST_MAX = 2 ** 20;

export type VaultItemKind = (typeof KINDS)[number];
export type VaultRemoval = "deleted" | "unshared";

export interface VaultKdf {
  name: "scrypt";
  n: number;
  r: number;
  p: number;
}

export interface VaultMetaInput {
  kdf: VaultKdf;
  salt: string;
  wrappedKey: string;
  baseRevision: number | null;
}

export interface VaultMeta {
  kdf: VaultKdf;
  salt: string;
  wrappedKey: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface VaultItemInput {
  kind: VaultItemKind;
  ciphertext: string;
  baseRevision: number;
}

export interface VaultItemRemoval {
  baseRevision: number;
  mode: VaultRemoval;
}

export interface VaultItemEntry {
  id: string;
  kind: VaultItemKind;
  revision: number;
  ciphertext: string | null;
  deleted: boolean;
  unshared: boolean;
  seq: number;
}

export interface VaultItemPage {
  items: VaultItemEntry[];
  next: number;
  more: boolean;
  epoch: number;
}

export class AccountVaultError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: string,
    message: string,
    readonly details: { currentRevision?: number; removed?: boolean } = {},
  ) {
    super(message);
  }
}

class AccountVaultStorageError extends Error {}

interface MetaRow {
  kdf: string;
  salt: string;
  wrapped_key: string;
  revision: number;
  created_at: number;
  updated_at: number;
}

interface ItemRow {
  item_id: string;
  kind: VaultItemKind;
  revision: number;
  ciphertext: string | null;
  removal: VaultRemoval | null;
  change_seq: number;
}

function base64Bytes(value: unknown): number | null {
  if (!isString(value) || value.length % 4 !== 0 || !BASE64.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function readKdf(value: unknown): VaultKdf | null {
  if (!isDynamicRecord(value) || value.name !== "scrypt") return null;
  const { n, r, p } = value;
  if (typeof n !== "number" || typeof r !== "number" || typeof p !== "number") return null;
  const valid =
    Number.isInteger(n) &&
    n >= SCRYPT_COST_MIN &&
    n <= SCRYPT_COST_MAX &&
    (n & (n - 1)) === 0 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 16 &&
    Number.isInteger(p) &&
    p >= 1 &&
    p <= 4;
  return valid ? { name: "scrypt", n, r, p } : null;
}

function readRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readVaultItemId(value: string): string | null {
  return ITEM_ID.test(value) ? value : null;
}

export function readVaultMetaInput(body: DynamicRecord): VaultMetaInput | null {
  const kdf = readKdf(body.kdf);
  const { salt, wrappedKey } = body;
  if (!kdf || !isString(salt) || !isString(wrappedKey)) return null;
  const saltBytes = base64Bytes(salt);
  if (saltBytes === null || saltBytes < SALT_BYTES_MIN || saltBytes > SALT_BYTES_MAX) return null;
  if (base64Bytes(wrappedKey) !== WRAPPED_KEY_BYTES) return null;
  const baseRevision = body.baseRevision === undefined ? null : readRevision(body.baseRevision);
  if (body.baseRevision !== undefined && baseRevision === null) return null;
  return { kdf, salt, wrappedKey, baseRevision };
}

function validEnvelope(ciphertext: string): boolean {
  if (ciphertext.length === 0 || ciphertext.length > VAULT_CIPHERTEXT_LIMIT) return false;
  try {
    const envelope = JSON.parse(ciphertext);
    return (
      isDynamicRecord(envelope) &&
      envelope.v === 1 &&
      base64Bytes(envelope.nonce) === NONCE_BYTES &&
      base64Bytes(envelope.ct) !== null
    );
  } catch {
    return false;
  }
}

function readKind(value: unknown): VaultItemKind | null {
  return KINDS.find((kind) => kind === value) ?? null;
}

export function readVaultItemInput(body: DynamicRecord): VaultItemInput | null {
  const kind = readKind(body.kind);
  const baseRevision = readRevision(body.baseRevision);
  if (!kind || baseRevision === null || !isString(body.ciphertext) || !validEnvelope(body.ciphertext)) return null;
  return { kind, ciphertext: body.ciphertext, baseRevision };
}

export function readVaultItemRemoval(body: DynamicRecord): VaultItemRemoval | null {
  const baseRevision = readRevision(body.baseRevision);
  const mode = body.mode === undefined ? "deleted" : body.mode;
  if (baseRevision === null || (mode !== "deleted" && mode !== "unshared")) return null;
  return { baseRevision, mode };
}

export function readVaultPageQuery(url: URL): { since: number; limit: number } | null {
  const since = url.searchParams.has("since") ? Number(url.searchParams.get("since")) : 0;
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : VAULT_PAGE_DEFAULT;
  if (!Number.isSafeInteger(since) || since < 0) return null;
  if (!Number.isSafeInteger(limit) || limit < 1) return null;
  return { since, limit: Math.min(limit, VAULT_PAGE_MAX) };
}

function metaFromRow(row: MetaRow): VaultMeta {
  const kdf = readKdf(JSON.parse(row.kdf));
  if (!kdf) throw new AccountVaultStorageError();
  return {
    kdf,
    salt: row.salt,
    wrappedKey: row.wrapped_key,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function entryFromRow(row: ItemRow): VaultItemEntry {
  return {
    id: row.item_id,
    kind: row.kind,
    revision: row.revision,
    ciphertext: row.ciphertext,
    deleted: row.removal !== null,
    unshared: row.removal === "unshared",
    seq: row.change_seq,
  };
}

const notSetUp = () => new AccountVaultError(404, "vault_not_set_up", "The universal vault is not set up.");

const vaultExists = () => new AccountVaultError(409, "vault_exists", "The universal vault already exists.");

function itemConflict(current: ItemRow | null): AccountVaultError {
  return new AccountVaultError(409, "vault_item_conflict", "The item changed on another device.", {
    currentRevision: current?.revision ?? 0,
    removed: current !== null && current.removal !== null,
  });
}

export class AccountVault {
  readonly #database: D1Database;
  readonly #now: () => number;

  constructor(database: D1Database, now: () => number = Date.now) {
    this.#database = database;
    this.#now = now;
  }

  #run<T>(work: () => Promise<T>): Effect.Effect<T, AccountVaultStorageError> {
    return Effect.tryPromise({ try: work, catch: () => new AccountVaultStorageError() });
  }

  #item(userId: string, itemId: string): Effect.Effect<ItemRow | null, AccountVaultStorageError> {
    return this.#run(() =>
      this.#database
        .prepare(
          `SELECT item_id, kind, revision, ciphertext, removal, change_seq
           FROM account_vault_items WHERE user_id = ? AND item_id = ?`,
        )
        .bind(userId, itemId)
        .first<ItemRow>(),
    );
  }

  readonly meta = Effect.fn("AccountVault.meta")(function* (this: AccountVault, userId: string) {
    const row = yield* this.#run(() =>
      this.#database
        .prepare(
          "SELECT kdf, salt, wrapped_key, revision, created_at, updated_at FROM account_vaults WHERE user_id = ?",
        )
        .bind(userId)
        .first<MetaRow>(),
    );
    if (!row) return yield* Effect.fail(notSetUp());
    return metaFromRow(row);
  });

  readonly putMeta = Effect.fn("AccountVault.putMeta")(function* (
    this: AccountVault,
    userId: string,
    input: VaultMetaInput,
  ) {
    const now = this.#now();
    const kdf = JSON.stringify(input.kdf);
    const current = yield* this.#run(() =>
      this.#database
        .prepare("SELECT revision FROM account_vaults WHERE user_id = ?")
        .bind(userId)
        .first<{ revision: number }>(),
    );
    if (!current) {
      if (input.baseRevision !== null && input.baseRevision !== 0) return yield* Effect.fail(notSetUp());
      const created = yield* this.#run(() =>
        this.#database
          .prepare(
            `INSERT INTO account_vaults(user_id, kdf, salt, wrapped_key, revision, change_seq, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, 0, ?, ?)
             ON CONFLICT(user_id) DO NOTHING`,
          )
          .bind(userId, kdf, input.salt, input.wrappedKey, now, now)
          .run(),
      );
      if (created.meta.changes !== 1) return yield* Effect.fail(vaultExists());
      return yield* this.meta(userId);
    }
    if (input.baseRevision === null) return yield* Effect.fail(vaultExists());
    const updated = yield* this.#run(() =>
      this.#database
        .prepare(
          `UPDATE account_vaults
           SET kdf = ?, salt = ?, wrapped_key = ?, revision = revision + 1, updated_at = ?
           WHERE user_id = ? AND revision = ?`,
        )
        .bind(kdf, input.salt, input.wrappedKey, now, userId, input.baseRevision)
        .run(),
    );
    if (updated.meta.changes !== 1)
      return yield* Effect.fail(
        new AccountVaultError(409, "vault_conflict", "The vault passphrase changed on another device.", {
          currentRevision: current.revision,
        }),
      );
    return yield* this.meta(userId);
  });

  readonly items = Effect.fn("AccountVault.items")(function* (
    this: AccountVault,
    userId: string,
    query: { since: number; limit: number },
  ) {
    const vault = yield* this.meta(userId);
    const rows = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT item_id, kind, revision, ciphertext, removal, change_seq
           FROM account_vault_items
           WHERE user_id = ? AND change_seq > ?
           ORDER BY change_seq
           LIMIT ?`,
        )
        .bind(userId, query.since, query.limit + 1)
        .all<ItemRow>(),
    );
    const items = rows.results.slice(0, query.limit).map(entryFromRow);
    const page: VaultItemPage = {
      items,
      next: items.at(-1)?.seq ?? query.since,
      more: rows.results.length > query.limit,
      epoch: vault.createdAt,
    };
    return page;
  });

  readonly putItem = Effect.fn("AccountVault.putItem")(function* (
    this: AccountVault,
    userId: string,
    itemId: string,
    input: VaultItemInput,
  ) {
    yield* this.meta(userId);
    const current = yield* this.#item(userId, itemId);
    if (current && current.kind !== input.kind)
      return yield* Effect.fail(new AccountVaultError(400, "vault_item_kind_mismatch", "The item kind cannot change."));
    const currentRevision = current?.revision ?? 0;
    if (input.baseRevision !== currentRevision) return yield* Effect.fail(itemConflict(current));
    if (!current || current.removal !== null) {
      const live = yield* this.#run(() =>
        this.#database
          .prepare("SELECT COUNT(*) AS total FROM account_vault_items WHERE user_id = ? AND removal IS NULL")
          .bind(userId)
          .first<{ total: number }>(),
      );
      if ((live?.total ?? 0) >= VAULT_LIVE_ITEM_LIMIT)
        return yield* Effect.fail(
          new AccountVaultError(409, "vault_item_limit", "The universal vault has too many items."),
        );
    }
    const now = this.#now();
    const results = yield* this.#run(() =>
      this.#database.batch([
        this.#database.prepare("UPDATE account_vaults SET change_seq = change_seq + 1 WHERE user_id = ?").bind(userId),
        this.#database
          .prepare(
            `INSERT INTO account_vault_items(
               user_id, item_id, kind, revision, ciphertext, removal, deleted_at, updated_at, change_seq
             )
             SELECT user_id, ?, ?, ?, ?, NULL, NULL, ?, change_seq FROM account_vaults WHERE user_id = ?
             ON CONFLICT(user_id, item_id) DO UPDATE SET
               revision = excluded.revision,
               ciphertext = excluded.ciphertext,
               removal = NULL,
               deleted_at = NULL,
               updated_at = excluded.updated_at,
               change_seq = excluded.change_seq
             WHERE account_vault_items.revision = ?`,
          )
          .bind(itemId, input.kind, currentRevision + 1, input.ciphertext, now, userId, currentRevision),
      ]),
    );
    const written = yield* this.#item(userId, itemId);
    if (results[1]?.meta.changes !== 1 || !written) return yield* Effect.fail(itemConflict(written));
    return entryFromRow(written);
  });

  readonly removeItem = Effect.fn("AccountVault.removeItem")(function* (
    this: AccountVault,
    userId: string,
    itemId: string,
    input: VaultItemRemoval,
  ) {
    yield* this.meta(userId);
    const current = yield* this.#item(userId, itemId);
    if (!current) return yield* Effect.fail(new AccountVaultError(404, "vault_item_not_found", "Item not found."));
    if (input.baseRevision !== current.revision) return yield* Effect.fail(itemConflict(current));
    if (current.removal !== null) return entryFromRow(current);
    const now = this.#now();
    const results = yield* this.#run(() =>
      this.#database.batch([
        this.#database.prepare("UPDATE account_vaults SET change_seq = change_seq + 1 WHERE user_id = ?").bind(userId),
        this.#database
          .prepare(
            `UPDATE account_vault_items
             SET revision = revision + 1,
                 ciphertext = NULL,
                 removal = ?,
                 deleted_at = ?,
                 updated_at = ?,
                 change_seq = (SELECT change_seq FROM account_vaults WHERE user_id = ?)
             WHERE user_id = ? AND item_id = ? AND revision = ?`,
          )
          .bind(input.mode, now, now, userId, userId, itemId, input.baseRevision),
      ]),
    );
    const removed = yield* this.#item(userId, itemId);
    if (results[1]?.meta.changes !== 1 || !removed) return yield* Effect.fail(itemConflict(removed));
    return entryFromRow(removed);
  });

  readonly deleteAll = Effect.fn("AccountVault.deleteAll")(function* (this: AccountVault, userId: string) {
    yield* this.#run(() =>
      this.#database.batch([
        this.#database.prepare("DELETE FROM account_vault_items WHERE user_id = ?").bind(userId),
        this.#database.prepare("DELETE FROM account_vaults WHERE user_id = ?").bind(userId),
      ]),
    );
    return { deleted: true };
  });
}
