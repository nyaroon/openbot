import { randomUUID } from "node:crypto";
import {
  EMPTY_ORGANIZATIONS,
  ORGANIZATION_ROLES,
  type OrganizationAddMemberInput,
  type OrganizationBindableServer,
  type OrganizationCreateInput,
  type OrganizationMember,
  type OrganizationRemoveMemberInput,
  type OrganizationRenameInput,
  type OrganizationRole,
  type OrganizationServer,
  type OrganizationServers,
  type OrganizationServerTarget,
  type OrganizationSetRoleInput,
  type OrganizationSummary,
  type OrganizationsIssue,
  type OrganizationsState,
  type OrganizationVault,
  type OrganizationVaultAddInput,
  type OrganizationVaultItem,
  type OrganizationVaultRemoveInput,
  type OrganizationVaultShareInput,
  type VaultItemKind,
} from "@openbot/contracts/ipc";
import { type DynamicRecord, isDynamicRecord, isOneOf, isString } from "@openbot/contracts/runtime-values";
import { sourceText } from "@openbot/i18n/source";
import { Effect, Semaphore } from "effect";
import type { CentralAuthOperationError } from "./central-auth-effects";
import { authApiErrorCode, type CentralAuthManager, isFinalClientError } from "./central-auth-manager";
import { OrganizationError } from "./organization-error";
import type { OrganizationLocal, OrganizationLocalItem, OrganizationStore } from "./organization-store";
import { decodeRemoteItem, findTagged, syncPlain, type TaggedItem } from "./universal-vault-items";
import type { LinkedVaultItem, VaultService } from "./vault-service";

const PAGE_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 30_000;
const MIN_SYNC_GAP_MS = 30_000;
const KINDS: readonly VaultItemKind[] = ["login", "card", "contact", "apiKey"];

type OrganizationFailure = CentralAuthOperationError | OrganizationError;

type OrganizationErrorKey =
  | "error.organization.signIn"
  | "error.organization.forbidden"
  | "error.organization.notFound"
  | "error.organization.lastOwner"
  | "error.organization.memberNotFound"
  | "error.organization.memberExists"
  | "error.organization.memberLimit"
  | "error.organization.invalidPhone"
  | "error.organization.organizationLimit"
  | "error.organization.notConfigured"
  | "error.organization.itemConflict"
  | "error.organization.itemLimit"
  | "error.organization.itemMissing"
  | "error.organization.vaultUnreadable"
  | "error.organization.itemInvalid"
  | "error.organization.personalMissing"
  | "error.organization.serverNotFound"
  | "error.organization.serverTaken"
  | "error.organization.serverRevoked"
  | "error.organization.serverFull";

const CODE_MESSAGES: ReadonlyArray<readonly [string, OrganizationErrorKey]> = [
  ["forbidden", "error.organization.forbidden"],
  ["organization_not_found", "error.organization.notFound"],
  ["last_owner", "error.organization.lastOwner"],
  ["member_not_found", "error.organization.memberNotFound"],
  ["member_exists", "error.organization.memberExists"],
  ["member_limit", "error.organization.memberLimit"],
  ["invalid_phone", "error.organization.invalidPhone"],
  ["organization_limit", "error.organization.organizationLimit"],
  ["org_vault_not_configured", "error.organization.notConfigured"],
  ["org_vault_item_conflict", "error.organization.itemConflict"],
  ["org_vault_item_limit", "error.organization.itemLimit"],
  ["org_vault_item_not_found", "error.organization.itemMissing"],
  ["org_vault_unreadable", "error.organization.vaultUnreadable"],
  ["invalid_org_vault_item", "error.organization.itemInvalid"],
  ["org_vault_item_kind_mismatch", "error.organization.itemInvalid"],
  ["server_not_found", "error.organization.serverNotFound"],
  ["organization_server_not_found", "error.organization.serverNotFound"],
  ["server_in_organization", "error.organization.serverTaken"],
  ["server_membership_revoked", "error.organization.serverRevoked"],
  ["member_limit_reached", "error.organization.serverFull"],
  ["organization_membership_required", "error.organization.forbidden"],
];

function organizationError(key: OrganizationErrorKey): OrganizationError {
  return new OrganizationError({ cause: new Error(sourceText(key)) });
}

