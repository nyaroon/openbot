import { EMPTY_UNIVERSAL_VAULT, type OpenBotDesktopApi, type UniversalVaultState } from "@openbot/contracts/ipc";

export function createMockUniversalVault(): OpenBotDesktopApi["universalVault"] {
  let state: UniversalVaultState = { ...EMPTY_UNIVERSAL_VAULT, status: "notSetUp" };
  const listeners = new Set<(state: UniversalVaultState) => void>();
  const change = (patch: Partial<UniversalVaultState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
    return state;
  };
  return {
    status: async () => state,
    setUp: async () => change({ status: "unlocked", lastSyncAt: Date.now() }),
    unlock: async () => change({ status: "unlocked", lastSyncAt: Date.now() }),
    changePassphrase: async () => state,
    forgetOnThisDevice: async () => change({ status: "locked" }),
    syncNow: async () => change({ lastSyncAt: Date.now() }),
    setUniversal: async () => state,
    removeUniversalVault: async () => change({ status: "notSetUp", lastSyncAt: null }),
    onChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
