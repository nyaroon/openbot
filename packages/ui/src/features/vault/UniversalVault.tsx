import type { UniversalVaultState, UniversalVaultUnshareScope, VaultItemKind } from "@openbot/contracts/ipc";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Text,
} from "@openbot/ui";
import { createSignal, For, Show } from "solid-js";
import { useText } from "../../text";

export interface UniversalVaultProps {
  state: UniversalVaultState;
  onSetUp: (passphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
  onChangePassphrase: (current: string, next: string) => Promise<void>;
  onForget: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onRemoveVault?: (() => Promise<void>) | undefined;
  onRenameComputer?: ((name: string) => Promise<void>) | undefined;
  onRemoveComputer?: ((id: string) => Promise<void>) | undefined;
}

export interface UniversalVaultPanelProps extends UniversalVaultProps {
  onSetItem: (id: string, kind: VaultItemKind, universal: boolean, scope?: UniversalVaultUnshareScope) => Promise<void>;
}

export function UniversalVault(props: UniversalVaultProps) {
  const { t, errorMessage } = useText();
  const [passphrase, setPassphrase] = createSignal("");
  const [current, setCurrent] = createSignal("");
  const [next, setNext] = createSignal("");
  const [changing, setChanging] = createSignal(false);
  const [working, setWorking] = createSignal(false);
  const [failure, setFailure] = createSignal<string | null>(null);
  const [removing, setRemoving] = createSignal(false);
  const [draftName, setDraftName] = createSignal<string | null>(null);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setWorking(true);
    setFailure(null);
    try {
      await action();
      return true;
    } catch (error) {
      setFailure(errorMessage(error, t("vault.failed")));
      return false;
    } finally {
      setWorking(false);
    }
  }

  const status = (): string => {
    if (props.state.status === "signedOut") return t("vault.universal.signedOut");
    if (props.state.busy) return t("vault.universal.syncing");
    if (props.state.issue === "offline") return t("vault.universal.issueOffline");
    if (props.state.issue === "limit") return t("vault.universal.issueLimit");
    if (props.state.issue === "data") return t("vault.universal.issueData");
    if (props.state.status === "locked") return t("vault.universal.lockedHint");
    if (props.state.status === "notSetUp") return t("vault.universal.intro");
    if (props.state.pending > 0) return t("vault.universal.pending", { count: props.state.pending });
    return props.state.lastSyncAt === null ? t("vault.universal.neverSynced") : t("vault.universal.upToDate");
  };

  const items = () => {
    const { login, card, contact, apiKey } = props.state.counts;
    return login + card + contact + apiKey;
  };
  const lastSeen = (at: number) => t("vault.universal.lastSeen", { when: new Date(at).toLocaleDateString() });

  async function rename(): Promise<void> {
    const name = draftName()?.trim();
    const action = props.onRenameComputer;
    if (!name || !action) return;
    if (await run(() => action(name))) setDraftName(null);
  }

  async function submitPassphrase(action: (value: string) => Promise<void>): Promise<void> {
    const value = passphrase();
    if (await run(() => action(value))) setPassphrase("");
  }

  async function submitChange(): Promise<void> {
    const before = current();
    const after = next();
    if (await run(() => props.onChangePassphrase(before, after))) {
      setCurrent("");
      setNext("");
      setChanging(false);
    }
  }

