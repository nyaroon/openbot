import { readFile, rm } from "node:fs/promises";
import { ORGANIZATION_ROLES } from "@openbot/contracts/ipc";
import { sourceText } from "@openbot/i18n/source";
import { Effect, Result, Schema, Semaphore } from "effect";
import { writeJsonFileAtomically } from "../backend/atomic-json-file";
import { causeHelpers } from "../backend/effect-boundary";
import { OrganizationError } from "./organization-error";
import type { SecretCipher } from "./provider-credential-store";

const { io: storeCall, sync: storeDecode } = causeHelpers(OrganizationError);

const itemSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["login", "card", "contact", "apiKey"]),
  revision: Schema.Number,
  shared: Schema.Boolean,
  item: Schema.Record(Schema.String, Schema.Unknown),
});

const organizationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  role: Schema.NullOr(Schema.Literals(ORGANIZATION_ROLES)),
  platformOwner: Schema.Boolean,
  /** Owners, admins and platform owners read items that are not shared. A change resets what was read. */
  managed: Schema.Boolean,
  memberCount: Schema.Number,
  /** The server position this computer has read up to. */
  cursor: Schema.Number,
  items: Schema.Array(itemSchema),
});

const recordSchema = Schema.Struct({
  account: Schema.String,
  platformOwner: Schema.Boolean,
  organizations: Schema.Array(organizationSchema),
});

const envelopeSchema = Schema.Struct({ version: Schema.Literal(1), record: Schema.String });

export type OrganizationLocalItem = typeof itemSchema.Type;
export type OrganizationLocal = typeof organizationSchema.Type;
export type OrganizationRecord = typeof recordSchema.Type;

const MAX_ENVELOPE_BYTES = 4 * 1024 * 1024;

function unreadable() {
  return new OrganizationError({ cause: new Error(sourceText("error.organization.unreadable")) });
}

/** The organization vault, kept encrypted on this computer so shared items work offline. */
export class OrganizationStore {
  readonly #path: string;
  readonly #cipher: SecretCipher;
  #record: OrganizationRecord | null = null;
  readonly #queue = Semaphore.makeUnsafe(1);

  constructor(path: string, cipher: SecretCipher) {
    this.#path = path;
    this.#cipher = cipher;
  }

  load(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const result = yield* Effect.result(this.#read());
      this.#record = Result.isFailure(result) ? null : result.success;
    });
  }

  read(): OrganizationRecord | null {
    return this.#record;
  }

  write(next: OrganizationRecord): Effect.Effect<void, OrganizationError> {
    return this.#serialize(
      Effect.gen({ self: this }, function* () {
        const encrypted = yield* storeDecode(() => this.#cipher.encrypt(JSON.stringify(next)).toString("base64"));
        if (encrypted.length + 32 > MAX_ENVELOPE_BYTES)
          return yield* new OrganizationError({ cause: new Error(sourceText("error.organization.tooLarge")) });
        yield* writeJsonFileAtomically(this.#path, { version: 1, record: encrypted }, { createDirectory: true }).pipe(
          Effect.mapError(({ cause }) => new OrganizationError({ cause })),
        );
        this.#record = next;
      }),
    );
  }

  clear(): Effect.Effect<void, OrganizationError> {
    return this.#serialize(
      Effect.gen({ self: this }, function* () {
        yield* storeCall(() => rm(this.#path, { force: true }));
        this.#record = null;
      }),
    );
  }

  #serialize<A>(change: Effect.Effect<A, OrganizationError>): Effect.Effect<A, OrganizationError> {
    return this.#queue.withPermit(change).pipe(Effect.uninterruptible);
  }

  readonly #read = Effect.fn("OrganizationStore.read")(function* (
    this: OrganizationStore,
  ): Effect.fn.Return<OrganizationRecord | null, OrganizationError> {
    const source = yield* storeCall(() => readFile(this.#path, "utf8")).pipe(
      Effect.catch(({ cause }) =>
        cause instanceof Error && "code" in cause && cause.code === "ENOENT"
          ? Effect.succeed(null)
          : Effect.fail(new OrganizationError({ cause })),
      ),
    );
    if (source === null) return null;
    if (source.length > MAX_ENVELOPE_BYTES) return yield* unreadable();
    return yield* storeDecode(() => {
      const envelope = Schema.decodeUnknownSync(envelopeSchema)(JSON.parse(source));
      return Schema.decodeUnknownSync(recordSchema)(
        JSON.parse(this.#cipher.decrypt(Buffer.from(envelope.record, "base64"))),
      );
    }).pipe(Effect.mapError(unreadable));
  });
}
