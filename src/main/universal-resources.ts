import { readFile } from "node:fs/promises";
import {
  type McpServerConfig,
  UNIVERSAL_DEVICE_LIMIT,
  type UniversalComputer,
  type UniversalCountKind,
  type UniversalResource,
  type UniversalSkillAgents,
  type UniversalTargets,
  universalTargetsOn,
} from "@openbot/contracts/ipc";
import type { DynamicRecord } from "@openbot/contracts/runtime-values";
import { Effect, Result, Schema, Semaphore } from "effect";
import type { McpGatewayChange } from "../backend/agent/mcp-gateway";
import { parseStoredJson, writeJsonFileAtomically } from "../backend/atomic-json-file";
import {
  cleanDeviceName,
  DEVICE_REFRESH_MS,
  decodeDevicePlain,
  decodeMcpPlain,
  decodeSkillPlain,
  devicePlain,
  emptyResourceFile,
  mcpHash,
  mcpPlain,
  newEntry,
  type ResourceEntry,
  type ResourceFile,
  type ResourceRemoval,
  resourceFileSchema,
  sha256Hex,
  skillPlain,
} from "./universal-resource-model";

export type McpSyncEvent = McpGatewayChange;

export interface McpSyncPort {
  list(): McpServerConfig[];
  save(config: McpServerConfig): Effect.Effect<McpServerConfig, unknown>;
  setEnabled(id: string, enabled: boolean): Effect.Effect<unknown, unknown>;
  onChange(listener: (event: McpSyncEvent) => void): () => void;
}

export interface SkillBundle {
  bytes: Uint8Array;
  revision: number;
  sha256: string;
}

export interface SkillMarkTarget {
  source: "marketplace" | "bundle";
  localId: string;
  slug: string;
  name: string;
}

export type SkillInstallOutcome = "installed" | "present" | "conflict";

export interface SkillSyncPort {
  agentIds(): string[];
  resolve(input: { localId: string; agentId?: string }): Effect.Effect<SkillMarkTarget, unknown>;
  bundle(localId: string): Effect.Effect<SkillBundle | null, unknown>;
  findBySlug(slug: string): Effect.Effect<{ localId: string; revision: number; sha256: string } | null, unknown>;
  importBundle(
    existing: { localId: string; revision: number } | null,
    bytes: Uint8Array,
  ): Effect.Effect<{ localId: string; revision: number; sha256: string }, unknown>;
  withdraw(localId: string): Effect.Effect<void, unknown>;
  install(
    source: "marketplace" | "bundle",
    localId: string,
    agentId: string,
    revision: number,
  ): Effect.Effect<SkillInstallOutcome, unknown>;
  uninstall(agentId: string, skillId: string): Effect.Effect<"removed" | "conflict" | "absent", unknown>;
  onChange(listener: () => void): () => void;
}

export interface ResourceTransport<E> {
  putItem(
    id: string,
    kind: "device" | "mcp" | "skill",
    plain: DynamicRecord,
    baseRevision: number,
  ): Effect.Effect<number, E>;
  removeItem(id: string, revision: number, mode: "deleted" | "unshared"): Effect.Effect<void, E>;
  uploadBlob(blobId: string, bytes: Uint8Array): Effect.Effect<void, E>;
  downloadBlob(blobId: string): Effect.Effect<Uint8Array, E>;
  deleteBlob(blobId: string): Effect.Effect<void, E>;
  classify(failure: E): "conflict" | "limit" | "notFound" | "final" | "retry";
}

export interface RemoteUpdate {
  id: string;
  kind: "device" | "mcp" | "skill";
  revision: number;
  plain: DynamicRecord | null;
  removal: "deleted" | "unshared" | null;
  failed: boolean;
}

export interface ResourceView {
  deviceId: string;
  computers: UniversalComputer[];
  resources: UniversalResource[];
  counts: Pick<Record<UniversalCountKind, number>, "mcp" | "skill" | "device">;
  conflicts: number;
  failed: number;
  pending: number;
}

