import type {
  UniversalVaultChangePassphraseInput,
  UniversalVaultSetItemInput,
  UniversalVaultSetUpInput,
  VaultItemKind,
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
      removeUniversalVault: handler(() => runCauseEffect(universalVault.removeUniversalVault())),
    },
  };
}
