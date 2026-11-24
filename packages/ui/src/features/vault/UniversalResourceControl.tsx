import type {
  UniversalResource,
  UniversalResourceKind,
  UniversalSkillAgents,
  UniversalTargets,
  UniversalVaultState,
} from "@openbot/contracts/ipc";
import { Checkbox, Text } from "@openbot/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { useText } from "../../text";

export interface UniversalResourceControlProps {
  vault: UniversalVaultState;
  kind: UniversalResourceKind;
  localId: string;
  slug?: string | undefined;
  onSet: (universal: boolean) => Promise<void>;
  onTargets: (id: string, targets: UniversalTargets, agents?: UniversalSkillAgents) => Promise<void>;
}

export function findUniversalResource(
  vault: UniversalVaultState,
  kind: UniversalResourceKind,
  localId: string,
  slug?: string,
): UniversalResource | undefined {
  return vault.resources.find(
    (resource) =>
      resource.kind === kind &&
      (resource.localId === localId || (kind === "skill" && slug !== undefined && resource.slug === slug)),
  );
}

export function UniversalResourceControl(props: UniversalResourceControlProps) {
  const { t, errorMessage } = useText();
  const uid = createUniqueId();
  const [working, setWorking] = createSignal(false);
  const [failure, setFailure] = createSignal<string | null>(null);
  const ready = () => props.vault.status === "unlocked";
  const resource = () => findUniversalResource(props.vault, props.kind, props.localId, props.slug);

  async function run(action: () => Promise<void>): Promise<void> {
    setWorking(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(errorMessage(error, t("vault.failed")));
    } finally {
      setWorking(false);
    }
  }

  const selected = (current: UniversalResource, id: string): boolean =>
    current.targets.mode === "all" || current.targets.deviceIds.includes(id);

  function toggleComputer(current: UniversalResource, id: string, on: boolean): void {
    const ids = props.vault.computers.map((computer) => computer.id);
    const base = current.targets.mode === "all" ? ids : current.targets.deviceIds;
    const next = on ? [...new Set([...base, id])] : base.filter((candidate) => candidate !== id);
    const targets: UniversalTargets = ids.every((candidate) => next.includes(candidate))
      ? { mode: "all" }
      : { mode: "only", deviceIds: next };
    void run(() => props.onTargets(current.id, targets));
  }

  function toggleAll(current: UniversalResource, on: boolean): void {
    const targets: UniversalTargets = on ? { mode: "all" } : { mode: "only", deviceIds: [props.vault.deviceId] };
    void run(() => props.onTargets(current.id, targets));
  }

  return (
    <div class="universal-resource">
      <label class="vault-universal-toggle" for={`${uid}-on`}>
        <Checkbox
          id={`${uid}-on`}
          checked={resource() !== undefined}
          disabled={!ready() || working()}
          onChange={(event) => void run(() => props.onSet(event.currentTarget.checked))}
        />
        <span>
          {t("vault.universal.toggle")}
          <Text variant="caption" tone="muted">
            {ready() ? t("vault.universal.toggleHint") : t("vault.universal.needsSetup")}
          </Text>
        </span>
      </label>
      <Show when={resource()}>
        {(current) => (
          <fieldset class="universal-resource-options">
            <legend>
              <Text variant="caption" tone="muted">
                {t("vault.universal.computers")}
              </Text>
            </legend>
            <label class="vault-universal-toggle" for={`${uid}-all`}>
              <Checkbox
                id={`${uid}-all`}
                checked={current().targets.mode === "all"}
                disabled={!ready() || working()}
                onChange={(event) => toggleAll(current(), event.currentTarget.checked)}
              />
              <span>{t("vault.universal.allComputers")}</span>
            </label>
            <For each={props.vault.computers}>
              {(computer) => (
                <label class="vault-universal-toggle" for={`${uid}-${computer.id}`}>
                  <Checkbox
                    id={`${uid}-${computer.id}`}
                    checked={selected(current(), computer.id)}
                    disabled={!ready() || working() || current().targets.mode === "all"}
                    onChange={(event) => toggleComputer(current(), computer.id, event.currentTarget.checked)}
                  />
                  <span>
                    {computer.name}
                    <Show when={computer.current}>
                      <Text variant="caption" tone="muted">
                        {t("vault.universal.thisComputer")}
                      </Text>
                    </Show>
                  </span>
                </label>
              )}
            </For>
            <Show when={props.kind === "skill"}>
              <label class="vault-universal-toggle" for={`${uid}-agents`}>
                <Checkbox
                  id={`${uid}-agents`}
                  checked={current().agents === "all"}
                  disabled={!ready() || working()}
                  onChange={(event) =>
                    void run(() =>
                      props.onTargets(current().id, current().targets, event.currentTarget.checked ? "all" : "none"),
                    )
                  }
                />
                <span>{t("vault.universal.skillAgents")}</span>
              </label>
            </Show>
          </fieldset>
        )}
      </Show>
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