export interface UniversalResourcesOptions {
  path: string;
  mcp: McpSyncPort;
  skills: SkillSyncPort;
  hostname: () => string;
  platform: string;
  now: () => number;
  newId: () => string;
}

export interface SetResourceRequest {
  kind: "mcp" | "skill";
  localId: string;
  agentId?: string;
  universal: boolean;
  targets?: UniversalTargets;
  agents?: UniversalSkillAgents;
}

export class UniversalResourceError extends Error {}

const decodeFile = Schema.decodeUnknownSync(resourceFileSchema);

type EntryPatch = Partial<Omit<ResourceEntry, "id" | "kind">>;

export class UniversalResources {
  readonly #options: UniversalResourcesOptions;
  readonly #writes = Semaphore.makeUnsafe(1);
  readonly #changed = new Set<() => void>();
  #file: ResourceFile;
  #unsubscribe: Array<() => void> = [];
  #applying = false;

  constructor(options: UniversalResourcesOptions) {
    this.#options = options;
    const host = options.hostname();
    this.#file = emptyResourceFile(options.newId().replaceAll("-", ""), cleanDeviceName(host, "Computer"));
  }

  load(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const read = yield* Effect.result(
        Effect.tryPromise({ try: () => readFile(this.#options.path, "utf8"), catch: (cause) => cause }),
      );
      if (Result.isSuccess(read)) {
        const decoded = yield* Effect.result(
          Effect.try({
            try: () => parseStoredJson(this.#options.path, read.success, decodeFile),
            catch: (cause) => cause,
          }),
        );
        if (Result.isSuccess(decoded)) this.#file = decoded.success;
      }
      yield* this.#save();
    });
  }

  start(onChange: () => void): void {
    this.#changed.add(onChange);
    this.#unsubscribe.push(this.#options.mcp.onChange((event) => this.#onMcp(event)));
    this.#unsubscribe.push(this.#options.skills.onChange(() => this.#notify()));
  }

  dispose(): void {
    for (const stop of this.#unsubscribe) stop();
    this.#unsubscribe = [];
    this.#changed.clear();
  }

  deviceId(): string {
    return this.#file.deviceId;
  }

  bind(userId: string | null): Effect.Effect<void> {
    if (this.#file.account === userId) return Effect.void;
    const fresh = emptyResourceFile(this.#file.deviceId, this.#file.deviceName);
    this.#file = { ...fresh, account: userId };
    return this.#save();
  }

  reset(): Effect.Effect<void> {
    return Effect.suspend(() => {
      this.#file = { ...emptyResourceFile(this.#file.deviceId, this.#file.deviceName), account: this.#file.account };
      return this.#save();
    });
  }

  view(): ResourceView {
    const file = this.#file;
    const now = this.#options.now();
    const others = file.devices.filter((device) => device.id !== file.deviceId);
    const computers: UniversalComputer[] = [
      { id: file.deviceId, name: file.deviceName, platform: this.#options.platform, lastSeenAt: now, current: true },
      ...others.map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        lastSeenAt: device.lastSeenAt,
        current: false,
      })),
    ];
    return {
      deviceId: file.deviceId,
      computers,
      resources: file.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        localId: entry.localId,
        name: entry.name,
        slug: entry.slug,
        targets: entry.targets,
        agents: entry.agents,
        on: universalTargetsOn(entry.targets, file.deviceId),
      })),
      counts: {
        mcp: file.entries.filter((entry) => entry.kind === "mcp").length,
        skill: file.entries.filter((entry) => entry.kind === "skill").length,
        device: computers.length,
      },
      conflicts: file.entries.filter((entry) => entry.conflict).length,
      failed: file.entries.filter((entry) => entry.failed).length,
      pending: this.#pendingCount(),
    };
  }