/** Known server codes become plain messages. Other failures keep their own text. */
function readable(failure: OrganizationFailure): OrganizationFailure {
  const code = authApiErrorCode(failure.cause);
  const known = CODE_MESSAGES.find(([candidate]) => candidate === code);
  return known ? organizationError(known[1]) : failure;
}

function isManager(role: OrganizationRole | null, platformOwner: boolean): boolean {
  return platformOwner || role === "owner" || role === "admin";
}

interface ListedOrganization {
  id: string;
  name: string;
  role: OrganizationRole | null;
  platformOwner: boolean;
  memberCount: number;
}

interface OrganizationList {
  platformOwner: boolean;
  organizations: ListedOrganization[];
}

interface PageEntry {
  itemId: string;
  revision: number;
  content: { kind: VaultItemKind; shared: boolean; item: DynamicRecord } | null;
}

interface Page {
  managed: boolean;
  items: PageEntry[];
  next: number;
  more: boolean;
}

function readRole(value: unknown): OrganizationRole | null {
  return isOneOf(ORGANIZATION_ROLES, value) ? value : null;
}

function decodeList(value: unknown): OrganizationList {
  if (!isDynamicRecord(value) || !Array.isArray(value.organizations))
    throw new Error("Invalid organizations response.");
  const organizations = value.organizations.map((entry): ListedOrganization => {
    if (
      !isDynamicRecord(entry) ||
      !isString(entry.id) ||
      !isString(entry.name) ||
      typeof entry.platformOwner !== "boolean" ||
      typeof entry.memberCount !== "number"
    )
      throw new Error("Invalid organizations response.");
    return {
      id: entry.id,
      name: entry.name,
      role: readRole(entry.role),
      platformOwner: entry.platformOwner,
      memberCount: entry.memberCount,
    };
  });
  return { platformOwner: value.platformOwner === true, organizations };
}

function decodeEntry(value: unknown): PageEntry {
  if (!isDynamicRecord(value) || !isString(value.itemId) || typeof value.revision !== "number")
    throw new Error("Invalid organization vault response.");
  const { itemId, revision } = value;
  if (!("item" in value)) return { itemId, revision, content: null };
  const kind = KINDS.find((candidate) => candidate === value.kind);
  if (!kind || typeof value.shared !== "boolean" || !isDynamicRecord(value.item))
    throw new Error("Invalid organization vault response.");
  return { itemId, revision, content: { kind, shared: value.shared, item: value.item } };
}

function decodePage(value: unknown): Page {
  if (
    !isDynamicRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.next !== "number" ||
    typeof value.more !== "boolean"
  )
    throw new Error("Invalid organization vault response.");
  const role = readRole(value.role);
  if (!role) throw new Error("Invalid organization vault response.");
  return {
    managed: role === "owner" || role === "admin",
    items: value.items.map(decodeEntry),
    next: value.next,
    more: value.more,
  };
}

function decodeMembers(value: unknown): OrganizationMember[] {
  if (!isDynamicRecord(value) || !Array.isArray(value.members)) throw new Error("Invalid members response.");
  return value.members.map((member): OrganizationMember => {
    const role = isDynamicRecord(member) ? readRole(member.role) : null;
    if (!isDynamicRecord(member) || !isString(member.userId) || !isString(member.phone) || !role)
      throw new Error("Invalid members response.");
    return { userId: member.userId, phone: member.phone, name: isString(member.name) ? member.name : null, role };
  });
}

function decodeServers(organizationId: string) {
  return (value: unknown): OrganizationServers => {
    if (!isDynamicRecord(value) || !Array.isArray(value.servers) || !Array.isArray(value.bindable))
      throw new Error("Invalid servers response.");
    const servers = value.servers.map((server): OrganizationServer => {
      if (
        !isDynamicRecord(server) ||
        !isString(server.hostId) ||
        !isString(server.name) ||
        typeof server.member !== "boolean" ||
        typeof server.owner !== "boolean" ||
        typeof server.canUnbind !== "boolean"
      )
        throw new Error("Invalid servers response.");
      return {
        hostId: server.hostId,
        name: server.name,
        member: server.member,
        owner: server.owner,
        canUnbind: server.canUnbind,
      };
    });
    const bindable = value.bindable.map((server): OrganizationBindableServer => {
      if (!isDynamicRecord(server) || !isString(server.hostId) || !isString(server.name))
        throw new Error("Invalid servers response.");
      return { hostId: server.hostId, name: server.name };
    });
    return { organizationId, servers, bindable };
  };
}

