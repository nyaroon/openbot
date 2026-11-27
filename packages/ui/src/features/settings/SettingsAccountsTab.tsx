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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSection,
  Text,
} from "@openbot/ui";
import { For, Show } from "solid-js";
import { useText } from "../../text";
import { NEW_ORGANIZATION, type SettingsAccountsStore } from "./stores/accounts-store";

interface SettingsAccountsTabProps {
  store: SettingsAccountsStore;
  canList: boolean;
  canCreate: boolean;
}

interface Choice {
  id: string;
  label: string;
}

const ACCOUNT_DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" };
const MEMBER_ROLES = ["member", "admin"] as const;
const ROLE_TEXT = {
  owner: "organization.role.owner",
  admin: "organization.role.admin",
  member: "organization.role.member",
} as const;

function ChoiceSelect(props: {
  label: string;
  options: Choice[];
  value: string | null;
  placeholder?: string;
  onChange: (id: string) => void;
}) {
  const selected = () => props.options.find((option) => option.id === props.value) ?? null;
  return (
    <Select<Choice>
      placeholder={props.placeholder}
      options={props.options}
      value={selected()}
      optionValue="id"
      optionTextValue="label"
      onChange={(option) => {
        if (option) props.onChange(option.id);
      }}
      itemComponent={(item) => <SelectItem item={item.item}>{item.item.rawValue.label}</SelectItem>}
    >
      <SelectTrigger size="sm" aria-label={props.label}>
        <SelectValue<Choice>>{(state) => state.selectedOption()?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
}

/**
 * The platform owner's page: every organization and account, how many are connected, and one form
 * that puts a new person into an organization or starts a new organization with them as its owner.
 */
export function SettingsAccountsTab(props: SettingsAccountsTabProps) {
  const { t, format } = useText();
  const organizationChoices = (): Choice[] => [
    ...props.store.organizations().map((item) => ({ id: item.id, label: item.name })),
    { id: NEW_ORGANIZATION, label: t("organization.new") },
  ];
  const roleChoices = (): Choice[] => MEMBER_ROLES.map((role) => ({ id: role, label: t(ROLE_TEXT[role]) }));
  return (
    <>
      <Show when={props.canList}>
        <SettingsSection
          data-settings-row="organization.title"
          title={t("organization.title")}
          description={t("settings.accounts.overview.summary", props.store.totals())}
        >
          <Show
            when={props.store.organizations().length > 0}
            fallback={
              <Show when={!props.store.state.loading && !props.store.state.loadError}>
                <Text>{t("settings.accounts.organizations.empty")}</Text>
              </Show>
            }
          >
            <ItemGroup class="settings-modal-card">
              <For each={props.store.organizations()}>
                {(organization) => (
                  <Item>
                    <ItemContent>
                      <ItemTitle>{organization.name}</ItemTitle>
                      <ItemDescription>
                        {t("settings.accounts.organizations.details", {
                          members: organization.members,
                          connected: organization.connected,
                        })}
                      </ItemDescription>
                    </ItemContent>
                    <Button variant="outline" size="sm" onClick={() => props.store.updateOrganization(organization.id)}>
                      {t("settings.accounts.create.action")}
                    </Button>
                  </Item>
                )}
              </For>
            </ItemGroup>
          </Show>
        </SettingsSection>
      </Show>
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
              label={t("settings.accounts.organization.label")}
              description={t("settings.accounts.organization.description")}
              error={props.store.organizationError() ?? undefined}
            >
              <ChoiceSelect
                label={t("settings.accounts.organization.label")}
                placeholder={t("settings.accounts.organization.label")}
                options={organizationChoices()}
                value={props.store.organization()}
                onChange={props.store.updateOrganization}
              />
            </Field>
            <Show
              when={props.store.startsOrganization()}
              fallback={
                <Show when={props.store.organization()}>
                  <Field label={t("settings.accounts.role.label")}>
                    <ChoiceSelect
                      label={t("settings.accounts.role.label")}
                      options={roleChoices()}
                      value={props.store.role()}
                      onChange={(role) => props.store.updateRole(role === "admin" ? "admin" : "member")}
                    />
                  </Field>
                </Show>
              }
            >
              <Field label={t("organization.nameLabel")}>
                <Input
                  autocomplete="off"
                  maxlength={80}
                  value={props.store.organizationName()}
                  onValueChange={props.store.updateOrganizationName}
                />
              </Field>
            </Show>
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
                      <ItemDescription>
                        {t("settings.accounts.list.connection", {
                          organizations:
                            account.organizations.length > 0
                              ? account.organizations
                                  .map((entry) => `${entry.name} (${t(ROLE_TEXT[entry.role])})`)
                                  .join(", ")
                              : t("settings.accounts.list.noOrganization"),
                          sessions: account.sessionCount,
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
