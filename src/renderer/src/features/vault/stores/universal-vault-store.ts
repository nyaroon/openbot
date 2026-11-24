import {
  EMPTY_UNIVERSAL_VAULT,
  type UniversalVaultDesktopApi,
  type UniversalVaultState,
  type UniversalVaultUnshareScope,
  type VaultItemKind,
} from "@openbot/contracts/ipc";
import { createStore } from "solid-js";

export function createUniversalVaultStore(api: () => UniversalVaultDesktopApi = () => window.openbot.universalVault) {
  const [state, setState] = createStore<{ vault: UniversalVaultState }>({ vault: { ...EMPTY_UNIVERSAL_VAULT } });
  let request = 0;

  const show = (next: UniversalVaultState) => {
    request++;
    setState((draft) => {
      draft.vault = next;
    });
  };

  return {
    state,
    refresh: async () => {
      const current = ++request;
      const next = await api().status();
      if (current === request)
        setState((draft) => {
          draft.vault = next;
        });
    },
    subscribe: () => api().onChanged(show),
    setUp: async (passphrase: string) => show(await api().setUp({ passphrase })),
    unlock: async (passphrase: string) => show(await api().unlock({ passphrase })),
    changePassphrase: async (current: string, next: string) => show(await api().changePassphrase({ current, next })),
    forget: async () => show(await api().forgetOnThisDevice()),
    syncNow: async () => show(await api().syncNow()),
    setItem: async (id: string, kind: VaultItemKind, universal: boolean, scope?: UniversalVaultUnshareScope) =>
      show(await api().setUniversal({ id, kind, universal, ...(scope === undefined ? {} : { scope }) })),
  };
}

export type UniversalVaultStore = ReturnType<typeof createUniversalVaultStore>;
