import type { VaultItemKind } from "@openbot/contracts/ipc";
import type { DynamicRecord } from "@openbot/contracts/runtime-values";
import { sourceText } from "@openbot/i18n/source";
import { canonicalJson } from "./universal-vault-crypto";
import {
  decodeStoredItem,
  type StoredApiKey,
  type StoredCard,
  type StoredContact,
  type StoredLogin,
  type UniversalMark,
  type UniversalRemoval,
  type VaultRecord,
} from "./vault-store";

export type TaggedItem =
  | { kind: "login"; item: StoredLogin }
  | { kind: "card"; item: StoredCard }
  | { kind: "contact"; item: StoredContact }
  | { kind: "apiKey"; item: StoredApiKey };

export type UnshareScope = "all-devices" | "this-device";

const HOST_FIELDS = new Set(["agents", "addedBy", "universal", "fillSites"]);
const API_KEY_COPY_SUFFIX = "_CONFLICT_COPY";
const API_KEY_COPY_NAME_LIMIT = 48;

export function taggedItems(record: VaultRecord): TaggedItem[] {
  return [
    ...record.logins.map((item): TaggedItem => ({ kind: "login", item })),
    ...record.cards.map((item): TaggedItem => ({ kind: "card", item })),
    ...record.contacts.map((item): TaggedItem => ({ kind: "contact", item })),
    ...record.apiKeys.map((item): TaggedItem => ({ kind: "apiKey", item })),
  ];
}

export function findTagged(record: VaultRecord, id: string): TaggedItem | null {
  return taggedItems(record).find((tagged) => tagged.item.id === id) ?? null;
}