  return (
    <div class="vault-universal">
      <Text as="div" variant="caption" tone="muted" class="vault-group-label">
        {t("vault.universal.title")}
      </Text>
      <ItemGroup class="settings-modal-card" surface="subtle" aria-label={t("vault.universal.title")}>
        <Item class="settings-modal-row">
          <ItemContent>
            <ItemTitle class="vault-truncate">{t("vault.universal.title")}</ItemTitle>
            <ItemDescription aria-live="polite">{status()}</ItemDescription>
          </ItemContent>
          <Show when={props.state.status === "unlocked"}>
            <ItemActions>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working() || props.state.busy}
                onClick={() => void run(props.onSyncNow)}
              >
                {t("vault.universal.syncNow")}
              </Button>
            </ItemActions>
          </Show>
        </Item>
        <Show when={props.state.status === "notSetUp" || props.state.status === "locked"}>
          <form
            class="vault-universal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPassphrase(props.state.status === "notSetUp" ? props.onSetUp : props.onUnlock);
            }}
          >
            <Field label={t("vault.universal.passphrase")}>
              <Input type="password" autocomplete="off" value={passphrase()} onValueChange={setPassphrase} />
            </Field>
            <Show when={props.state.status === "notSetUp"}>
              <Text variant="caption" tone="muted">
                {t("vault.universal.passphraseHint")}
              </Text>
            </Show>
            <div class="vault-universal-actions">
              <Button type="submit" size="sm" disabled={working() || passphrase() === ""}>
                {props.state.status === "notSetUp" ? t("vault.universal.setUp") : t("vault.universal.unlock")}
              </Button>
            </div>
          </form>
        </Show>
        <Show when={props.state.status === "unlocked"}>
          <div class="vault-universal-actions">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={working()}
              onClick={() => setChanging(!changing())}
            >
              {t("vault.universal.changePassphrase")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={working()}
              onClick={() => void run(props.onForget)}
            >
              {t("vault.universal.forget")}
            </Button>
          </div>
          <Show when={changing()}>
            <form
              class="vault-universal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitChange();
              }}
            >
              <Field label={t("vault.universal.currentPassphrase")}>
                <Input type="password" autocomplete="off" value={current()} onValueChange={setCurrent} />
              </Field>
              <Field label={t("vault.universal.newPassphrase")}>
                <Input type="password" autocomplete="off" value={next()} onValueChange={setNext} />
              </Field>
              <Text variant="caption" tone="muted">
                {t("vault.universal.passphraseHint")}
              </Text>
              <div class="vault-universal-actions">
                <Button type="button" size="sm" variant="ghost" disabled={working()} onClick={() => setChanging(false)}>
                  {t("vault.universal.dismiss")}
                </Button>
                <Button type="submit" size="sm" disabled={working() || current() === "" || next() === ""}>
                  {t("vault.universal.applyChange")}
                </Button>
              </div>
            </form>
          </Show>
          <div class="vault-universal-computers">
            <Text variant="caption" tone="muted">
              {t("vault.universal.counts", {
                items: items(),
                mcp: props.state.counts.mcp,
                skills: props.state.counts.skill,
                computers: props.state.counts.device,
              })}
            </Text>
            <Show when={props.state.failed > 0}>
              <Text variant="caption" tone="danger">
                {t("vault.universal.failed", { count: props.state.failed })}
              </Text>
            </Show>
            <Show when={props.state.conflicts > 0}>
              <Text variant="caption" tone="danger">
                {t("vault.universal.conflicts", { count: props.state.conflicts })}
              </Text>
            </Show>
            <Show when={props.state.computers.length > 0}>
              <Text variant="caption" tone="muted" class="vault-group-label">
                {t("vault.universal.computersTitle")}
              </Text>
              <Text variant="caption" tone="muted">
                {t("vault.universal.computersHint")}
              </Text>
              <For each={props.state.computers}>
                {(computer) => (
                  <div class="vault-universal-computer">
                    <Show
                      when={computer.current && props.onRenameComputer}
                      fallback={
                        <span class="vault-truncate">
                          {computer.name}
                          <Text variant="caption" tone="muted">
                            {lastSeen(computer.lastSeenAt)}
                          </Text>
                        </span>
                      }
                    >
                      <Input
                        aria-label={t("vault.universal.computerName")}
                        value={draftName() ?? computer.name}
                        onValueChange={setDraftName}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={working() || !draftName()?.trim() || draftName() === computer.name}
                        onClick={() => void rename()}
                      >
                        {t("vault.universal.renameComputer")}
                      </Button>
                    </Show>
                    <Show when={!computer.current && props.onRemoveComputer}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={working()}
                        onClick={() => void run(() => props.onRemoveComputer?.(computer.id) ?? Promise.resolve())}
                      >
                        {t("vault.universal.removeComputer")}
                      </Button>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
        <Show when={(props.state.status === "unlocked" || props.state.status === "locked") && props.onRemoveVault}>
          <div class="vault-universal-actions">
            <Button type="button" size="sm" variant="ghost" disabled={working()} onClick={() => setRemoving(true)}>
              {t("vault.universal.removeVault")}
            </Button>
          </div>
        </Show>
      </ItemGroup>
      <ConfirmDialog
        open={removing()}
        title={t("vault.universal.removeVaultTitle")}
        description={t("vault.universal.removeVaultBody")}
        confirmLabel={t("vault.universal.removeVaultConfirm")}
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          const action = props.onRemoveVault;
          if (action && (await run(action))) setRemoving(false);
        }}
      />
      <Show when={failure()}>
        {(message) => (
          <Text tone="danger" variant="caption" role="alert">
            {message()}
          </Text>
        )}
      </Show>
    </div>
  );
}

export interface UniversalUnshareDialogProps {
  open: boolean;
  onChoose: (scope: UniversalVaultUnshareScope) => void;
  onCancel: () => void;
}

export function UniversalUnshareDialog(props: UniversalUnshareDialogProps) {
  const { t } = useText();
  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay class="ui-confirm-dialog-overlay">
          <Dialog.Content as="section" class="ui-confirm-dialog vault-dialog">
            <div class="vault-dialog-body">
              <Dialog.Title as="h2" class="vault-dialog-title">
                {t("vault.universal.unshareTitle")}
              </Dialog.Title>
              <Text tone="muted">{t("vault.universal.unshareBody")}</Text>
              <Button
                type="button"
                variant="outline"
                class="vault-universal-choice"
                onClick={() => props.onChoose("all-devices")}
              >
                <span>{t("vault.universal.unshareEverywhere")}</span>
                <Text variant="caption" tone="muted">
                  {t("vault.universal.unshareEverywhereHint")}
                </Text>
              </Button>
              <Button
                type="button"
                variant="outline"
                class="vault-universal-choice"
                onClick={() => props.onChoose("this-device")}
              >
                <span>{t("vault.universal.unshareHere")}</span>
                <Text variant="caption" tone="muted">
                  {t("vault.universal.unshareHereHint")}
                </Text>
              </Button>
            </div>
            <footer class="ui-confirm-dialog-actions">
              <Button type="button" variant="ghost" onClick={props.onCancel}>
                {t("common.cancel")}
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
