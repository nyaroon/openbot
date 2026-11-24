import { randomUUID } from "node:crypto";
import type {
  UniversalVaultIssue,
  UniversalVaultState,
  UniversalVaultStatus,
  UniversalVaultUnshareScope,
  VaultItemKind,
} from "@openbot/contracts/ipc";
import { type DynamicRecord, isDynamicRecord, isString } from "@openbot/contracts/runtime-values";
import { sourceText } from "@openbot/i18n/source";
import { Effect, Schema, Semaphore } from "effect";
import { PasswordVaultError } from "../backend/password-vault";
import type { CentralAuthOperationError } from "./central-auth-effects";
import { authApiErrorCode, type CentralAuthManager, isFinalClientError } from "./central-auth-manager";
import { EncryptedRecordStore } from "./password-managers/encrypted-record-store";
import type { SecretCipher } from "./provider-credential-store";
import {
  createUniversalVaultKey,
  decryptUniversalItem,
  encryptUniversalItem,
  readUniversalKeyMaterial,
  rewrapUniversalVaultKey,
  type UniversalKeyMaterial,
  UniversalVaultWrongPassphraseError,
  unwrapUniversalVaultKey,
} from "./universal-vault-crypto";
import {
  acknowledgePush,
  acknowledgeRemoval,
  applyRemoteRemoval,
  clearDanglingBilling,
  decodeRemoteItem,
  hasUniversalState,
  mergeRemoteItem,
  pendingCount,
  pendingTagged,
  setItemUniversal,
  stripUniversal,
  syncPlain,
  type TaggedItem,
} from "./universal-vault-items";
import type { VaultService } from "./vault-service";
import type { VaultRecord } from "./vault-store";

const POLL_MS = 5 * 60_000;
const PUSH_DEBOUNCE_MS = 2_000;
const RETRY_MS = 60_000;
const WRONG_PASSPHRASE_DELAY_MS = 1_000;
const PAGE_LIMIT = 200;
const MAX_ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

const keyFileSchema = Schema.Struct({
  account: Schema.String,
  dek: Schema.String,
  epoch: Schema.NullOr(Schema.Number),
  cursor: Schema.Number,
  metaRevision: Schema.Number,
});

type KeyFile = typeof keyFileSchema.Type;

interface RemoteMeta {
  material: UniversalKeyMaterial;
  revision: number;
  createdAt: number;
}

interface RemoteEntry {
  id: string;
  kind: VaultItemKind;
  revision: number;
  ciphertext: string | null;
  unshared: boolean;
}

interface RemotePage {
  items: RemoteEntry[];
  next: number;
  more: boolean;
  epoch: number;
}

type UniversalFailure = CentralAuthOperationError | PasswordVaultError;

type UniversalErrorKey =
  | "error.vault.universalSignIn"
  | "error.vault.universalNotSetUp"
  | "error.vault.universalLocked"
  | "error.vault.universalExists"
  | "error.vault.universalChanged"
  | "error.vault.universalUnavailable"
  | "error.vault.itemMissing";

function universalError(key: UniversalErrorKey): PasswordVaultError {
  return new PasswordVaultError({ cause: new Error(sourceText(key)) });
}

function decodeMeta(value: unknown): RemoteMeta {
  if (!isDynamicRecord(value) || typeof value.revision !== "number" || typeof value.createdAt !== "number")
    throw new Error("Invalid vault response.");
  return {
    material: readUniversalKeyMaterial({ kdf: value.kdf, salt: value.salt, wrappedKey: value.wrappedKey }),
    revision: value.revision,
    createdAt: value.createdAt,
  };
}

function decodeEntry(value: unknown): RemoteEntry {
  if (
    !isDynamicRecord(value) ||
    !isString(value.id) ||
    !isString(value.kind) ||
    typeof value.revision !== "number" ||
    !(value.ciphertext === null || isString(value.ciphertext))
  )
    throw new Error("Invalid vault response.");
  const kind = value.kind;
  if (kind !== "login" && kind !== "card" && kind !== "contact" && kind !== "apiKey")
    throw new Error("Invalid vault response.");
  return {
    id: value.id,
    kind,
    revision: value.revision,
    ciphertext: value.ciphertext,
    unshared: value.unshared === true,
  };
}

