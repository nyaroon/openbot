import { isAvatarColor } from "@openbot/contracts/ipc";
import { Effect, Schema } from "effect";
import { randomToken, sha256 } from "./crypto";
import { mobileSessionStatements } from "./d1-auth-repository";
import type { RemoteFailure } from "./remote-control-plane";
import { PERSISTENT_SESSION_EXPIRES_AT } from "./session-policy";
import type { AuthUser, MobileAuthDeviceIdentity, WorkerBindings } from "./types";

const CODE_TTL_MS = 2 * 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const BROWSER_EXTENSION_ID_PATTERN = /^[a-p]{32}$/u;

export class ExtensionSignInError extends Schema.TaggedError<ExtensionSignInError>()("ExtensionSignInError", {
  status: Schema.Number,
  code: Schema.String,
  message: Schema.String,
}) {
  constructor(status: number, code: string, message: string) {
    super({ status, code, message });
  }
}

class ExtensionSignInOperationError extends Schema.TaggedError<ExtensionSignInOperationError>()(
  "ExtensionSignInOperationError",
  {},
) {}

export type ExtensionSignInFailure = ExtensionSignInError | ExtensionSignInOperationError | RemoteFailure;

function storeCall<A>(operation: () => Promise<A>): Effect.Effect<A, ExtensionSignInOperationError> {
  return Effect.tryPromise({ try: operation, catch: () => new ExtensionSignInOperationError({}) });
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  analytics_enabled: number | null;
  chat_color: string | null;
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    analyticsEnabled: row.analytics_enabled === null ? null : row.analytics_enabled === 1,
    chatColor: isAvatarColor(row.chat_color) ? row.chat_color : null,
  };
}

/**
 * Hands the browser extension a one-time code after the person allowed it on the web app, and trades the code plus
 * the extension's PKCE verifier for a session. The codes live in the D1 table `company_sign_in_codes`: the name is
 * a legacy one from before the table served only the extension. Only the SHA-256 hash of a code is stored, so no secret is needed.
 */
export class ExtensionSignInService {
  readonly #database: D1Database;
  readonly #development: boolean;
  readonly #browserExtensionIds: ReadonlySet<string>;
  readonly #now: () => number;
  readonly #flushSessionRevocations: () => Effect.Effect<void, RemoteFailure>;

  constructor(
    bindings: Pick<WorkerBindings, "DB" | "AUTH_EXPOSE_DEVELOPMENT_CODE" | "BROWSER_EXTENSION_IDS">,
    options: { now?: () => number; flushSessionRevocations?: () => Effect.Effect<void, RemoteFailure> } = {},
  ) {
    this.#database = bindings.DB;
    this.#development = bindings.AUTH_EXPOSE_DEVELOPMENT_CODE === "true";
    this.#browserExtensionIds = new Set(
      (bindings.BROWSER_EXTENSION_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => BROWSER_EXTENSION_ID_PATTERN.test(id)),
    );
    this.#now = options.now ?? Date.now;
    this.#flushSessionRevocations = options.flushSessionRevocations ?? (() => Effect.void);
  }

  readonly issueCode = Effect.fn("ExtensionSignIn.issueCode")(function* (
    this: ExtensionSignInService,
    userId: string,
    input: { extensionId: string; clientChallenge: string },
  ): Effect.fn.Return<{ code: string }, ExtensionSignInFailure> {
    const listed = this.#development || this.#browserExtensionIds.has(input.extensionId);
    if (!BROWSER_EXTENSION_ID_PATTERN.test(input.extensionId) || !listed) {
      return yield* new ExtensionSignInError(
        403,
        "browser_extension_not_allowed",
        "This browser extension cannot sign in to OpenBot.",
      );
    }
    if (!TOKEN_PATTERN.test(input.clientChallenge)) {
      return yield* new ExtensionSignInError(400, "invalid_sign_in_code", "The sign-in did not finish. Try again.");
    }
    const exchangeCode = randomToken(32);
    const codeHash = yield* sha256(exchangeCode).pipe(Effect.mapError(() => new ExtensionSignInOperationError({})));
    const now = this.#now();
    yield* storeCall(() =>
      this.#database
        .prepare(
          `INSERT INTO company_sign_in_codes(code_hash, user_id, client_challenge, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(codeHash, userId, input.clientChallenge, now, now + CODE_TTL_MS)
        .run(),
    );
    return { code: exchangeCode };
  });

  readonly exchange = Effect.fn("ExtensionSignIn.exchange")(function* (
    this: ExtensionSignInService,
    input: { code: string; codeVerifier: string; device?: MobileAuthDeviceIdentity },
  ): Effect.fn.Return<{ sessionToken: string; user: AuthUser }, ExtensionSignInFailure> {
    const failed = new ExtensionSignInError(400, "invalid_sign_in_code", "The sign-in did not finish. Try again.");
    if (!TOKEN_PATTERN.test(input.code) || !TOKEN_PATTERN.test(input.codeVerifier)) return yield* failed;
    const hash = (value: string) => sha256(value).pipe(Effect.mapError(() => new ExtensionSignInOperationError({})));
    const codeHash = yield* hash(input.code);
    const challenge = yield* hash(input.codeVerifier);
    const now = this.#now();
    const session = { id: crypto.randomUUID(), token: randomToken() };
    const tokenHash = yield* hash(session.token);
    const [spent, , registered] = yield* storeCall(() =>
      this.#database.batch([
        this.#database
          .prepare(
            `UPDATE company_sign_in_codes SET redeemed_at = ?, session_id = ?
             WHERE code_hash = ? AND client_challenge = ? AND redeemed_at IS NULL AND expires_at > ?`,
          )
          .bind(now, session.id, codeHash, challenge, now),
        this.#database
          .prepare(
            `INSERT INTO auth_sessions(id, user_id, token_hash, expires_at, created_at, last_used_at)
             SELECT ?, user_id, ?, ?, ?, ? FROM company_sign_in_codes WHERE code_hash = ? AND session_id = ?`,
          )
          .bind(session.id, tokenHash, PERSISTENT_SESSION_EXPIRES_AT, now, now, codeHash, session.id),
        ...(input.device ? mobileSessionStatements(this.#database, { now, session, device: input.device }, null) : []),
      ]),
    );
    if (spent?.meta.changes !== 1) return yield* failed;
    if (input.device) {
      if (registered?.meta.changes !== 1) return yield* new ExtensionSignInOperationError({});
      yield* this.#flushSessionRevocations().pipe(Effect.catch(() => Effect.void));
    }
    const row = yield* storeCall(() =>
      this.#database
        .prepare(
          `SELECT users.id, users.email, users.name, users.avatar_url, users.analytics_enabled, users.chat_color
           FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.id = ?`,
        )
        .bind(session.id)
        .first<UserRow>(),
    );
    if (!row) return yield* failed;
    return { sessionToken: session.token, user: mapUser(row) };
  });
}