function replaceOrAdd<T extends { id: string }>(items: readonly T[], item: T): T[] {
  return items.some(({ id }) => id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

export function putTagged(record: VaultRecord, tagged: TaggedItem): VaultRecord {
  switch (tagged.kind) {
    case "login":
      return { ...record, logins: replaceOrAdd(record.logins, tagged.item) };
    case "card":
      return { ...record, cards: replaceOrAdd(record.cards, tagged.item) };
    case "contact":
      return { ...record, contacts: replaceOrAdd(record.contacts, tagged.item) };
    case "apiKey":
      return { ...record, apiKeys: replaceOrAdd(record.apiKeys, tagged.item) };
  }
}

export function dropItem(record: VaultRecord, id: string): VaultRecord {
  return {
    ...record,
    logins: record.logins.filter((login) => login.id !== id),
    cards: record.cards
      .filter((card) => card.id !== id)
      .map((card) => (card.billingContactId === id ? { ...card, billingContactId: null } : card)),
    contacts: record.contacts.filter((contact) => contact.id !== id),
    apiKeys: record.apiKeys.filter((apiKey) => apiKey.id !== id),
  };
}

export function withUniversal(tagged: TaggedItem, mark: UniversalMark | undefined): TaggedItem {
  const universal = mark === undefined ? {} : { universal: mark };
  switch (tagged.kind) {
    case "login": {
      const { universal: _previous, ...rest } = tagged.item;
      return { kind: "login", item: { ...rest, ...universal } };
    }
    case "card": {
      const { universal: _previous, ...rest } = tagged.item;
      return { kind: "card", item: { ...rest, ...universal } };
    }
    case "contact": {
      const { universal: _previous, ...rest } = tagged.item;
      return { kind: "contact", item: { ...rest, ...universal } };
    }
    case "apiKey": {
      const { universal: _previous, ...rest } = tagged.item;
      return { kind: "apiKey", item: { ...rest, ...universal } };
    }
  }
}

export function syncPlain(tagged: TaggedItem): DynamicRecord {
  return Object.fromEntries(Object.entries(tagged.item).filter(([key]) => !HOST_FIELDS.has(key)));
}

function contentKey(tagged: TaggedItem): string {
  return canonicalJson(syncPlain(tagged));
}

export function sameContent(left: TaggedItem, right: TaggedItem): boolean {
  return contentKey(left) === contentKey(right);
}

export function decodeRemoteItem(kind: VaultItemKind, id: string, plain: DynamicRecord): TaggedItem {
  const clean = Object.fromEntries(Object.entries(plain).filter(([key]) => !HOST_FIELDS.has(key)));
  const tagged = decodeTagged(kind, clean);
  if (tagged.item.id !== id) throw new Error("The item id does not match.");
  return tagged;
}

function decodeTagged(kind: VaultItemKind, value: DynamicRecord): TaggedItem {
  switch (kind) {
    case "login":
      return { kind, item: decodeStoredItem.login(value) };
    case "card":
      return { kind, item: decodeStoredItem.card(value) };
    case "contact":
      return { kind, item: decodeStoredItem.contact(value) };
    case "apiKey":
      return { kind, item: decodeStoredItem.apiKey(value) };
  }
}

function withoutRemoved(record: VaultRecord, id: string): VaultRecord {
  const removed = record.universalRemoved?.filter((entry) => entry.id !== id);
  const { universalRemoved: _previous, ...rest } = record;
  return removed && removed.length > 0 ? { ...rest, universalRemoved: removed } : rest;
}

function addRemoved(record: VaultRecord, entry: UniversalRemoval): VaultRecord {
  const rest = withoutRemoved(record, entry.id);
  return { ...rest, universalRemoved: [...(rest.universalRemoved ?? []), entry] };
}

function carryHostFields(remote: TaggedItem, local: TaggedItem | null, mark: UniversalMark): TaggedItem {
  const host = {
    ...(local?.item.agents === undefined ? {} : { agents: local.item.agents }),
    ...(local?.item.addedBy === undefined ? {} : { addedBy: local.item.addedBy }),
    universal: mark,
  };
  switch (remote.kind) {
    case "login":
      return { kind: "login", item: { ...remote.item, ...host } };
    case "card": {
      const fillSites = local?.kind === "card" ? local.item.fillSites : undefined;
      return { kind: "card", item: { ...remote.item, ...host, ...(fillSites ? { fillSites } : {}) } };
    }
    case "contact":
      return { kind: "contact", item: { ...remote.item, ...host } };
    case "apiKey":
      return { kind: "apiKey", item: { ...remote.item, ...host } };
  }
}

function conflictCopy(local: TaggedItem, suffix: string, id: string): TaggedItem {
  const unshared = withUniversal(local, undefined);
  switch (unshared.kind) {
    case "login":
      return { kind: "login", item: { ...unshared.item, id, notes: `${suffix}\n${unshared.item.notes}`.trim() } };
    case "card":
      return { kind: "card", item: { ...unshared.item, id, label: `${unshared.item.label} ${suffix}`.trim() } };
    case "contact":
      return { kind: "contact", item: { ...unshared.item, id, label: `${unshared.item.label} ${suffix}`.trim() } };
    case "apiKey":
      return {
        kind: "apiKey",
        item: {
          ...unshared.item,
          id,
          name: `${unshared.item.name.slice(0, API_KEY_COPY_NAME_LIMIT)}${API_KEY_COPY_SUFFIX}`,
          notes: `${suffix}\n${unshared.item.notes}`.trim(),
        },
      };
  }
}

export function mergeRemoteItem(
  record: VaultRecord,
  remote: TaggedItem,
  revision: number,
  suffix: string,
  newId: () => string,
): VaultRecord {
  const id = remote.item.id;
  if (record.universalIgnored?.includes(id)) return record;
  const removal = record.universalRemoved?.find((entry) => entry.id === id);
  if (removal?.mode === "unshared")
    return revision > removal.revision ? addRemoved(record, { ...removal, revision }) : record;
  const local = findTagged(record, id);
  const mark: UniversalMark = { revision };
  if (!local) return putTagged(withoutRemoved(record, id), carryHostFields(remote, null, mark));
  if (local.kind !== remote.kind || !local.item.universal) return record;
  if (revision <= local.item.universal.revision) return record;
  const conflicted = local.item.universal.pending === true && !sameContent(local, remote);
  const base = conflicted ? putTagged(record, conflictCopy(local, suffix, newId())) : record;
  return putTagged(withoutRemoved(base, id), carryHostFields(remote, local, mark));
}

export function applyRemoteRemoval(
  record: VaultRecord,
  id: string,
  mode: "deleted" | "unshared",
  revision: number,
): VaultRecord {
  const cleared = withoutRemoved(record, id);
  const local = findTagged(cleared, id);
  if (!local?.item.universal) return cleared;
  if (local.item.universal.pending === true)
    return putTagged(
      cleared,
      withUniversal(local, { revision: Math.max(revision, local.item.universal.revision), pending: true }),
    );
  return mode === "unshared" ? putTagged(cleared, withUniversal(local, undefined)) : dropItem(cleared, id);
}

export function acknowledgePush(record: VaultRecord, pushed: TaggedItem, revision: number): VaultRecord {
  const local = findTagged(record, pushed.item.id);
  if (!local?.item.universal) return record;
  const unchanged = sameContent(local, pushed);
  return putTagged(record, withUniversal(local, unchanged ? { revision } : { revision, pending: true }));
}

export function acknowledgeRemoval(record: VaultRecord, id: string): VaultRecord {
  return withoutRemoved(record, id);
}

export function markLocalChanges(before: VaultRecord, after: VaultRecord): VaultRecord {
  const previous = new Map(taggedItems(before).map((tagged) => [tagged.item.id, tagged]));
  const current = new Set(taggedItems(after).map((tagged) => tagged.item.id));
  let next = after;
  for (const tagged of taggedItems(after)) {
    const mark = tagged.item.universal;
    if (!mark || mark.pending) continue;
    const prior = previous.get(tagged.item.id);
    if (prior?.item.universal && sameContent(prior, tagged)) continue;
    next = putTagged(next, withUniversal(tagged, { revision: mark.revision, pending: true }));
  }
  for (const [id, prior] of previous) {
    const mark = prior.item.universal;
    if (!mark || current.has(id) || mark.revision === 0) continue;
    next = addRemoved(next, { id, kind: prior.kind, revision: mark.revision, mode: "deleted" });
  }
  for (const card of next.cards) {
    if (!card.universal || card.billingContactId === null) continue;
    const contact = next.contacts.find((item) => item.id === card.billingContactId);
    if (contact && !contact.universal)
      next = putTagged(next, withUniversal({ kind: "contact", item: contact }, { revision: 0, pending: true }));
  }
  return next;
}

export function setItemUniversal(
  record: VaultRecord,
  id: string,
  kind: VaultItemKind,
  value: boolean,
  scope: UnshareScope,
  account: string,
): VaultRecord {
  const local = findTagged(record, id);
  if (!local || local.kind !== kind) throw new Error(sourceText("error.vault.itemMissing"));
  const mark = local.item.universal;
  if (value) {
    if (mark) return record;
    const ignored = record.universalIgnored?.filter((entry) => entry !== id) ?? [];
    const { universalIgnored: _ignored, ...rest } = record;
    const base = ignored.length > 0 ? { ...rest, universalIgnored: ignored } : rest;
    return putTagged({ ...base, universalAccount: account }, withUniversal(local, { revision: 0, pending: true }));
  }
  if (!mark) return record;
  const unshared = putTagged(record, withUniversal(local, undefined));
  if (scope === "this-device")
    return { ...unshared, universalIgnored: [...new Set([...(unshared.universalIgnored ?? []), id])] };
  return mark.revision > 0 ? addRemoved(unshared, { id, kind, revision: mark.revision, mode: "unshared" }) : unshared;
}

export function stripUniversal(record: VaultRecord): VaultRecord {
  const { universalAccount: _account, universalRemoved: _removed, universalIgnored: _ignored, ...rest } = record;
  return taggedItems(rest).reduce(
    (next, tagged) => (tagged.item.universal ? putTagged(next, withUniversal(tagged, undefined)) : next),
    rest,
  );
}

export function hasUniversalState(record: VaultRecord): boolean {
  return (
    record.universalAccount !== undefined ||
    record.universalRemoved !== undefined ||
    record.universalIgnored !== undefined ||
    taggedItems(record).some((tagged) => tagged.item.universal !== undefined)
  );
}

export function pendingTagged(record: VaultRecord): TaggedItem[] {
  return taggedItems(record).filter((tagged) => tagged.item.universal?.pending === true);
}

export function pendingCount(record: VaultRecord): number {
  return pendingTagged(record).length + (record.universalRemoved?.length ?? 0);
}

export function clearDanglingBilling(record: VaultRecord): VaultRecord {
  const contacts = new Set(record.contacts.map((contact) => contact.id));
  if (record.cards.every((card) => card.billingContactId === null || contacts.has(card.billingContactId)))
    return record;
  return {
    ...record,
    cards: record.cards.map((card) =>
      card.billingContactId !== null && !contacts.has(card.billingContactId)
        ? { ...card, billingContactId: null }
        : card,
    ),
  };
}
