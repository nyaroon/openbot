import { type VaultAgentChoice, VaultPanel } from "@openbot/ui/features/vault/VaultPanel";
import { useText } from "@openbot/ui/text";
import { createEffect, createSignal, onSettled, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import type { LinkAccountStore } from "./stores/link-account-store";
import type { UniversalVaultStore } from "./stores/universal-vault-store";
import type { VaultStore } from "./stores/vault-store";

export interface ServerVaultOptions {
  store: VaultStore;
  apiKeys: boolean;
  twoStep: boolean;
  link?: LinkAccountStore | undefined;
  universal?: UniversalVaultStore | undefined;
  listAgents?: (() => Promise<readonly VaultAgentChoice[]>) | undefined;
}

export function ServerVaultPanel(props: ServerVaultOptions & { menuMount: HTMLElement | undefined }) {
  const { t, errorMessage } = useText();
  const [agents, setAgents] = createSignal<readonly VaultAgentChoice[]>([]);
  let request = 0;
  createEffect(
    () => props.listAgents,
    (listAgents) => {
      const current = ++request;
      setAgents([]);
      listAgents?.().then(
        (list) => {
          if (current === request) setAgents(list);
        },
        () => undefined,
      );
    },
  );
  onSettled(() => {
    const store = props.store;
    const unsubscribe = store.subscribe();
    store.refresh().catch((error: unknown) => actionToast.error(errorMessage(error, t("vault.loadFailed"))));
    const link = props.link;
    const stopLink = link?.subscribe();
    link?.refresh().catch((error: unknown) => actionToast.error(errorMessage(error, t("vault.link.failed"))));
    const universal = props.universal;
    const stopUniversal = universal?.subscribe();
    universal?.refresh().catch((error: unknown) => actionToast.error(errorMessage(error, t("vault.loadFailed"))));
    return () => {
      unsubscribe();
      stopLink?.();
      stopUniversal?.();
    };
  });
  const linkAccount = () => {
    const link = props.link;
    if (!link) return undefined;
    return {
      status: link.state.status,
      onConnect: link.connect,
      onCancel: link.cancel,
      onDisconnect: link.disconnect,
    };
  };
  const universalVault = () => {
    const universal = props.universal;
    if (!universal) return undefined;
    return {
      state: universal.state.vault,
      onSetUp: universal.setUp,
      onUnlock: universal.unlock,
      onChangePassphrase: universal.changePassphrase,
      onForget: universal.forget,
      onSyncNow: universal.syncNow,
      onRemoveVault: universal.removeVault,
      onRenameComputer: universal.renameComputer,
      onRemoveComputer: universal.removeComputer,
      onSetItem: universal.setItem,
    };
  };
  const onCodes = () => (props.twoStep ? props.store.codes : undefined);
  return (
    <Show when={props.store.state.vault}>
      {(vault) => (
        <VaultPanel
          state={vault()}
          apiKeys={props.apiKeys}
          agents={agents()}
          onCodes={onCodes()}
          onSave={props.store.save}
          onDelete={props.store.remove}
          onReveal={props.store.reveal}
          onCopy={async (request) => {
            await props.store.copy(request);
            actionToast.success(t("vault.copied"));
          }}
          onCopyText={async (value) => {
            await navigator.clipboard.writeText(value);
            actionToast.success(t("vault.copied"));
          }}
          onImportCsv={props.store.importCsv}
          onReset={props.store.reset}
          menuMount={props.menuMount}
          link={linkAccount()}
          universal={universalVault()}
        />
      )}
    </Show>
  );
}
