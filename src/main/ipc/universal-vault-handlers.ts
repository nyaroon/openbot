import {
  decodeUniversalTargets,
  UNIVERSAL_DEVICE_NAME_MAX,
  UNIVERSAL_RESOURCE_KINDS,
  UNIVERSAL_SKILL_AGENTS,
  type UniversalVaultChangePassphraseInput,
  type UniversalVaultRemoveComputerInput,
  type UniversalVaultRenameComputerInput,
  type UniversalVaultSetItemInput,
  type UniversalVaultSetResourceInput,
  type UniversalVaultSetTargetsInput,
  type UniversalVaultSetUpInput,
  type VaultItemKind,
} from "@openbot/contracts/ipc";
import { runCauseEffect } from "../../backend/effect-boundary";
import { UNIVERSAL_PASSPHRASE_MAX } from "../universal-vault-crypto";
import type { UniversalVaultService } from "../universal-vault-service";
import { handler, type IpcGroupHandlers, payloadHandler } from "./define-ipc-group";
import { isObject, requireString } from "./validation";

export interface UniversalVaultIpcDependencies {
  universalVault: UniversalVaultService;
}

const KINDS: readonly VaultItemKind[] = ["login", "card", "contact", "apiKey"];

function passphrase(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > UNIVERSAL_PASSPHRASE_MAX) throw new Error(`Invalid ${field}.`);
  return value;
}

function decodePassphraseInput(value: unknown): UniversalVaultSetUpInput {
  if (!isObject(value)) throw new Error("Invalid passphrase request.");
  return { passphrase: passphrase(value.passphrase, "passphrase") };
}

function decodeChangeInput(value: unknown): UniversalVaultChangePassphraseInput {
  if (!isObject(value)) throw new Error("Invalid passphrase request.");
  return { current: passphrase(value.current, "passphrase"), next: passphrase(value.next, "passphrase") };
}

function decodeSetItemInput(value: unknown): UniversalVaultSetItemInput {
  if (!isObject(value)) throw new Error("Invalid Universal vault request.");
  const kind = KINDS.find((candidate) => candidate === value.kind);
  if (!kind || typeof value.universal !== "boolean") throw new Error("Invalid Universal vault request.");
  const scope = value.scope === "this-device" ? "this-device" : "all-devices";
  return { id: requireString(value.id, "id", 64), kind, universal: value.universal, scope };
}

function decodeSkillAgents(value: unknown) {
  if (value === undefined) return undefined;
  const agents = UNIVERSAL_SKILL_AGENTS.find((candidate) => candidate === value);
  if (!agents) throw new Error("Invalid Universal vault request.");
  return agents;
}

function decodeSetResourceInput(value: unknown): UniversalVaultSetResourceInput {
  if (!isObject(value)) throw new Error("Invalid Universal vault request.");
  const kind = UNIVERSAL_RESOURCE_KINDS.find((candidate) => candidate === value.kind);
  if (!kind || typeof value.universal !== "boolean") throw new Error("Invalid Universal vault request.");
  const agents = decodeSkillAgents(value.agents);
  return {
    kind,
    localId: requireString(value.localId, "localId", 256),
    universal: value.universal,
    ...(value.agentId === undefined ? {} : { agentId: requireString(value.agentId, "agentId", 64) }),
    ...(value.targets === undefined ? {} : { targets: decodeUniversalTargets(value.targets) }),
    ...(agents ? { agents } : {}),
  };
}

function decodeSetTargetsInput(value: unknown): UniversalVaultSetTargetsInput {
  if (!isObject(value)) throw new Error("Invalid Universal vault request.");
  const agents = decodeSkillAgents(value.agents);
  return {
    id: requireString(value.id, "id", 64),
    targets: decodeUniversalTargets(value.targets),
    ...(agents ? { agents } : {}),
  };
}

function decodeRenameInput(value: unknown): UniversalVaultRenameComputerInput {
  if (!isObject(value)) throw new Error("Invalid Universal vault request.");
  return { name: requireString(value.name, "name", UNIVERSAL_DEVICE_NAME_MAX) };
}

function decodeRemoveComputerInput(value: unknown): UniversalVaultRemoveComputerInput {
  if (!isObject(value)) throw new Error("Invalid Universal vault request.");
  return { id: requireString(value.id, "id", 64) };
}

export function universalVaultIpcHandlers({
  universalVault,
}: UniversalVaultIpcDependencies): Pick<IpcGroupHandlers, "universalVault"> {
  return {
    universalVault: {
      status: handler(() => universalVault.state()),
      setUp: payloadHandler(decodePassphraseInput, ({ passphrase: value }) =>
        runCauseEffect(universalVault.setUp(value)),
      ),
      unlock: payloadHandler(decodePassphraseInput, ({ passphrase: value }) =>
        runCauseEffect(universalVault.unlock(value)),
      ),
      changePassphrase: payloadHandler(decodeChangeInput, ({ current, next }) =>
        runCauseEffect(universalVault.changePassphrase(current, next)),
      ),
      forgetOnThisDevice: handler(() => runCauseEffect(universalVault.forgetOnThisDevice())),
      syncNow: handler(() => runCauseEffect(universalVault.syncNow())),
      setUniversal: payloadHandler(decodeSetItemInput, ({ id, kind, universal, scope }) =>
        runCauseEffect(universalVault.setUniversal(id, kind, universal, scope ?? "all-devices")),
      ),
      setResource: payloadHandler(decodeSetResourceInput, (input) => runCauseEffect(universalVault.setResource(input))),
      setTargets: payloadHandler(decodeSetTargetsInput, (input) => runCauseEffect(universalVault.setTargets(input))),
      renameComputer: payloadHandler(decodeRenameInput, ({ name }) =>
        runCauseEffect(universalVault.renameComputer(name)),
      ),
      removeComputer: payloadHandler(decodeRemoveComputerInput, ({ id }) =>
        runCauseEffect(universalVault.removeComputer(id)),
      ),
      removeUniversalVault: handler(() => runCauseEffect(universalVault.removeUniversalVault())),
    },
  };
}