function decodePage(value: unknown): RemotePage {
  if (
    !isDynamicRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.next !== "number" ||
    typeof value.more !== "boolean" ||
    typeof value.epoch !== "number"
  )
    throw new Error("Invalid vault response.");
  return { items: value.items.map(decodeEntry), next: value.next, more: value.more, epoch: value.epoch };
}

function decodeRevision(value: unknown): { revision: number } {
  if (!isDynamicRecord(value) || typeof value.revision !== "number") throw new Error("Invalid vault response.");
  return { revision: value.revision };
}

function decodeIgnored(_value: unknown): null {
  return null;
}

function kindRank(tagged: TaggedItem): 0 | 1 {
  return tagged.kind === "contact" ? 0 : 1;
}

export interface UniversalVaultServiceOptions {
  auth: Pick<CentralAuthManager, "requestAuthorized" | "getState" | "on" | "off">;
  vault: VaultService;
  keyPath: string;
  cipher: SecretCipher;
  conflictSuffix: () => string;
}

export class UniversalVaultService {
  readonly #auth: UniversalVaultServiceOptions["auth"];
  readonly #vault: VaultService;
  readonly #keys: EncryptedRecordStore<KeyFile>;
  readonly #conflictSuffix: () => string;
  readonly #queue = Semaphore.makeUnsafe(1);
  readonly #listeners = new Set<(state: UniversalVaultState) => void>();
  #userId: string | null = null;
  #dek: Buffer | null = null;
  #epoch: number | null = null;
  #cursor = 0;
  #metaRevision = 0;
  #status: UniversalVaultStatus = "signedOut";
  #busy = false;
  #lastSyncAt: number | null = null;
  #issue: UniversalVaultIssue | null = null;
  #poll: ReturnType<typeof setInterval> | null = null;
  #debounce: ReturnType<typeof setTimeout> | null = null;
  #retry: ReturnType<typeof setTimeout> | null = null;
  #unsubscribe: Array<() => void> = [];
  #disposed = false;