function decodeIgnored(_value: unknown): null {
  return null;
}

function tagged(item: OrganizationLocalItem): TaggedItem | null {
  try {
    return decodeRemoteItem(item.kind, item.id, item.item);
  } catch {
    return null;
  }
}

function hostOf(website: string): string {
  return website.replace(/^[a-z][a-z0-9+.-]*:\/\//iu, "").replace(/[/?#].*$/u, "");
}

function describe(item: TaggedItem): { title: string; detail: string } {
  switch (item.kind) {
    case "login":
      return { title: hostOf(item.item.website), detail: item.item.username };
    case "card":
      return {
        title: item.item.label,
        detail: item.item.number.length >= 4 ? `•••• ${item.item.number.slice(-4)}` : "",
      };
    case "contact":
      return { title: item.item.label, detail: item.item.fullName || item.item.email };
    case "apiKey":
      return { title: item.item.name, detail: item.item.notes };
  }
}

export interface OrganizationServiceOptions {
  auth: Pick<CentralAuthManager, "requestAuthorized" | "getState" | "on" | "off">;
  vault: VaultService;
  store: OrganizationStore;
}

export class OrganizationService {
  readonly #auth: OrganizationServiceOptions["auth"];
  readonly #vault: VaultService;
  readonly #store: OrganizationStore;
  readonly #queue = Semaphore.makeUnsafe(1);
  readonly #listeners = new Set<(state: OrganizationsState) => void>();
  #busy = false;
  #lastSyncAt: number | null = null;
  #lastAttemptAt = 0;
  #issue: OrganizationsIssue | null = null;
  #unsubscribe: Array<() => void> = [];
  #disposed = false;
  #serversJoined: (() => void) | undefined;

  constructor(options: OrganizationServiceOptions) {
    this.#auth = options.auth;
    this.#vault = options.vault;
    this.#store = options.store;
  }

  readonly start = Effect.fn("Organizations.start")(function* (this: OrganizationService) {
    yield* this.#store.load();
    const onAuth = () => void Effect.runPromise(this.#follow());
    this.#auth.on("changed", onAuth);
    this.#unsubscribe.push(() => this.#auth.off("changed", onAuth));
    yield* this.#follow();
  });

  dispose(): void {
    this.#disposed = true;
    for (const stop of this.#unsubscribe) stop();
    this.#unsubscribe = [];
  }

  state(): OrganizationsState {
    const signedIn = this.#userId() !== null;
    const record = this.#store.read();
    if (!signedIn || !record) return { ...EMPTY_ORGANIZATIONS, signedIn, busy: this.#busy, issue: this.#issue };
    const organizations = record.organizations
      .map((organization): OrganizationSummary => {
        const canManage = isManager(organization.role, organization.platformOwner);
        return {
          id: organization.id,
          name: organization.name,
          role: organization.role,
          platformOwner: organization.platformOwner,
          canManage,
          memberCount: organization.memberCount,
          sharedCount: organization.items.filter((item) => item.shared).length,
          itemCount: organization.items.length,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      signedIn,
      busy: this.#busy,
      lastSyncAt: this.#lastSyncAt,
      issue: this.#issue,
      platformOwner: record.platformOwner,
      organizations,
    };
  }

  onChanged(listener: (state: OrganizationsState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Follows the Universal vault's own sync cycle without adding a poll of its own. */
  syncSoon(): void {
    if (this.#disposed || Date.now() - this.#lastAttemptAt < MIN_SYNC_GAP_MS) return;
    void Effect.runPromise(this.#sync().pipe(Effect.ignore));
  }

  readonly refresh = Effect.fn("Organizations.refresh")(function* (this: OrganizationService) {
    yield* this.#requireUser();
    yield* this.#sync();
    return this.state();
  });

  readonly create = Effect.fn("Organizations.create")(function* (
    this: OrganizationService,
    input: OrganizationCreateInput,
  ) {
    yield* this.#send("/v1/organizations", "POST", { name: input.name, ownerNumber: input.ownerNumber });
    yield* this.#sync();
    return this.state();
  });

  readonly rename = Effect.fn("Organizations.rename")(function* (
    this: OrganizationService,
    input: OrganizationRenameInput,
  ) {
    yield* this.#send(this.#path(input.organizationId), "PATCH", { name: input.name });
    yield* this.#sync();
    return this.state();
  });

  readonly remove = Effect.fn("Organizations.remove")(function* (this: OrganizationService, organizationId: string) {
    yield* this.#send(this.#path(organizationId), "DELETE", undefined);
    yield* this.#sync();
    return this.state();
  });

  readonly leave = Effect.fn("Organizations.leave")(function* (this: OrganizationService, organizationId: string) {
    const userId = yield* this.#requireUser();
    yield* this.#send(`${this.#path(organizationId)}/members/${encodeURIComponent(userId)}`, "DELETE", undefined);
    yield* this.#sync();
    return this.state();
  });

  readonly members = Effect.fn("Organizations.members")(function* (this: OrganizationService, organizationId: string) {
    yield* this.#requireUser();
    return yield* this.#call(`${this.#path(organizationId)}/members`, "GET", undefined, decodeMembers);
  });

  readonly servers = Effect.fn("Organizations.servers")(function* (this: OrganizationService, organizationId: string) {
    yield* this.#requireUser();
    return yield* this.#call(`${this.#path(organizationId)}/servers`, "GET", undefined, decodeServers(organizationId));
  });

  readonly bindServer = Effect.fn("Organizations.bindServer")(function* (
    this: OrganizationService,
    input: OrganizationServerTarget,
  ) {
    yield* this.#send(this.#serverPath(input), "PUT", undefined);
    return yield* this.servers(input.organizationId);
  });

  readonly unbindServer = Effect.fn("Organizations.unbindServer")(function* (
    this: OrganizationService,
    input: OrganizationServerTarget,
  ) {
    yield* this.#send(this.#serverPath(input), "DELETE", undefined);
    return yield* this.servers(input.organizationId);
  });

  /** Joins a bound server, then refreshes the server directory like accepting an invitation does. */
  readonly joinServer = Effect.fn("Organizations.joinServer")(function* (
    this: OrganizationService,
    input: OrganizationServerTarget,
  ) {
    yield* this.#send(`${this.#serverPath(input)}/join`, "POST", undefined);
    this.#serversJoined?.();
    return yield* this.servers(input.organizationId);
  });

  /** Called after joining a server so the server rail reloads the account's servers. */
  onServersJoined(listener: () => void): void {
    this.#serversJoined = listener;
  }

  readonly addMember = Effect.fn("Organizations.addMember")(function* (
    this: OrganizationService,
    input: OrganizationAddMemberInput,
  ) {
    yield* this.#send(`${this.#path(input.organizationId)}/members`, "POST", {
      number: input.number,
      role: input.role,
    });
    yield* this.#sync();
    return yield* this.members(input.organizationId);
  });

  readonly setMemberRole = Effect.fn("Organizations.setMemberRole")(function* (
    this: OrganizationService,
    input: OrganizationSetRoleInput,
  ) {
    yield* this.#send(`${this.#path(input.organizationId)}/members/${encodeURIComponent(input.userId)}`, "PATCH", {
      role: input.role,
    });
    yield* this.#sync();
    return yield* this.members(input.organizationId);
  });

  readonly removeMember = Effect.fn("Organizations.removeMember")(function* (
    this: OrganizationService,
    input: OrganizationRemoveMemberInput,
  ) {
    yield* this.#send(
      `${this.#path(input.organizationId)}/members/${encodeURIComponent(input.userId)}`,
      "DELETE",
      undefined,
    );
    yield* this.#sync();
    return yield* this.members(input.organizationId);
  });

  readonly vault = Effect.fn("Organizations.vault")(function* (this: OrganizationService, organizationId: string) {
    yield* this.#requireUser();
    return this.#vaultView(organizationId);
  });

  /** Copies a personal item into the organization vault, not shared yet. The personal item stays as it is. */
  readonly addVaultItem = Effect.fn("Organizations.addVaultItem")(function* (
    this: OrganizationService,
    input: OrganizationVaultAddInput,
  ) {
    yield* this.#requireUser();
    const personal = this.#vault.universalRecord();
    const source = personal ? findTagged(personal, input.itemId) : null;
    if (!source) return yield* organizationError("error.organization.personalMissing");
    const itemId = randomUUID();
    const plain: DynamicRecord = {
      ...syncPlain(source),
      id: itemId,
      ...(source.kind === "card" ? { billingContactId: null } : {}),
    };
    yield* this.#send(this.#itemPath(input.organizationId, itemId), "PUT", {
      kind: source.kind,
      item: plain,
      shared: false,
      baseRevision: 0,
    });
    yield* this.#sync();
    return this.#vaultView(input.organizationId);
  });

  readonly shareVaultItem = Effect.fn("Organizations.shareVaultItem")(function* (
    this: OrganizationService,
    input: OrganizationVaultShareInput,
  ) {
    yield* this.#requireUser();
    const current = this.#localItem(input.organizationId, input.itemId);
    if (!current) return yield* organizationError("error.organization.itemMissing");
    yield* this.#send(this.#itemPath(input.organizationId, input.itemId), "PUT", {
      kind: current.kind,
      shared: input.shared,
      baseRevision: current.revision,
    }).pipe(Effect.tapError(() => this.#sync()));
    yield* this.#sync();
    return this.#vaultView(input.organizationId);
  });

  readonly removeVaultItem = Effect.fn("Organizations.removeVaultItem")(function* (
    this: OrganizationService,
    input: OrganizationVaultRemoveInput,
  ) {
    yield* this.#requireUser();
    const current = this.#localItem(input.organizationId, input.itemId);
    if (!current) return yield* organizationError("error.organization.itemMissing");
    yield* this.#send(this.#itemPath(input.organizationId, input.itemId), "DELETE", {
      baseRevision: current.revision,
    }).pipe(Effect.tapError(() => this.#sync()));
    yield* this.#sync();
    return this.#vaultView(input.organizationId);
  });

  #userId(): string | null {
    const state = this.#auth.getState();
    return state.status === "signed_in" ? state.user.id : null;
  }

  #requireUser(): Effect.Effect<string, OrganizationError> {
    const userId = this.#userId();
    return userId ? Effect.succeed(userId) : Effect.fail(organizationError("error.organization.signIn"));
  }

  #path(organizationId: string): string {
    return `/v1/organizations/${encodeURIComponent(organizationId)}`;
  }

  #serverPath(input: OrganizationServerTarget): string {
    return `${this.#path(input.organizationId)}/servers/${encodeURIComponent(input.hostId)}`;
  }

  #itemPath(organizationId: string, itemId: string): string {
    return `${this.#path(organizationId)}/vault/items/${encodeURIComponent(itemId)}`;
  }

  #localItem(organizationId: string, itemId: string): OrganizationLocalItem | null {
    const organization = this.#store.read()?.organizations.find(({ id }) => id === organizationId);
    return organization?.items.find(({ id }) => id === itemId) ?? null;
  }

  #vaultView(organizationId: string): OrganizationVault {
    const organization = this.#store.read()?.organizations.find(({ id }) => id === organizationId);
    const items: OrganizationVaultItem[] = [];
    for (const item of organization?.items ?? []) {
      const decoded = tagged(item);
      if (!decoded) continue;
      const { title, detail } = describe(decoded);
      items.push({ id: item.id, kind: item.kind, title: title || item.id.slice(0, 8), detail, shared: item.shared });
    }
    items.sort((left, right) => left.title.localeCompare(right.title));
    return { organizationId, items };
  }

  #call<T>(
    path: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    body: unknown,
    decode: (value: unknown) => T,
  ) {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return this.#auth.requestAuthorized(path, init, decode, REQUEST_TIMEOUT_MS).pipe(Effect.mapError(readable));
  }

  #send(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown) {
    return this.#requireUser().pipe(Effect.andThen(this.#call(path, method, body, decodeIgnored)));
  }

  #emit(): void {
    const state = this.state();
    for (const listener of this.#listeners) listener(state);
  }

  /** Shows the shared items of the organizations this account belongs to beside the personal Vault. */
  #publish(): void {
    const record = this.#store.read();
    const linked: LinkedVaultItem[] = [];
    if (record && this.#userId() === record.account) {
      for (const organization of record.organizations) {
        for (const item of organization.items) {
          if (!item.shared) continue;
          const decoded = tagged(item);
          if (decoded) linked.push({ organization: { id: organization.id, name: organization.name }, tagged: decoded });
        }
      }
    }
    this.#vault.setLinked(linked);
    this.#emit();
  }

  #follow(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const userId = this.#userId();
      const record = this.#store.read();
      if (userId === null || (record && record.account !== userId)) {
        // Signing out, or signing in as someone else, removes every shared item from this computer.
        if (record) yield* this.#store.clear().pipe(Effect.ignore);
        this.#issue = null;
        this.#lastSyncAt = null;
        this.#publish();
        if (userId === null) return;
      }
      this.#publish();
      yield* this.#sync();
    });
  }

  #sync(): Effect.Effect<void> {
    return this.#queue.withPermit(this.#cycle()).pipe(Effect.uninterruptible);
  }

  #cycle(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const userId = this.#userId();
      if (userId === null || this.#disposed) return;
      this.#lastAttemptAt = Date.now();
      this.#busy = true;
      this.#emit();
      const outcome = yield* this.#pullAll(userId).pipe(Effect.result);
      this.#busy = false;
      if (outcome._tag === "Failure") {
        const cause = outcome.failure.cause;
        this.#issue =
          authApiErrorCode(cause) === "org_vault_not_configured"
            ? "notConfigured"
            : isFinalClientError(cause)
              ? "data"
              : "offline";
      } else {
        this.#lastSyncAt = Date.now();
        this.#issue = outcome.success;
      }
      this.#publish();
    });
  }

  #pullAll(userId: string): Effect.Effect<OrganizationsIssue | null, OrganizationFailure> {
    return Effect.gen({ self: this }, function* () {
      const listed = yield* this.#call("/v1/organizations", "GET", undefined, decodeList);
      const previous = this.#store.read();
      const known = previous && previous.account === userId ? previous.organizations : [];
      let issue: OrganizationsIssue | null = null;
      const next: OrganizationLocal[] = [];
      for (const entry of listed.organizations) {
        const managed = isManager(entry.role, entry.platformOwner);
        const existing = known.find(({ id }) => id === entry.id);
        const base: OrganizationLocal = {
          id: entry.id,
          name: entry.name,
          role: entry.role,
          platformOwner: entry.platformOwner,
          managed,
          memberCount: entry.memberCount,
          cursor: existing && existing.managed === managed ? existing.cursor : 0,
          items: existing && existing.managed === managed ? existing.items : [],
        };
        const pulled = yield* this.#pullOrganization(base).pipe(Effect.result);
        if (pulled._tag === "Success") {
          next.push(pulled.success.organization);
          if (pulled.success.issue) issue = pulled.success.issue;
          continue;
        }
        // Keep what was read so far, then report the failure after saving it.
        next.push(base);
        if (authApiErrorCode(pulled.failure.cause) === "org_vault_not_configured") {
          issue = "notConfigured";
          continue;
        }
        yield* this.#store
          .write({ account: userId, platformOwner: listed.platformOwner, organizations: next })
          .pipe(Effect.ignore);
        return yield* Effect.fail(pulled.failure);
      }
      yield* this.#store
        .write({ account: userId, platformOwner: listed.platformOwner, organizations: next })
        .pipe(Effect.mapError((error): OrganizationFailure => error));
      return issue;
    });
  }

  #pullOrganization(
    start: OrganizationLocal,
  ): Effect.Effect<{ organization: OrganizationLocal; issue: OrganizationsIssue | null }, OrganizationFailure> {
    return Effect.gen({ self: this }, function* () {
      let current = start;
      let issue: OrganizationsIssue | null = null;
      for (;;) {
        const page = yield* this.#call(
          `${this.#path(current.id)}/vault/items?since=${current.cursor}&limit=${PAGE_LIMIT}`,
          "GET",
          undefined,
          decodePage,
        );
        if (page.managed !== current.managed) {
          // The role changed under this computer, so what it read before no longer applies.
          current = { ...current, managed: page.managed, cursor: 0, items: [] };
          continue;
        }
        const items = new Map(current.items.map((item) => [item.id, item]));
        for (const entry of page.items) {
          if (!entry.content) {
            items.delete(entry.itemId);
            continue;
          }
          const item: OrganizationLocalItem = {
            id: entry.itemId,
            kind: entry.content.kind,
            revision: entry.revision,
            shared: entry.content.shared,
            item: entry.content.item,
          };
          if (tagged(item)) items.set(item.id, item);
          else {
            items.delete(item.id);
            issue = "data";
          }
        }
        current = { ...current, cursor: page.next, items: [...items.values()] };
        if (!page.more) return { organization: current, issue };
      }
    });
  }
}
