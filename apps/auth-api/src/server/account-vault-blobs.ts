import { Effect } from "effect";
import { AccountVaultError, AccountVaultStorageError, notSetUp } from "./account-vault";
import { type ObjectBucket, StorageNotConfiguredError } from "./object-storage";

export const VAULT_BLOB_LIMIT = 12 * 1024 * 1024;
export const VAULT_BLOB_COUNT_LIMIT = 100;
export const VAULT_BLOB_TOTAL_LIMIT = 300 * 1024 * 1024;

const BLOB_ID = /^[A-Za-z0-9_-]{1,64}$/u;

export function readVaultBlobId(value: string): string | null {
  return BLOB_ID.test(value) ? value : null;
}

function blobKey(userId: string, blobId: string): string {
  return `account-vault/${userId}/${blobId}`;
}

interface UsageRow {
  count: number;
  total: number;
}

export class AccountVaultBlobs {
  readonly #database: D1Database;
  readonly #bucket: ObjectBucket;
  readonly #now: () => number;

  constructor(database: D1Database, bucket: ObjectBucket, now: () => number = Date.now) {
    this.#database = database;
    this.#bucket = bucket;
    this.#now = now;
  }

  #run<T>(work: () => Promise<T>): Effect.Effect<T, AccountVaultStorageError | StorageNotConfiguredError> {
    return Effect.tryPromise({
      try: work,
      catch: (error) => (error instanceof StorageNotConfiguredError ? error : new AccountVaultStorageError()),
    });
  }

  readonly put = Effect.fn("AccountVaultBlobs.put")(function* (
    this: AccountVaultBlobs,
    userId: string,
    blobId: string,
    bytes: Uint8Array,
  ) {
    if (bytes.byteLength < 1 || bytes.byteLength > VAULT_BLOB_LIMIT)
      return yield* Effect.fail(new AccountVaultError(400, "invalid_vault_blob", "The blob size is not valid."));
    const vault = yield* this.#run(() =>
      this.#database.prepare("SELECT 1 AS present FROM account_vaults WHERE user_id = ?").bind(userId).first(),
    );
    if (!vault) return yield* Effect.fail(notSetUp());
    const usage = yield* this.#run(() =>
      this.#database
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS total
           FROM account_vault_blobs WHERE user_id = ? AND blob_id <> ?`,
        )
        .bind(userId, blobId)
        .first<UsageRow>(),
    );
    const count = usage?.count ?? 0;
    const total = usage?.total ?? 0;
    if (count >= VAULT_BLOB_COUNT_LIMIT || total + bytes.byteLength > VAULT_BLOB_TOTAL_LIMIT)
      return yield* Effect.fail(
        new AccountVaultError(409, "vault_blob_limit", "The universal vault has no room for this blob."),
      );
    yield* this.#run(() =>
      this.#bucket.put(blobKey(userId, blobId), bytes, {
        httpMetadata: { contentType: "application/octet-stream" },
      }),
    );
    yield* this.#run(() =>
      this.#database
        .prepare(
          `INSERT INTO account_vault_blobs(user_id, blob_id, size, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, blob_id) DO UPDATE SET size = excluded.size`,
        )
        .bind(userId, blobId, bytes.byteLength, this.#now())
        .run(),
    ).pipe(Effect.tapError(() => this.#run(() => this.#bucket.delete(blobKey(userId, blobId))).pipe(Effect.ignore)));
    return { size: bytes.byteLength };
  });

  readonly get = Effect.fn("AccountVaultBlobs.get")(function* (
    this: AccountVaultBlobs,
    userId: string,
    blobId: string,
  ) {
    const row = yield* this.#run(() =>
      this.#database
        .prepare("SELECT size FROM account_vault_blobs WHERE user_id = ? AND blob_id = ?")
        .bind(userId, blobId)
        .first<{ size: number }>(),
    );
    const object = row ? yield* this.#run(() => this.#bucket.get(blobKey(userId, blobId))) : null;
    if (!object)
      return yield* Effect.fail(new AccountVaultError(404, "vault_blob_not_found", "The blob was not found."));
    return yield* this.#run(() => object.arrayBuffer());
  });

  readonly remove = Effect.fn("AccountVaultBlobs.remove")(function* (
    this: AccountVaultBlobs,
    userId: string,
    blobId: string,
  ) {
    yield* this.#run(() => this.#bucket.delete(blobKey(userId, blobId)));
    yield* this.#run(() =>
      this.#database
        .prepare("DELETE FROM account_vault_blobs WHERE user_id = ? AND blob_id = ?")
        .bind(userId, blobId)
        .run(),
    );
    return { deleted: true };
  });

  readonly removeAll = Effect.fn("AccountVaultBlobs.removeAll")(function* (this: AccountVaultBlobs, userId: string) {
    const rows = yield* this.#run(() =>
      this.#database
        .prepare("SELECT blob_id FROM account_vault_blobs WHERE user_id = ?")
        .bind(userId)
        .all<{ blob_id: string }>(),
    );
    const keys = rows.results.map((row) => blobKey(userId, row.blob_id));
    if (keys.length > 0) yield* this.#run(() => this.#bucket.delete(keys));
    yield* this.#run(() =>
      this.#database.prepare("DELETE FROM account_vault_blobs WHERE user_id = ?").bind(userId).run(),
    );
    return { deleted: keys.length };
  });
}
