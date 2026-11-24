import { formatAccountIdentity } from "@openbot/contracts/phone-identity";
import {
  Button,
  ErrorReference,
  Field,
  Input,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  SettingsSection,
  Text,
} from "@openbot/ui";
import { For, Show } from "solid-js";
import { useText } from "../../text";
import type { SettingsAccountsStore } from "./stores/accounts-store";

interface SettingsAccountsTabProps {
  store: SettingsAccountsStore;
  canList: boolean;
  canCreate: boolean;
}

const ACCOUNT_DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" };

export function SettingsAccountsTab(props: SettingsAccountsTabProps) {
  const { t, format } = useText();
  return (
    <>
      <Show when={props.canCreate}>
        <SettingsSection
          data-settings-row="settings.accounts.create.title"
          title={t("settings.accounts.create.title")}
          description={t("settings.accounts.create.description")}
        >
          <form
            novalidate
            onSubmit={(event) => {
              event.preventDefault();
              void props.store.create();
            }}
          >
            <Field
              label={t("settings.accounts.phone.label")}
              description={t("settings.accounts.phone.description")}
              error={props.store.visiblePhoneError() ?? undefined}
            >
              <Input
                type="tel"
                autocomplete="off"
                value={props.store.phone()}
                onValueChange={props.store.updatePhone}
                onBlur={props.store.markPhoneTouched}
              />
            </Field>
            <Field
              label={t("settings.accounts.name.label")}
              description={t("settings.accounts.name.description")}
              error={props.store.nameError() ?? undefined}
            >
              <Input autocomplete="off" value={props.store.name()} onValueChange={props.store.updateName} />
            </Field>
            <Button type="submit" disabled={props.store.state.creating}>
              {props.store.state.creating
                ? t("settings.accounts.create.pending")
                : t("settings.accounts.create.action")}
            </Button>
          </form>
          <Show when={props.store.state.createError}>
            {(error) => (
              <Text role="alert" class="settings-modal-error">
                {error().message}
                <ErrorReference reference={error().reference} />
              </Text>
            )}
          </Show>
          <Show when={props.store.state.createdPhone}>
            {(created) => <Text role="status">{t("settings.accounts.create.success", { phone: created() })}</Text>}
          </Show>
        </SettingsSection>
      </Show>
      <Show when={props.canList}>
        <SettingsSection
          data-settings-row="settings.accounts.list.title"
          title={t("settings.accounts.list.title")}
          description={t("settings.accounts.list.description")}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={props.store.state.loading}
            onClick={() => void props.store.refresh()}
          >
            {props.store.state.loading ? t("common.loading") : t("settings.accounts.list.refresh")}
          </Button>
          <Show when={props.store.state.loadError}>
            {(error) => (
              <Text role="alert" class="settings-modal-error">
                {error().message}
                <ErrorReference reference={error().reference} />
              </Text>
            )}
          </Show>
          <Show
            when={props.store.state.items.length > 0}
            fallback={
              <Show when={!props.store.state.loading && !props.store.state.loadError}>
                <Text>{t("settings.accounts.list.empty")}</Text>
              </Show>
            }
          >
            <ItemGroup class="settings-modal-card">
              <For each={props.store.state.items}>
                {(account) => (
                  <Item>
                    <ItemContent>
                      <ItemTitle>{formatAccountIdentity(account.email)}</ItemTitle>
                      <ItemDescription>
                        {t("settings.accounts.list.details", {
                          name: account.name ?? t("settings.accounts.list.noName"),
                          created: format.date(account.createdAt, ACCOUNT_DATE_FORMAT),
                        })}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                )}
              </For>
            </ItemGroup>
          </Show>
        </SettingsSection>
      </Show>
    </>
  );
}