  constructor(options: UniversalVaultServiceOptions) {
    this.#auth = options.auth;
    this.#vault = options.vault;
    this.#conflictSuffix = options.conflictSuffix;
    this.#keys = new EncryptedRecordStore<KeyFile>({
      path: options.keyPath,
      cipher: options.cipher,
      decode: (value) => Schema.decodeUnknownSync(keyFileSchema)(value),
      unreadable: sourceText("error.vault.universalUnavailable"),
    });
  }

  state(): UniversalVaultState {
    const record = this.#vault.universalRecord();
    return {
      status: this.#status,
      busy: this.#busy,
      pending: record ? pendingCount(record) : 0,
      lastSyncAt: this.#lastSyncAt,
      issue: this.#issue,
    };
  }

  onChanged(listener: (state: UniversalVaultState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  readonly start = Effect.fn("UniversalVault.start")(function* (this: UniversalVaultService) {
    yield* this.#keys.load();
    const onAuth = () => void Effect.runPromise(this.#follow(false));
    this.#auth.on("changed", onAuth);
    this.#unsubscribe.push(() => this.#auth.off("changed", onAuth));
    this.#unsubscribe.push(this.#vault.onLocalChange(() => this.#schedulePush()));
    yield* this.#follow();
  });

  dispose(): void {
    this.#disposed = true;
    for (const stop of this.#unsubscribe) stop();
    this.#unsubscribe = [];
    this.#stopTimers();
    this.#dek?.fill(0);
    this.#dek = null;
  }

  readonly setUp = Effect.fn("UniversalVault.setUp")(function* (this: UniversalVaultService, passphrase: string) {
    const userId = yield* this.#requireUser();
    if (this.#status === "unlocked" || this.#status === "locked")
      return yield* universalError("error.vault.universalExists");
    const created = yield* this.#tryCrypto(() => createUniversalVaultKey(passphrase, userId));
    const sent = yield* this.#call("/v1/me/vault", "PUT", { ...created.material, baseRevision: null }, decodeMeta).pipe(
      Effect.catch(
        (error): Effect.Effect<never, UniversalFailure> =>
          authApiErrorCode(error.cause) === "vault_exists"
            ? this.#follow().pipe(Effect.andThen(Effect.fail(universalError("error.vault.universalExists"))))
            : Effect.fail(error),
      ),
    );
    yield* this.#adopt(userId, created.dek, sent);
    yield* this.#syncOnce();
    return this.state();
  });

  readonly unlock = Effect.fn("UniversalVault.unlock")(function* (this: UniversalVaultService, passphrase: string) {
    const userId = yield* this.#requireUser();
    const meta = yield* this.#fetchMeta();
    if (!meta) {
      yield* this.#follow();
      return yield* universalError("error.vault.universalNotSetUp");
    }
    const dek = yield* this.#unwrap(meta, passphrase, userId);
    yield* this.#adopt(userId, dek, meta);
    yield* this.#syncOnce();
    return this.state();
  });

  readonly changePassphrase = Effect.fn("UniversalVault.changePassphrase")(function* (
    this: UniversalVaultService,
    current: string,
    next: string,
  ) {
    const userId = yield* this.#requireUser();
    const meta = yield* this.#fetchMeta();
    if (!meta) return yield* universalError("error.vault.universalNotSetUp");
    const dek = yield* this.#unwrap(meta, current, userId);
    const material = yield* this.#tryCrypto(() => rewrapUniversalVaultKey(dek, next, userId));
    const updated = yield* this.#call(
      "/v1/me/vault",
      "PUT",
      { ...material, baseRevision: meta.revision },
      decodeMeta,
    ).pipe(
      Effect.catch(
        (error): Effect.Effect<never, UniversalFailure> =>
          authApiErrorCode(error.cause) === "vault_conflict"
            ? Effect.fail(universalError("error.vault.universalChanged"))
            : Effect.fail(error),
      ),
    );
    yield* this.#adopt(userId, dek, updated);
    return this.state();
  });

  readonly forgetOnThisDevice = Effect.fn("UniversalVault.forget")(function* (this: UniversalVaultService) {
    this.#stopTimers();
    this.#dek?.fill(0);
    this.#dek = null;
    this.#epoch = null;
    this.#cursor = 0;
    yield* this.#keys.clear().pipe(Effect.ignore);
    if (this.#userId) this.#status = "locked";
    this.#issue = null;
    this.#emit();
    return this.state();
  });

  readonly syncNow = Effect.fn("UniversalVault.syncNow")(function* (this: UniversalVaultService) {
    yield* this.#requireUser();
    if (this.#status === "locked") return yield* universalError("error.vault.universalLocked");
    if (this.#status === "notSetUp") return yield* universalError("error.vault.universalNotSetUp");
    yield* this.#syncOnce();
    return this.state();
  });

  readonly setUniversal = Effect.fn("UniversalVault.setUniversal")(function* (
    this: UniversalVaultService,
    id: string,
    kind: VaultItemKind,
    value: boolean,
    scope: UniversalVaultUnshareScope,
  ) {
    const userId = yield* this.#requireUser();
    yield* this.#vault.applyUniversal((record) => setItemUniversal(record, id, kind, value, scope, userId));
    this.#emit();
    this.#schedulePush();
    return this.state();
  });

  readonly removeUniversalVault = Effect.fn("UniversalVault.remove")(function* (this: UniversalVaultService) {
    yield* this.#requireUser();
    yield* this.#call("/v1/me/vault", "DELETE", undefined, decodeIgnored).pipe(
      Effect.catch((error) =>
        authApiErrorCode(error.cause) === "vault_not_set_up" ? Effect.void : Effect.fail(error),
      ),
    );
    yield* this.#vault.applyUniversal(stripUniversal);
    yield* this.#forgetKey();
    this.#status = "notSetUp";
    this.#issue = null;
    this.#emit();
    return this.state();
  });

  #requireUser(): Effect.Effect<string, PasswordVaultError> {
    return this.#userId ? Effect.succeed(this.#userId) : Effect.fail(universalError("error.vault.universalSignIn"));
  }

  #emit(): void {
    const state = this.state();
    for (const listener of this.#listeners) listener(state);
  }

  #stopTimers(): void {
    if (this.#poll) clearInterval(this.#poll);
    if (this.#debounce) clearTimeout(this.#debounce);
    if (this.#retry) clearTimeout(this.#retry);
    this.#poll = null;
    this.#debounce = null;
    this.#retry = null;
  }

  #startPolling(): void {
    if (this.#poll || this.#disposed) return;
    this.#poll = setInterval(() => void Effect.runPromise(this.#syncOnce().pipe(Effect.ignore)), POLL_MS);
    this.#poll.unref();
  }

  #schedulePush(): void {
    if (this.#disposed || this.#status !== "unlocked") return;
    if (this.#debounce) clearTimeout(this.#debounce);
    this.#debounce = setTimeout(() => {
      this.#debounce = null;
      void Effect.runPromise(this.#syncOnce().pipe(Effect.ignore));
    }, PUSH_DEBOUNCE_MS);
    this.#debounce.unref();
  }

  #scheduleRetry(): void {
    if (this.#retry || this.#disposed) return;
    this.#retry = setTimeout(() => {
      this.#retry = null;
      void Effect.runPromise(this.#syncOnce().pipe(Effect.ignore));
    }, RETRY_MS);
    this.#retry.unref();
  }

  #call<T>(path: string, method: "GET" | "PUT" | "DELETE", body: unknown, decode: (value: unknown) => T) {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return this.#auth.requestAuthorized(path, init, decode, REQUEST_TIMEOUT_MS);
  }

  #tryCrypto<T>(work: () => Promise<T>) {
    return Effect.tryPromise({
      try: work,
      catch: (cause) =>
        new PasswordVaultError({
          cause: cause instanceof Error ? cause : new Error(sourceText("error.vault.universalUnavailable")),
        }),
    });
  }

  #unwrap(meta: RemoteMeta, passphrase: string, userId: string) {
    return Effect.tryPromise({
      try: () => unwrapUniversalVaultKey(meta.material, passphrase, userId),
      catch: (cause) => new PasswordVaultError({ cause }),
    }).pipe(
      Effect.catch((error) =>
        error.cause instanceof UniversalVaultWrongPassphraseError
          ? Effect.sleep(WRONG_PASSPHRASE_DELAY_MS).pipe(Effect.andThen(Effect.fail(error)))
          : Effect.fail(error),
      ),
    );
  }

  #fetchMeta() {
    return this.#call("/v1/me/vault", "GET", undefined, decodeMeta).pipe(
      Effect.map((meta): RemoteMeta | null => meta),
      Effect.catch((error) =>
        authApiErrorCode(error.cause) === "vault_not_set_up" ? Effect.succeed(null) : Effect.fail(error),
      ),
    );
  }

  #adopt(userId: string, dek: Buffer, meta: RemoteMeta) {
    return Effect.gen({ self: this }, function* () {
      const changedEpoch = this.#epoch !== meta.createdAt;
      this.#dek?.fill(0);
      this.#dek = dek;
      this.#userId = userId;
      this.#epoch = meta.createdAt;
      this.#metaRevision = meta.revision;
      if (changedEpoch) this.#cursor = 0;
      this.#status = "unlocked";
      this.#issue = null;
      yield* this.#persistKey();
      this.#startPolling();
      this.#emit();
    });
  }

  #persistKey() {
    const userId = this.#userId;
    const dek = this.#dek;
    if (!userId || !dek) return Effect.void;
    const file: KeyFile = {
      account: userId,
      dek: dek.toString("base64"),
      epoch: this.#epoch,
      cursor: this.#cursor,
      metaRevision: this.#metaRevision,
    };
    return this.#keys.write(file, () => this.#userId === userId).pipe(Effect.ignore);
  }

  #forgetKey() {
    this.#stopTimers();
    this.#dek?.fill(0);
    this.#dek = null;
    this.#epoch = null;
    this.#cursor = 0;
    return this.#keys.clear().pipe(Effect.ignore);
  }

  #follow(force = true): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const state = this.#auth.getState();
      const userId = state.status === "signed_in" ? state.user.id : null;
      if (!force && userId !== null && userId === this.#userId && this.#issue !== "offline") return;
      if (userId === null) {
        this.#stopTimers();
        this.#dek?.fill(0);
        this.#dek = null;
        this.#userId = null;
        this.#status = "signedOut";
        this.#issue = null;
        this.#emit();
        return;
      }
      if (this.#userId !== userId) {
        this.#stopTimers();
        this.#dek?.fill(0);
        this.#dek = null;
        this.#userId = userId;
        this.#status = "locked";
        const stored = this.#keys.read();
        if (stored && stored.account === userId) {
          this.#dek = Buffer.from(stored.dek, "base64");
          this.#epoch = stored.epoch;
          this.#cursor = stored.cursor;
          this.#metaRevision = stored.metaRevision;
        } else {
          this.#epoch = null;
          this.#cursor = 0;
          const record = this.#vault.universalRecord();
          if (record && hasUniversalState(record) && record.universalAccount !== userId)
            yield* this.#vault.applyUniversal(stripUniversal).pipe(Effect.ignore);
        }
      }
      const meta = yield* this.#fetchMeta().pipe(Effect.result);
      if (meta._tag === "Failure") {
        this.#issue = "offline";
        this.#status = this.#dek ? "unlocked" : "locked";
        if (this.#dek) this.#startPolling();
        this.#scheduleRetry();
        this.#emit();
        return;
      }
      const remote = meta.success;
      if (!remote) {
        const record = this.#vault.universalRecord();
        if (record && this.#hadRemoteVault(record))
          yield* this.#vault.applyUniversal(stripUniversal).pipe(Effect.ignore);
        yield* this.#forgetKey();
        this.#status = "notSetUp";
        this.#issue = null;
        this.#emit();
        return;
      }
      if (this.#dek && this.#epoch !== null && this.#epoch !== remote.createdAt) {
        yield* this.#forgetKey();
      }
      this.#metaRevision = remote.revision;
      this.#issue = null;
      if (this.#dek) {
        this.#epoch = remote.createdAt;
        this.#status = "unlocked";
        this.#startPolling();
        this.#emit();
        yield* this.#syncOnce();
        return;
      }
      this.#status = "locked";
      this.#emit();
    });
  }

  #hadRemoteVault(record: VaultRecord): boolean {
    return (
      (record.universalRemoved?.length ?? 0) > 0 ||
      [...record.logins, ...record.cards, ...record.contacts, ...record.apiKeys].some(
        (item) => (item.universal?.revision ?? 0) > 0,
      )
    );
  }

  #syncOnce(): Effect.Effect<void> {
    return this.#queue.withPermit(this.#cycle()).pipe(Effect.uninterruptible);
  }

  #cycle(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      if (this.#status !== "unlocked" || !this.#dek || !this.#userId || this.#disposed) return;
      this.#busy = true;
      this.#emit();
      const outcome = yield* this.#rounds().pipe(Effect.result);
      this.#busy = false;
      if (outcome._tag === "Failure") {
        const cause = outcome.failure.cause;
        const code = authApiErrorCode(cause);
        if (code === "vault_item_limit") this.#issue = "limit";
        else if (code === "vault_not_set_up") {
          this.#emit();
          yield* this.#follow();
          return;
        } else if (outcome.failure instanceof PasswordVaultError || isFinalClientError(cause)) this.#issue = "data";
        else {
          this.#issue = "offline";
          this.#scheduleRetry();
        }
      } else {
        this.#lastSyncAt = Date.now();
        if (this.#issue === "offline") this.#issue = null;
        if (outcome.success === "limit") this.#issue = "limit";
        else if (outcome.success === "data") this.#issue = "data";
        else this.#issue = null;
      }
      this.#emit();
    });
  }

  #rounds() {
    return Effect.gen({ self: this }, function* () {
      let result: "ok" | "limit" | "data" = "ok";
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const pulled = yield* this.#pull();
        if (pulled === "locked") return result;
        const pushed = yield* this.#push();
        if (pushed.issue !== "ok") result = pushed.issue;
        if (pulled === "data") result = "data";
        if (!pushed.conflict) return result;
      }
      return result;
    });
  }

  #pull() {
    return Effect.gen({ self: this }, function* () {
      const dek = this.#dek;
      const userId = this.#userId;
      if (!dek || !userId) return "locked" as const;
      let outcome: "ok" | "data" = "ok";
      for (;;) {
        const page = yield* this.#call(
          `/v1/me/vault/items?since=${this.#cursor}&limit=${PAGE_LIMIT}`,
          "GET",
          undefined,
          decodePage,
        );
        if (this.#epoch !== null && page.epoch !== this.#epoch) {
          yield* this.#forgetKey();
          this.#status = "locked";
          return "locked" as const;
        }
        const decoded = page.items.map((entry) => {
          if (entry.ciphertext === null) return { entry, tagged: null, failed: false };
          try {
            const plain: DynamicRecord = decryptUniversalItem(dek, userId, entry.id, entry.kind, entry.ciphertext);
            return { entry, tagged: decodeRemoteItem(entry.kind, entry.id, plain), failed: false };
          } catch {
            return { entry, tagged: null, failed: true };
          }
        });
        if (decoded.some((item) => item.failed)) outcome = "data";
        const suffix = this.#conflictSuffix();
        if (decoded.length > 0)
          yield* this.#vault.applyUniversal((record) =>
            clearDanglingBilling(
              decoded.reduce((current, { entry, tagged, failed }) => {
                if (failed) return current;
                if (tagged) return mergeRemoteItem(current, tagged, entry.revision, suffix, randomUUID);
                return applyRemoteRemoval(current, entry.id, entry.unshared ? "unshared" : "deleted", entry.revision);
              }, record),
            ),
          );
        this.#cursor = page.next;
        yield* this.#persistKey();
        if (!page.more) return outcome;
      }
    });
  }

  #push() {
    return Effect.gen({ self: this }, function* () {
      const dek = this.#dek;
      const userId = this.#userId;
      const record = this.#vault.universalRecord();
      if (!dek || !userId || !record) return { conflict: false, issue: "ok" as const };
      let conflict = false;
      let issue: "ok" | "limit" | "data" = "ok";
      const pending = pendingTagged(record).sort((left, right) => kindRank(left) - kindRank(right));
      for (const tagged of pending) {
        const mark = tagged.item.universal;
        if (!mark) continue;
        const ciphertext = encryptUniversalItem(dek, userId, tagged.item.id, tagged.kind, syncPlain(tagged));
        const sent = yield* this.#call(
          `/v1/me/vault/items/${encodeURIComponent(tagged.item.id)}`,
          "PUT",
          { kind: tagged.kind, ciphertext, baseRevision: mark.revision },
          decodeRevision,
        ).pipe(Effect.result);
        if (sent._tag === "Success") {
          const revision = sent.success.revision;
          yield* this.#vault.applyUniversal((current) => acknowledgePush(current, tagged, revision));
          continue;
        }
        const code = authApiErrorCode(sent.failure.cause);
        if (code === "vault_item_conflict") {
          conflict = true;
          continue;
        }
        if (code === "vault_item_limit") {
          issue = "limit";
          break;
        }
        if (isFinalClientError(sent.failure.cause)) {
          issue = "data";
          continue;
        }
        return yield* Effect.fail(sent.failure);
      }
      const latest = this.#vault.universalRecord();
      for (const removal of latest?.universalRemoved ?? []) {
        const sent = yield* this.#call(
          `/v1/me/vault/items/${encodeURIComponent(removal.id)}`,
          "DELETE",
          { baseRevision: removal.revision, mode: removal.mode },
          decodeIgnored,
        ).pipe(Effect.result);
        if (sent._tag === "Success") {
          yield* this.#vault.applyUniversal((current) => acknowledgeRemoval(current, removal.id));
          continue;
        }
        const code = authApiErrorCode(sent.failure.cause);
        if (code === "vault_item_not_found") {
          yield* this.#vault.applyUniversal((current) => acknowledgeRemoval(current, removal.id));
          continue;
        }
        if (code === "vault_item_conflict") {
          conflict = true;
          continue;
        }
        if (isFinalClientError(sent.failure.cause)) {
          issue = "data";
          continue;
        }
        return yield* Effect.fail(sent.failure);
      }
      return { conflict, issue };
    });
  }
}
