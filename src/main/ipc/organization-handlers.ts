import {
  ORGANIZATION_NAME_MAX,
  type OrganizationAddMemberInput,
  type OrganizationArtifactTarget,
  type OrganizationCreateInput,
  type OrganizationRemoveMemberInput,
  type OrganizationRenameInput,
  type OrganizationServerTarget,
  type OrganizationSetRoleInput,
  type OrganizationTarget,
  type OrganizationVaultAddInput,
  type OrganizationVaultRemoveInput,
  type OrganizationVaultShareInput,
  type VaultItemKind,
} from "@openbot/contracts/ipc";
import type { DynamicRecord } from "@openbot/contracts/runtime-values";
import { Effect } from "effect";
import type { ArtifactOperations, ArtifactRefusal } from "../../backend/agent/artifact-tool";
import { runCauseEffect } from "../../backend/effect-boundary";
import type { OrganizationService } from "../organization-service";
import { handler, type IpcGroupHandlers, payloadHandler } from "./define-ipc-group";
import { isObject, requireString } from "./validation";

export interface OrganizationIpcDependencies {
  organizations: OrganizationService;
  artifacts: ArtifactOperations;
  /** Opens a link in the browser of the computer. */
  openExternal: (url: string) => Promise<void>;
}

const KINDS: readonly VaultItemKind[] = ["login", "card", "contact", "apiKey"];
const PHONE_MAX = 32;

function request(value: unknown): DynamicRecord {
  if (!isObject(value)) throw new Error("Invalid organization request.");
  return value;
}

function organizationId(value: DynamicRecord): string {
  return requireString(value.organizationId, "organizationId", 64);
}

function decodeTarget(value: unknown): OrganizationTarget {
  return { organizationId: organizationId(request(value)) };
}

function decodeServerTarget(value: unknown): OrganizationServerTarget {
  const input = request(value);
  return { organizationId: organizationId(input), hostId: requireString(input.hostId, "hostId", 64) };
}

function decodeCreate(value: unknown): OrganizationCreateInput {
  const input = request(value);
  return {
    name: requireString(input.name, "name", ORGANIZATION_NAME_MAX),
    ownerNumber: requireString(input.ownerNumber, "ownerNumber", PHONE_MAX),
  };
}

function decodeRename(value: unknown): OrganizationRenameInput {
  const input = request(value);
  return { organizationId: organizationId(input), name: requireString(input.name, "name", ORGANIZATION_NAME_MAX) };
}

function decodeAddMember(value: unknown): OrganizationAddMemberInput {
  const input = request(value);
  if (input.role !== "admin" && input.role !== "member") throw new Error("Invalid organization role.");
  return {
    organizationId: organizationId(input),
    number: requireString(input.number, "number", PHONE_MAX),
    role: input.role,
  };
}

function decodeSetRole(value: unknown): OrganizationSetRoleInput {
  const input = request(value);
  if (input.role !== "owner" && input.role !== "admin" && input.role !== "member")
    throw new Error("Invalid organization role.");
  return { organizationId: organizationId(input), userId: requireString(input.userId, "userId", 64), role: input.role };
}

function decodeRemoveMember(value: unknown): OrganizationRemoveMemberInput {
  const input = request(value);
  return { organizationId: organizationId(input), userId: requireString(input.userId, "userId", 64) };
}

function decodeVaultAdd(value: unknown): OrganizationVaultAddInput {
  const input = request(value);
  const kind = KINDS.find((candidate) => candidate === input.kind);
  if (!kind) throw new Error("Invalid vault item kind.");
  return { organizationId: organizationId(input), itemId: requireString(input.itemId, "itemId", 64), kind };
}

function decodeVaultShare(value: unknown): OrganizationVaultShareInput {
  const input = request(value);
  if (typeof input.shared !== "boolean") throw new Error("Invalid share request.");
  return {
    organizationId: organizationId(input),
    itemId: requireString(input.itemId, "itemId", 64),
    shared: input.shared,
  };
}

function decodeVaultRemove(value: unknown): OrganizationVaultRemoveInput {
  const input = request(value);
  return { organizationId: organizationId(input), itemId: requireString(input.itemId, "itemId", 64) };
}

/** A refusal carries the sentence that the user reads. */
function runArtifacts<T>(effect: Effect.Effect<T, ArtifactRefusal>): Promise<T> {
  return runCauseEffect(effect.pipe(Effect.mapError((cause) => ({ cause }))));
}

function decodeArtifactTarget(value: unknown): OrganizationArtifactTarget {
  const artifactId = requireString(request(value).artifactId, "artifactId", 22);
  if (!/^[A-Za-z0-9_-]{22}$/u.test(artifactId)) throw new Error("Invalid artifact id.");
  return { artifactId };
}

export function organizationIpcHandlers({
  organizations,
  artifacts,
  openExternal,
}: OrganizationIpcDependencies): Pick<IpcGroupHandlers, "organizations"> {
  return {
    organizations: {
      status: handler(() => organizations.state()),
      refresh: handler(() => runCauseEffect(organizations.refresh())),
      create: payloadHandler(decodeCreate, (input) => runCauseEffect(organizations.create(input))),
      rename: payloadHandler(decodeRename, (input) => runCauseEffect(organizations.rename(input))),
      remove: payloadHandler(decodeTarget, (input) => runCauseEffect(organizations.remove(input.organizationId))),
      leave: payloadHandler(decodeTarget, (input) => runCauseEffect(organizations.leave(input.organizationId))),
      members: payloadHandler(decodeTarget, (input) => runCauseEffect(organizations.members(input.organizationId))),
      addMember: payloadHandler(decodeAddMember, (input) => runCauseEffect(organizations.addMember(input))),
      setMemberRole: payloadHandler(decodeSetRole, (input) => runCauseEffect(organizations.setMemberRole(input))),
      removeMember: payloadHandler(decodeRemoveMember, (input) => runCauseEffect(organizations.removeMember(input))),
      servers: payloadHandler(decodeTarget, (input) => runCauseEffect(organizations.servers(input.organizationId))),
      bindServer: payloadHandler(decodeServerTarget, (input) => runCauseEffect(organizations.bindServer(input))),
      unbindServer: payloadHandler(decodeServerTarget, (input) => runCauseEffect(organizations.unbindServer(input))),
      joinServer: payloadHandler(decodeServerTarget, (input) => runCauseEffect(organizations.joinServer(input))),
      vault: payloadHandler(decodeTarget, (input) => runCauseEffect(organizations.vault(input.organizationId))),
      addVaultItem: payloadHandler(decodeVaultAdd, (input) => runCauseEffect(organizations.addVaultItem(input))),
      shareVaultItem: payloadHandler(decodeVaultShare, (input) => runCauseEffect(organizations.shareVaultItem(input))),
      artifacts: handler(() => runArtifacts(artifacts.list())),
      removeArtifact: payloadHandler(decodeArtifactTarget, (input) =>
        runArtifacts(artifacts.remove(input.artifactId).pipe(Effect.andThen(artifacts.list()))),
      ),
      openArtifact: payloadHandler(decodeArtifactTarget, async (input) => {
        const found = (await runArtifacts(artifacts.list())).find((artifact) => artifact.id === input.artifactId);
        if (!found?.url.startsWith("https://")) throw new Error("The artifact was not found.");
        await openExternal(found.url);
      }),
      removeVaultItem: payloadHandler(decodeVaultRemove, (input) =>
        runCauseEffect(organizations.removeVaultItem(input)),
      ),
    },
  };
}
