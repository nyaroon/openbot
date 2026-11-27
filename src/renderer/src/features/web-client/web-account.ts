import type {
  AccountSession,
  AvatarColor,
  AvatarImageInput,
  CreateOwnerAccountInput,
  CreateOwnerAccountResult,
  OwnerAccount,
} from "@openbot/contracts/ipc";
import { readOwnerAccountPlaces } from "@openbot/contracts/ipc";
import { isBoolean, isDynamicRecord, isNumber, isString } from "@openbot/contracts/runtime-values";
import { parseServerClaim, type ServerClaim } from "@openbot/contracts/server-install";
import { currentText } from "@openbot/ui/text";

export interface WebAccountCalls {
  updateName: (name: string) => Promise<void>;
  updateAnalytics: (enabled: boolean, ageMs: number) => Promise<boolean | null>;
  updateAvatar: (image: AvatarImageInput | null) => Promise<void>;
  setChatColor: (color: AvatarColor | null) => Promise<void>;
  listSessions: () => Promise<AccountSession[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  createServerClaim: () => Promise<ServerClaim>;
  listOwnerAccounts: () => Promise<OwnerAccount[]>;
  createOwnerAccount: (input: CreateOwnerAccountInput) => Promise<CreateOwnerAccountResult>;
}

const REQUEST_TIMEOUT_MS = 15_000;

export function createWebAccountCalls(
  accountFetch: typeof fetch,
  onAccountChanged: () => Promise<void>,
): WebAccountCalls {
  async function request(
    path: string,
    init: { method: string; body?: BodyInit; contentType?: string; allowConflict?: boolean } = { method: "GET" },
  ): Promise<Response> {
    const response = await accountFetch(`/api/browser/${path}`, {
      method: init.method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers:
        init.method === "GET"
          ? {}
          : {
              "Content-Type": init.contentType ?? "application/json",
              "X-OpenBot-Browser": "1",
            },
      ...(init.body === undefined ? {} : { body: init.body }),
    }).catch(() => {
      throw new Error(errorMessage(null));
    });
    if (!response.ok && !(init.allowConflict === true && response.status === 409)) {
      throw new Error(errorMessage(await response.json().catch(() => null)));
    }
    return response;
  }

  return {
    async updateName(name) {
      await request("v1/me/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      await onAccountChanged();
    },
    async updateAnalytics(enabled, ageMs) {
      const response = await request("v1/me/analytics", { method: "PUT", body: JSON.stringify({ enabled, ageMs }) });
      const user = await response.json().catch(() => null);
      await onAccountChanged();
      return isDynamicRecord(user) && isBoolean(user.analyticsEnabled) ? user.analyticsEnabled : null;
    },
    async updateAvatar(image) {
      await request(
        "v1/me/avatar",
        image
          ? { method: "PUT", body: new Uint8Array(image.bytes), contentType: image.mimeType }
          : { method: "DELETE", body: "{}" },
      );
      await onAccountChanged();
    },
    async setChatColor(color) {
      await request("v1/me/chat-color", { method: "PUT", body: JSON.stringify({ chatColor: color }) });
      await onAccountChanged();
    },
    async listSessions() {
      const value = await (await request("v1/me/sessions")).json().catch(() => null);
      if (!isDynamicRecord(value) || !Array.isArray(value.sessions)) throw new Error(errorMessage(null));
      return value.sessions.map(decodeSession);
    },
    async createServerClaim() {
      const claim = parseServerClaim(
        await (await request("v2/server-claims", { method: "POST", body: "{}" })).json().catch(() => null),
      );
      if (!claim) throw new Error(errorMessage(null));
      return claim;
    },
    async listOwnerAccounts() {
      const value = await (await request("v1/admin/accounts")).json().catch(() => null);
      if (!isDynamicRecord(value) || !Array.isArray(value.accounts)) throw new Error(errorMessage(null));
      return value.accounts.map(decodeOwnerAccount);
    },
    async createOwnerAccount(input) {
      const response = await request("v1/admin/accounts", {
        method: "POST",
        body: JSON.stringify(input),
        allowConflict: true,
      });
      if (response.status === 409) return { status: "exists" };
      return { status: "created", account: decodeOwnerAccount(await response.json().catch(() => null)) };
    },
    async revokeSession(sessionId) {
      await request(`v1/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE", body: "{}" });
    },
  };
}

function errorMessage(value: unknown): string {
  if (isDynamicRecord(value) && isDynamicRecord(value.error) && isString(value.error.message))
    return value.error.message;
  return currentText().t("webClient.error.requestFailed");
}

function decodeOwnerAccount(value: unknown): OwnerAccount {
  if (
    !isDynamicRecord(value) ||
    !isString(value.id) ||
    !isString(value.email) ||
    (value.name !== null && !isString(value.name)) ||
    !isNumber(value.createdAt) ||
    (value.lastSignInAt !== null && !isNumber(value.lastSignInAt))
  )
    throw new Error(errorMessage(null));
  return {
    id: value.id,
    email: value.email,
    name: value.name,
    createdAt: value.createdAt,
    lastSignInAt: value.lastSignInAt,
    ...readOwnerAccountPlaces(value),
  };
}

function decodeSession(value: unknown): AccountSession {
  if (
    !isDynamicRecord(value) ||
    !isString(value.sessionId) ||
    !isString(value.name) ||
    (value.kind !== "desktop" && value.kind !== "mobile") ||
    !isBoolean(value.current) ||
    !isNumber(value.connectedAt) ||
    !isNumber(value.lastActiveAt)
  )
    throw new Error(errorMessage(null));
  return {
    sessionId: value.sessionId,
    name: value.name,
    kind: value.kind,
    current: value.current,
    connectedAt: value.connectedAt,
    lastActiveAt: value.lastActiveAt,
  };
}