  #guarded<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> {
    return Effect.sync(() => {
      this.#applying = true;
    }).pipe(
      Effect.andThen(effect),
      Effect.ensuring(
        Effect.sync(() => {
          this.#applying = false;
        }),
      ),
    );
  }

  #pendingCount(): number {
    const file = this.#file;
    const due = file.deviceDirty || this.#options.now() - file.devicePublishedAt >= DEVICE_REFRESH_MS;
    return file.entries.filter((entry) => entry.dirty).length + file.removals.length + (due ? 1 : 0);
  }

  #notify(): void {
    for (const listener of this.#changed) listener();
  }

  #save(): Effect.Effect<void> {
    return this.#writes
      .withPermit(
        Effect.gen({ self: this }, function* () {
          const file = this.#file;
          yield* writeJsonFileAtomically(this.#options.path, file, { createDirectory: true });
        }),
      )
      .pipe(Effect.ignore);
  }

  #entry(id: string): ResourceEntry | undefined {
    return this.#file.entries.find((entry) => entry.id === id);
  }

  #patch(id: string, patch: EntryPatch): void {
    this.#file = {
      ...this.#file,
      entries: this.#file.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    };
  }

  #put(entry: ResourceEntry): void {
    const exists = this.#file.entries.some((current) => current.id === entry.id);
    this.#file = {
      ...this.#file,
      entries: exists
        ? this.#file.entries.map((current) => (current.id === entry.id ? entry : current))
        : [...this.#file.entries, entry],
    };
  }

  #drop(id: string): void {
    this.#file = { ...this.#file, entries: this.#file.entries.filter((entry) => entry.id !== id) };
  }

  #addRemoval(removal: ResourceRemoval): void {
    this.#file = {
      ...this.#file,
      removals: [...this.#file.removals.filter((current) => current.id !== removal.id), removal],
    };
  }

  #onMcp(event: McpSyncEvent): void {
    if (this.#applying) return;
    const mapped =
      event.type === "save"
        ? this.#file.entries.find((entry) => entry.kind === "mcp" && entry.localId === event.config.id)
        : this.#file.entries.find((entry) => entry.kind === "mcp" && entry.localId === event.id);
    if (!mapped) return;
    if (event.type === "save") {
      const changed = mcpHash(event.config) !== mapped.hash || event.config.name !== mapped.name;
      if (changed) this.#patch(mapped.id, { dirty: true, name: event.config.name });
    } else {
      this.#drop(mapped.id);
      if (mapped.revision > 0)
        this.#addRemoval({ id: mapped.id, kind: "mcp", revision: mapped.revision, mode: "deleted", blobId: null });
    }
    void Effect.runPromise(this.#save());
    this.#notify();
  }

  #mcpRow(entry: ResourceEntry): McpServerConfig | undefined {
    const rows = this.#options.mcp.list();
    const byId = entry.localId ? rows.find((row) => row.id === entry.localId) : undefined;
    if (byId) return byId;
    const mapped = new Set(
      this.#file.entries.flatMap((other) => (other.id !== entry.id && other.localId ? [other.localId] : [])),
    );
    return rows.find((row) => row.name === entry.name && !mapped.has(row.id));
  }

  applyRemote<E>(updates: readonly RemoteUpdate[], transport: ResourceTransport<E>): Effect.Effect<boolean> {
    return Effect.gen({ self: this }, function* () {
      let data = false;
      for (const update of updates) {
        if (update.failed) {
          data = true;
          continue;
        }
        const outcome = yield* Effect.result(this.#applyOne(update, transport));
        if (Result.isFailure(outcome)) data = true;
      }
      yield* this.#save();
      return data;
    });
  }

  #applyOne<E>(update: RemoteUpdate, transport: ResourceTransport<E>): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      const pending = this.#file.removals.find((removal) => removal.id === update.id);
      if (pending) {
        if (update.removal !== null)
          this.#file = { ...this.#file, removals: this.#file.removals.filter((removal) => removal.id !== update.id) };
        else
          this.#file = {
            ...this.#file,
            removals: this.#file.removals.map((removal) =>
              removal.id === update.id ? { ...removal, revision: update.revision } : removal,
            ),
          };
        return;
      }
      if (update.kind === "device") return this.#applyDevice(update);
      if (update.removal !== null) return yield* this.#applyRemoval(update.id, update.removal);
      if (!update.plain) return;
      const known = this.#entry(update.id);
      if (known && update.revision <= known.revision) return;
      if (known?.dirty) {
        this.#patch(known.id, { revision: update.revision });
        return;
      }
      if (update.kind === "mcp") return yield* this.#applyMcp(update, known);
      return yield* this.#applySkill(update, known, transport);
    });
  }

  #applyDevice(update: RemoteUpdate): void {
    const file = this.#file;
    if (update.removal !== null) {
      this.#file = { ...file, devices: file.devices.filter((device) => device.id !== update.id) };
      if (update.id === file.deviceId)
        this.#file = { ...this.#file, deviceDirty: true, deviceRevision: update.revision };
      return;
    }
    if (!update.plain) return;
    const decoded = decodeDevicePlain(update.plain);
    if (decoded.deviceId !== update.id) throw new UniversalResourceError("Invalid device item.");
    if (update.id === file.deviceId) {
      this.#file = { ...file, deviceRevision: Math.max(file.deviceRevision, update.revision) };
      return;
    }
    const record = {
      id: update.id,
      name: decoded.name,
      platform: decoded.platform,
      lastSeenAt: decoded.lastSeenAt,
      revision: update.revision,
    };
    const without = file.devices.filter((device) => device.id !== update.id);
    this.#file = { ...file, devices: [...without, record].slice(-UNIVERSAL_DEVICE_LIMIT) };
  }

  #applyRemoval(id: string, mode: "deleted" | "unshared"): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      const entry = this.#entry(id);
      if (!entry) return;
      this.#drop(id);
      if (mode === "unshared") return;
      if (entry.kind === "mcp") yield* this.#mcpOff(entry);
      else yield* this.#skillOff(entry, true);
    });
  }

  #applyMcp(update: RemoteUpdate, known: ResourceEntry | undefined): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      if (!update.plain) return;
      const decoded = decodeMcpPlain(update.plain);
      const base = known ?? newEntry(update.id, "mcp", null, decoded.fields.name);
      const entry: ResourceEntry = {
        ...base,
        name: decoded.fields.name,
        targets: decoded.targets,
        revision: update.revision,
        dirty: false,
      };
      this.#put(entry);
      if (!universalTargetsOn(entry.targets, this.#file.deviceId)) return yield* this.#mcpOff(entry);
      const local = this.#mcpRow(entry);
      const config: McpServerConfig = {
        id: local?.id ?? "",
        enabled: local ? local.enabled || entry.disabledBySync : true,
        workingDirectory: local?.workingDirectory ?? "",
        ...decoded.fields,
      };
      const expected = mcpHash(config);
      if (local && mcpHash(local) === expected && config.enabled === local.enabled) {
        this.#patch(entry.id, { localId: local.id, hash: expected, disabledBySync: false, failed: false });
        return;
      }
      const saved = yield* Effect.result(this.#guarded(this.#options.mcp.save(config)));
      if (Result.isFailure(saved)) {
        this.#patch(entry.id, { failed: true, localId: local?.id ?? null });
        return;
      }
      this.#patch(entry.id, {
        localId: saved.success.id,
        hash: mcpHash(saved.success),
        disabledBySync: false,
        failed: false,
      });
    });
  }

  #mcpOff(entry: ResourceEntry): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      const local = this.#mcpRow(entry);
      if (local?.enabled) {
        const done = yield* Effect.result(this.#guarded(this.#options.mcp.setEnabled(local.id, false)));
        this.#patch(entry.id, { disabledBySync: Result.isSuccess(done), failed: Result.isFailure(done) });
      }
      this.#patch(entry.id, { localId: null });
    });
  }

  #applySkill<E>(
    update: RemoteUpdate,
    known: ResourceEntry | undefined,
    transport: ResourceTransport<E>,
  ): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      if (!update.plain) return;
      const decoded = decodeSkillPlain(update.plain);
      const base = known ?? newEntry(update.id, "skill", null, decoded.name);
      const entry: ResourceEntry = {
        ...base,
        name: decoded.name,
        source: decoded.source,
        skillId: decoded.skillId,
        slug: decoded.slug,
        blob: decoded.blob,
        agents: decoded.agents,
        targets: decoded.targets,
        revision: update.revision,
        dirty: false,
      };
      this.#put(entry);
      yield* this.#reconcileSkill(entry, transport);
    });
  }

  #reconcileSkill<E>(entry: ResourceEntry, transport: ResourceTransport<E>): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      if (!universalTargetsOn(entry.targets, this.#file.deviceId)) return yield* this.#skillOff(entry, true);
      if (entry.origin) return;
      const skills = this.#options.skills;
      let localId = entry.source === "marketplace" ? entry.skillId : entry.localId;
      let revision = 0;
      let conflict = false;
      if (entry.source === "bundle" && entry.blob) {
        if (entry.appliedSha !== entry.blob.sha256 || !localId) {
          const downloaded = yield* Effect.result(transport.downloadBlob(entry.blob.blobId));
          if (Result.isFailure(downloaded) || sha256Hex(downloaded.success) !== entry.blob.sha256) {
            this.#patch(entry.id, { failed: true });
            return;
          }
          const library = localId ? yield* skills.bundle(localId) : null;
          if (library && entry.hash && library.sha256 !== entry.hash && library.sha256 !== entry.blob.sha256) {
            this.#patch(entry.id, { conflict: true, failed: false });
            return;
          }
          const sameSlug = localId || !entry.slug ? null : yield* skills.findBySlug(entry.slug);
          if (sameSlug && sameSlug.sha256 !== entry.blob.sha256) {
            this.#patch(entry.id, { conflict: true, failed: false });
            return;
          }
          if (sameSlug) {
            localId = sameSlug.localId;
            revision = sameSlug.revision;
            this.#patch(entry.id, { localId, hash: sameSlug.sha256, appliedSha: sameSlug.sha256 });
          } else {
            const imported = yield* Effect.result(
              skills.importBundle(
                library && localId ? { localId, revision: library.revision } : null,
                downloaded.success,
              ),
            );
            if (Result.isFailure(imported)) {
              this.#patch(entry.id, { failed: true });
              return;
            }
            localId = imported.success.localId;
            revision = imported.success.revision;
            this.#patch(entry.id, {
              localId,
              hash: imported.success.sha256,
              appliedSha: entry.blob.sha256,
              created: entry.created || library === null,
            });
          }
        } else {
          revision = (yield* skills.bundle(localId))?.revision ?? 0;
        }
      }
      if (!localId || !entry.source) return;
      const wanted = entry.agents === "all" ? skills.agentIds() : [];
      const installs = entry.installs.filter((install) => wanted.includes(install.agentId));
      for (const stale of entry.installs.filter((install) => !wanted.includes(install.agentId))) {
        const removed = yield* Effect.result(skills.uninstall(stale.agentId, stale.skillId));
        if (Result.isSuccess(removed) && removed.success === "conflict") {
          conflict = true;
          installs.push(stale);
        }
      }
      for (const agentId of wanted) {
        const outcome = yield* Effect.result(skills.install(entry.source, localId, agentId, revision));
        if (Result.isFailure(outcome) || outcome.success === "conflict") {
          conflict = true;
          continue;
        }
        if (outcome.success === "installed" && !installs.some((install) => install.agentId === agentId))
          installs.push({ agentId, skillId: localId });
      }
      this.#patch(entry.id, {
        installs,
        conflict,
        failed: false,
        ...(entry.source === "marketplace" ? { localId } : {}),
      });
    });
  }

  #skillOff(entry: ResourceEntry, withdraw: boolean): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      const skills = this.#options.skills;
      const kept: Array<{ agentId: string; skillId: string }> = [];
      let conflict = false;
      for (const install of entry.installs) {
        const removed = yield* Effect.result(skills.uninstall(install.agentId, install.skillId));
        if (Result.isSuccess(removed) && removed.success === "conflict") {
          conflict = true;
          kept.push(install);
        }
      }
      let created = entry.created;
      let localId = entry.localId;
      if (withdraw && entry.created && entry.localId && kept.length === 0) {
        const done = yield* Effect.result(skills.withdraw(entry.localId));
        if (Result.isSuccess(done)) {
          created = false;
          localId = null;
        }
      }
      this.#patch(entry.id, { installs: kept, conflict, created, localId, appliedSha: null });
    });
  }

  scan(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      for (const entry of this.#file.entries) {
        if (entry.kind !== "skill" || entry.source !== "bundle" || !entry.localId || entry.dirty) continue;
        const bundle = yield* Effect.result(this.#options.skills.bundle(entry.localId));
        if (Result.isFailure(bundle)) continue;
        if (bundle.success === null) {
          this.#drop(entry.id);
          if (entry.revision > 0)
            this.#addRemoval({
              id: entry.id,
              kind: "skill",
              revision: entry.revision,
              mode: "deleted",
              blobId: entry.blob?.blobId ?? null,
            });
          continue;
        }
        if (bundle.success.sha256 !== entry.hash && bundle.success.sha256 !== entry.blob?.sha256)
          this.#patch(entry.id, { dirty: true });
        else if (bundle.success.sha256 !== entry.hash) this.#patch(entry.id, { hash: bundle.success.sha256 });
      }
      yield* this.#save();
    });
  }

  push<E>(transport: ResourceTransport<E>): Effect.Effect<{ conflict: boolean; issue: "ok" | "limit" | "data" }, E> {
    return Effect.gen({ self: this }, function* () {
      let conflict = false;
      let issue: "ok" | "limit" | "data" = "ok";
      const handle = (failure: E): "continue" | "stop" | "fail" => {
        const kind = transport.classify(failure);
        if (kind === "conflict") conflict = true;
        else if (kind === "limit") issue = "limit";
        else if (kind === "final") issue = "data";
        else if (kind === "retry") return "fail";
        return kind === "limit" ? "stop" : "continue";
      };
      for (const blobId of [...this.#file.staleBlobs]) {
        yield* Effect.ignore(transport.deleteBlob(blobId));
        this.#file = { ...this.#file, staleBlobs: this.#file.staleBlobs.filter((id) => id !== blobId) };
      }
      for (const removal of [...this.#file.removals]) {
        const sent = yield* Effect.result(transport.removeItem(removal.id, removal.revision, removal.mode));
        const gone =
          Result.isSuccess(sent) || (Result.isFailure(sent) && transport.classify(sent.failure) === "notFound");
        if (gone) {
          this.#file = { ...this.#file, removals: this.#file.removals.filter((current) => current.id !== removal.id) };
          if (removal.blobId) yield* Effect.ignore(transport.deleteBlob(removal.blobId));
          continue;
        }
        if (Result.isFailure(sent) && handle(sent.failure) === "fail") return yield* Effect.fail(sent.failure);
      }
      const file = this.#file;
      const now = this.#options.now();
      if (file.deviceDirty || now - file.devicePublishedAt >= DEVICE_REFRESH_MS) {
        const sent = yield* Effect.result(
          transport.putItem(
            file.deviceId,
            "device",
            devicePlain(file, this.#options.platform, now),
            file.deviceRevision,
          ),
        );
        if (Result.isSuccess(sent))
          this.#file = { ...this.#file, deviceRevision: sent.success, deviceDirty: false, devicePublishedAt: now };
        else if (handle(sent.failure) === "fail") return yield* Effect.fail(sent.failure);
      }
      for (const entry of this.#file.entries.filter((current) => current.dirty)) {
        const outcome = yield* this.#pushEntry(entry, transport);
        if (outcome._tag === "Failure") {
          const next = handle(outcome.failure);
          if (next === "fail") return yield* Effect.fail(outcome.failure);
          if (next === "stop") break;
        }
      }
      yield* this.#save();
      return { conflict, issue };
    });
  }

  #pushEntry<E>(entry: ResourceEntry, transport: ResourceTransport<E>): Effect.Effect<Result.Result<void, E>> {
    return Effect.gen({ self: this }, function* () {
      if (entry.kind === "mcp") {
        const local = this.#mcpRow(entry);
        if (!local) {
          this.#dropWithRemoval(entry);
          return Result.succeed(undefined);
        }
        const sent = yield* Effect.result(
          transport.putItem(entry.id, "mcp", mcpPlain(local, entry.targets), entry.revision),
        );
        if (Result.isFailure(sent)) return Result.fail(sent.failure);
        this.#patch(entry.id, {
          revision: sent.success,
          dirty: false,
          hash: mcpHash(local),
          name: local.name,
          localId: local.id,
        });
        return Result.succeed(undefined);
      }
      let current = entry;
      let uploaded: string | null = null;
      if (entry.source === "bundle") {
        const localId = entry.localId;
        const bundle = localId ? yield* Effect.result(this.#options.skills.bundle(localId)) : null;
        if (!bundle || Result.isFailure(bundle) || bundle.success === null) {
          if (bundle && Result.isSuccess(bundle) && bundle.success === null) this.#dropWithRemoval(entry);
          return Result.succeed(undefined);
        }
        if (bundle.success.sha256 !== entry.blob?.sha256) {
          const blobId = this.#options.newId().replaceAll("-", "");
          const sent = yield* Effect.result(transport.uploadBlob(blobId, bundle.success.bytes));
          if (Result.isFailure(sent)) return Result.fail(sent.failure);
          uploaded = blobId;
          current = {
            ...entry,
            blob: { blobId, sha256: bundle.success.sha256, size: bundle.success.bytes.byteLength },
          };
        }
      }
      const sent = yield* Effect.result(transport.putItem(entry.id, "skill", skillPlain(current), entry.revision));
      if (Result.isFailure(sent)) {
        if (uploaded) yield* Effect.ignore(transport.deleteBlob(uploaded));
        return Result.fail(sent.failure);
      }
      const old = uploaded && entry.blob ? [entry.blob.blobId] : [];
      this.#file = { ...this.#file, staleBlobs: [...this.#file.staleBlobs, ...old] };
      this.#patch(entry.id, {
        revision: sent.success,
        dirty: false,
        blob: current.blob,
        hash: current.blob?.sha256 ?? null,
        appliedSha: current.blob?.sha256 ?? null,
      });
      return Result.succeed(undefined);
    });
  }

  #dropWithRemoval(entry: ResourceEntry): void {
    this.#drop(entry.id);
    if (entry.revision > 0)
      this.#addRemoval({
        id: entry.id,
        kind: entry.kind,
        revision: entry.revision,
        mode: "deleted",
        blobId: entry.blob?.blobId ?? null,
      });
  }

  setResource(request: SetResourceRequest): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      const existing = this.#file.entries.find(
        (entry) => entry.kind === request.kind && entry.localId === request.localId,
      );
      if (!request.universal) {
        if (!existing) return;
        this.#drop(existing.id);
        if (existing.revision > 0)
          this.#addRemoval({
            id: existing.id,
            kind: existing.kind,
            revision: existing.revision,
            mode: "unshared",
            blobId: existing.blob?.blobId ?? null,
          });
        yield* this.#save();
        this.#notify();
        return;
      }
      if (existing) return yield* this.#editTargets(existing.id, request.targets, request.agents);
      if (this.#file.entries.length >= 300) throw new UniversalResourceError("Too many universal items.");
      if (request.kind === "mcp") {
        const row = this.#options.mcp.list().find((candidate) => candidate.id === request.localId);
        if (!row) throw new UniversalResourceError("The server is gone.");
        this.#put({
          ...newEntry(this.#options.newId(), "mcp", row.id, row.name),
          targets: request.targets ?? { mode: "all" },
        });
      } else {
        const target = yield* this.#options.skills.resolve({
          localId: request.localId,
          ...(request.agentId ? { agentId: request.agentId } : {}),
        });
        this.#put({
          ...newEntry(this.#options.newId(), "skill", target.localId, target.name),
          source: target.source,
          skillId: target.source === "marketplace" ? target.localId : null,
          slug: target.slug,
          origin: true,
          agents: request.agents ?? "all",
          targets: request.targets ?? { mode: "all" },
        });
      }
      yield* this.#save();
      this.#notify();
    });
  }

  setTargets<E>(
    id: string,
    targets: UniversalTargets,
    agents: UniversalSkillAgents | undefined,
    transport: ResourceTransport<E> | null,
  ): Effect.Effect<void, unknown> {
    return Effect.gen({ self: this }, function* () {
      yield* this.#editTargets(id, targets, agents);
      const entry = this.#entry(id);
      if (!entry) return;
      if (entry.kind === "mcp") {
        if (universalTargetsOn(entry.targets, this.#file.deviceId)) {
          if (entry.disabledBySync || !entry.localId) {
            const row = this.#mcpRow(entry);
            if (row) {
              yield* this.#guarded(this.#options.mcp.setEnabled(row.id, true));
              this.#patch(id, { localId: row.id, disabledBySync: false });
            }
          }
        } else yield* this.#mcpOff(entry);
      } else if (transport && !entry.origin) yield* this.#reconcileSkill(entry, transport);
      else if (!universalTargetsOn(entry.targets, this.#file.deviceId)) yield* this.#skillOff(entry, true);
      yield* this.#save();
    });
  }

  #editTargets(
    id: string,
    targets: UniversalTargets | undefined,
    agents: UniversalSkillAgents | undefined,
  ): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const entry = this.#entry(id);
      if (!entry) throw new UniversalResourceError("The item is gone.");
      const known = new Set([this.#file.deviceId, ...this.#file.devices.map((device) => device.id)]);
      const next =
        targets?.mode === "only"
          ? { mode: "only" as const, deviceIds: targets.deviceIds.filter((deviceId) => known.has(deviceId)) }
          : targets;
      this.#patch(id, { dirty: true, ...(next ? { targets: next } : {}), ...(agents ? { agents } : {}) });
      yield* this.#save();
      this.#notify();
    });
  }

  renameComputer(name: string): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      this.#file = {
        ...this.#file,
        deviceName: cleanDeviceName(name, this.#file.deviceName),
        deviceDirty: true,
      };
      yield* this.#save();
      this.#notify();
    });
  }

  removeComputer(id: string): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const device = this.#file.devices.find((candidate) => candidate.id === id);
      if (!device || id === this.#file.deviceId) return;
      this.#file = { ...this.#file, devices: this.#file.devices.filter((candidate) => candidate.id !== id) };
      this.#addRemoval({ id, kind: "device", revision: device.revision, mode: "deleted", blobId: null });
      yield* this.#save();
      this.#notify();
    });
  }

  retry<E>(transport: ResourceTransport<E>): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      for (const entry of this.#file.entries) {
        if (entry.kind !== "skill" || entry.dirty || !(entry.failed || entry.conflict)) continue;
        yield* Effect.ignore(this.#reconcileSkill(entry, transport));
      }
      yield* this.#save();
    });
  }
}
