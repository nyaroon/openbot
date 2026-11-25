import type { OrganizationMember, OrganizationRole, OrganizationSummary } from "@openbot/contracts/ipc";
import type { AppTextKey } from "@openbot/i18n";
import {
  Alert,
  AlertDescription,
  ArrowLeft,
  Badge,
  Button,
  ConfirmDialog,
  ErrorReference,
  Field,
  IconButton,
  Input,
  Item,
  ItemActions,
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
  Switch,
  Text,
  Trash2,
} from "@openbot/ui";
import { createSignal, For, Show } from "solid-js";
import { useText } from "../../text";
import type { OrganizationsStore } from "./stores/organizations-store";

interface OrganizationsTabProps {
  store: OrganizationsStore;
}

type PendingAction =
  | { kind: "deleteOrganization" }
  | { kind: "leaveOrganization" }
  | { kind: "removeMember"; member: OrganizationMember }
  | { kind: "removeItem"; id: string; title: string };

const ROLE_TEXT: Record<OrganizationRole, AppTextKey> = {
  owner: "organization.role.owner",
  admin: "organization.role.admin",
  member: "organization.role.member",
};

interface Choice {
  id: string;
  label: string;
}

function ChoiceSelect(props: {
  label: string;
  options: Choice[];
  value: string | null;
  placeholder?: string;
  disabled?: boolean;
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
      disabled={props.disabled === true}
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

export function OrganizationsTab(props: OrganizationsTabProps) {
  const { t } = useText();
  const store = props.store;
  return (
    <>
      <Show when={store.state.error}>
        {(error) => (
          <Alert tone="danger" role="alert">
            <AlertDescription>
              {error().message}
              <ErrorReference reference={error().reference} />
            </AlertDescription>
          </Alert>
        )}
      </Show>
      <Show
        when={store.state.organizations.signedIn}
        fallback={
          <SettingsSection title={t("organization.title")} description={t("organization.intro")}>
            <Text>{t("organization.signedOut")}</Text>
          </SettingsSection>
        }
      >
        <Show when={store.selectedOrganization()} fallback={<OrganizationList store={store} />}>
          {(organization) => <OrganizationDetail store={store} organization={organization()} />}
        </Show>
      </Show>
    </>
  );
}

function OrganizationList(props: { store: OrganizationsStore }) {
  const { t } = useText();
  const store = props.store;
  const [name, setName] = createSignal("");
  const [ownerNumber, setOwnerNumber] = createSignal("");
  const canCreate = () => name().trim().length > 0 && ownerNumber().trim().length > 0 && !store.state.busy;
  const roleLabel = (organization: OrganizationSummary) =>
    organization.role === null ? t("organization.role.platformOwner") : t(ROLE_TEXT[organization.role]);
  return (
    <>
      <SettingsSection
        data-settings-row="organization.title"
        title={t("organization.title")}
        description={t("organization.intro")}
      >
        <Button variant="outline" size="sm" disabled={store.state.busy} onClick={() => void store.syncNow()}>
          {store.state.busy ? t("organization.syncing") : t("organization.refresh")}
        </Button>
        <Show when={store.state.organizations.issue}>
          {(issue) => (
            <Alert tone="warning" role="status">
              <AlertDescription>
                {issue() === "offline"
                  ? t("organization.issue.offline")
                  : issue() === "notConfigured"
                    ? t("organization.issue.notConfigured")
                    : t("organization.issue.data")}
              </AlertDescription>
            </Alert>
          )}
        </Show>
        <Show
          when={store.state.organizations.organizations.length > 0}
          fallback={
            <Show when={!store.state.loading}>
              <Text>{t("organization.empty")}</Text>
            </Show>
          }
        >
          <ItemGroup class="settings-modal-card">
            <For each={store.state.organizations.organizations}>
              {(organization) => (
                <Item>
                  <ItemContent>
                    <ItemTitle>{organization.name}</ItemTitle>
                    <ItemDescription>
                      {t("organization.counts", {
                        members: organization.memberCount,
                        items: organization.sharedCount,
                      })}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="primary-light">{roleLabel(organization)}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t("organization.open", { name: organization.name })}
                      disabled={store.state.busy}
                      onClick={() => void store.open(organization.id)}
                    >
                      {t("organization.open", { name: organization.name })}
                    </Button>
                  </ItemActions>
                </Item>
              )}
            </For>
          </ItemGroup>
        </Show>
      </SettingsSection>
      <Show when={store.state.organizations.platformOwner}>
        <SettingsSection data-settings-row="organization.new" title={t("organization.new")}>
          <form
            novalidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!canCreate()) return;
              void store.create(name().trim(), ownerNumber().trim()).then((created) => {
                if (!created) return;
                setName("");
                setOwnerNumber("");
              });
            }}
          >
            <Field label={t("organization.nameLabel")}>
              <Input autocomplete="off" value={name()} onValueChange={setName} />
            </Field>
            <Field label={t("organization.ownerNumberLabel")} description={t("organization.ownerNumberHint")}>
              <Input type="tel" autocomplete="off" value={ownerNumber()} onValueChange={setOwnerNumber} />
            </Field>
            <Button type="submit" disabled={!canCreate()}>
              {t("organization.create")}
            </Button>
          </form>
        </SettingsSection>
      </Show>
    </>
  );
}

function OrganizationDetail(props: { store: OrganizationsStore; organization: OrganizationSummary }) {
  const { t } = useText();
  const store = props.store;
  const org = () => props.organization;
  const manage = () => org().canManage;
  const mayDelete = () => org().role === "owner" || org().platformOwner;
  const [rename, setRename] = createSignal<string | null>(null);
  const [memberNumber, setMemberNumber] = createSignal("");
  const [memberRole, setMemberRole] = createSignal<"admin" | "member">("member");
  const [pick, setPick] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal<PendingAction | null>(null);
  const [serverPick, setServerPick] = createSignal<string | null>(null);

  const roleChoices = (): Choice[] =>
    (["owner", "admin", "member"] as const).map((role) => ({ id: role, label: t(ROLE_TEXT[role]) }));
  const newMemberRoles = (): Choice[] =>
    (["admin", "member"] as const).map((role) => ({ id: role, label: t(ROLE_TEXT[role]) }));
  const personalChoices = (): Choice[] =>
    store.state.personal
      .filter((item) => !store.state.vault.some((existing) => existing.id === item.id))
      .map((item) => ({ id: item.id, label: item.title }));
  const confirmCopy = () => {
    const action = pending();
    if (action === null) return { title: "", body: "", label: "" };
    if (action.kind === "deleteOrganization")
      return {
        title: t("organization.deleteTitle", { name: org().name }),
        body: t("organization.deleteBody"),
        label: t("organization.delete"),
      };
    if (action.kind === "leaveOrganization")
      return {
        title: t("organization.leaveTitle", { name: org().name }),
        body: t("organization.leaveBody"),
        label: t("organization.leave"),
      };
    if (action.kind === "removeMember")
      return {
        title: t("organization.memberRemoveTitle", { name: action.member.name ?? action.member.phone }),
        body: t("organization.memberRemoveBody"),
        label: t("organization.memberRemove", { name: action.member.name ?? action.member.phone }),
      };
    return {
      title: t("organization.vault.removeTitle", { name: action.title }),
      body: t("organization.vault.removeBody"),
      label: t("organization.vault.remove", { name: action.title }),
    };
  };
  const confirm = async () => {
    const action = pending();
    if (action === null) return;
    const done =
      action.kind === "deleteOrganization"
        ? await store.remove()
        : action.kind === "leaveOrganization"
          ? await store.leave()
          : action.kind === "removeMember"
            ? await store.removeMember(action.member.userId)
            : await store.removeVaultItem(action.id);
    if (done) setPending(null);
  };

  return (
    <>
      <SettingsSection data-settings-row="organization.title" title={org().name}>
        <Button variant="ghost" size="sm" onClick={() => store.close()}>
          <ArrowLeft aria-hidden="true" />
          {t("organization.back")}
        </Button>
        <Text>
          {org().role === null ? t("organization.role.platformOwner") : t(ROLE_TEXT[org().role ?? "member"])}
          {" · "}
          {t("organization.counts", { members: org().memberCount, items: org().sharedCount })}
        </Text>
        <Show when={store.state.organizations.issue === "notConfigured"}>
          <Alert tone="warning" role="status">
            <AlertDescription>{t("organization.issue.notConfigured")}</AlertDescription>
          </Alert>
        </Show>
        <Show when={manage()}>
          <form
            novalidate
            onSubmit={(event) => {
              event.preventDefault();
              const value = (rename() ?? org().name).trim();
              if (value.length === 0 || value === org().name) return;
              void store.rename(value).then((done) => {
                if (done) setRename(null);
              });
            }}
          >
            <Field label={t("organization.nameLabel")}>
              <Input autocomplete="off" value={rename() ?? org().name} onValueChange={setRename} />
            </Field>
            <Button type="submit" variant="outline" size="sm" disabled={store.state.busy}>
              {t("organization.save")}
            </Button>
          </form>
        </Show>
        <div>
          <Show when={org().role !== null}>
            <Button variant="outline" size="sm" onClick={() => setPending({ kind: "leaveOrganization" })}>
              {t("organization.leave")}
            </Button>
          </Show>
          <Show when={mayDelete()}>
            <Button variant="destructive" size="sm" onClick={() => setPending({ kind: "deleteOrganization" })}>
              {t("organization.delete")}
            </Button>
          </Show>
        </div>
      </SettingsSection>

      <SettingsSection data-settings-row="organization.members" title={t("organization.members")}>
        <ItemGroup class="settings-modal-card">
          <For each={store.state.members}>
            {(member) => {
              const label = () => member.name ?? member.phone;
              return (
                <Item>
                  <ItemContent>
                    <ItemTitle>{label()}</ItemTitle>
                    <ItemDescription>{member.name === null ? "" : member.phone}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Show when={manage()} fallback={<Badge variant="primary-light">{t(ROLE_TEXT[member.role])}</Badge>}>
                      <ChoiceSelect
                        label={t("organization.memberRole", { name: label() })}
                        options={roleChoices()}
                        value={member.role}
                        disabled={store.state.busy}
                        onChange={(role) => {
                          if (role === "owner" || role === "admin" || role === "member")
                            void store.setMemberRole(member.userId, role);
                        }}
                      />
                      <IconButton
                        label={t("organization.memberRemove", { name: label() })}
                        variant="ghost"
                        disabled={store.state.busy}
                        onClick={() => setPending({ kind: "removeMember", member })}
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </Show>
                  </ItemActions>
                </Item>
              );
            }}
          </For>
        </ItemGroup>
        <Show when={manage()}>
          <form
            novalidate
            onSubmit={(event) => {
              event.preventDefault();
              const number = memberNumber().trim();
              if (number.length === 0) return;
              void store.addMember(number, memberRole()).then((done) => {
                if (done) setMemberNumber("");
              });
            }}
          >
            <Field label={t("organization.addMemberNumber")} description={t("organization.ownerNumberHint")}>
              <Input type="tel" autocomplete="off" value={memberNumber()} onValueChange={setMemberNumber} />
            </Field>
            <Field label={t("organization.addMemberRole")}>
              <ChoiceSelect
                label={t("organization.addMemberRole")}
                options={newMemberRoles()}
                value={memberRole()}
                onChange={(role) => {
                  if (role === "admin" || role === "member") setMemberRole(role);
                }}
              />
            </Field>
            <Button type="submit" disabled={store.state.busy || memberNumber().trim().length === 0}>
              {t("organization.addMember")}
            </Button>
          </form>
        </Show>
      </SettingsSection>

      <SettingsSection
        data-settings-row="organization.vault.title"
        title={t("organization.vault.title")}
        description={t("organization.vault.intro")}
      >
        <Show when={!manage()}>
          <Text>{t("organization.vault.managersOnly")}</Text>
        </Show>
        <Show
          when={store.state.vault.length > 0}
          fallback={
            <Show when={!store.state.busy}>
              <Text>{t("organization.vault.empty")}</Text>
            </Show>
          }
        >
          <ItemGroup class="settings-modal-card">
            <For each={store.state.vault}>
              {(item) => (
                <Item>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.detail}</ItemDescription>
                  </ItemContent>
                  <Show when={manage()}>
                    <ItemActions>
                      <Text variant="caption" tone="muted" id={`org-share-${item.id}`}>
                        {t("organization.vault.share")}
                      </Text>
                      <Switch
                        checked={item.shared}
                        disabled={store.state.busy}
                        aria-labelledby={`org-share-${item.id}`}
                        aria-describedby={`org-share-hint-${item.id}`}
                        onChange={(shared: boolean) => void store.shareVaultItem(item.id, shared)}
                      />
                      <span id={`org-share-hint-${item.id}`} hidden>
                        {t("organization.vault.shareHint")}
                      </span>
                      <IconButton
                        label={t("organization.vault.remove", { name: item.title })}
                        variant="ghost"
                        disabled={store.state.busy}
                        onClick={() => setPending({ kind: "removeItem", id: item.id, title: item.title })}
                      >
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </ItemActions>
                  </Show>
                </Item>
              )}
            </For>
          </ItemGroup>
        </Show>
        <Show when={manage()}>
          <Show when={personalChoices().length > 0} fallback={<Text>{t("organization.vault.addEmpty")}</Text>}>
            <Field label={t("organization.vault.add")}>
              <ChoiceSelect
                label={t("organization.vault.add")}
                placeholder={t("organization.vault.addPick")}
                options={personalChoices()}
                value={pick()}
                onChange={setPick}
              />
            </Field>
            <Button
              size="sm"
              disabled={store.state.busy || pick() === null}
              onClick={() => {
                const id = pick();
                const item = store.state.personal.find((entry) => entry.id === id);
                if (item) void store.addVaultItem(item.id, item.kind).then((done) => done && setPick(null));
              }}
            >
              {t("organization.vault.addConfirm")}
            </Button>
          </Show>
        </Show>
      </SettingsSection>

      <SettingsSection
        data-settings-row="organization.servers.title"
        title={t("organization.servers.title")}
        description={t("organization.servers.intro")}
      >
        <Show when={store.state.servers.length > 0} fallback={<Text>{t("organization.servers.empty")}</Text>}>
          <ItemGroup class="settings-modal-card">
            <For each={store.state.servers}>
              {(server) => (
                <Item>
                  <ItemContent>
                    <ItemTitle>{server.name}</ItemTitle>
                    <Show when={server.owner}>
                      <ItemDescription>{t("organization.servers.yours")}</ItemDescription>
                    </Show>
                  </ItemContent>
                  <ItemActions>
                    <Show
                      when={server.member}
                      fallback={
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={t("organization.servers.join", { name: server.name })}
                          disabled={store.state.busy || org().role === null}
                          onClick={() => void store.joinServer(server.hostId)}
                        >
                          {t("organization.servers.join", { name: server.name })}
                        </Button>
                      }
                    >
                      <Badge variant="primary-light">{t("organization.servers.joined")}</Badge>
                    </Show>
                    <Show when={server.canUnbind}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("organization.servers.unbind", { name: server.name })}
                        disabled={store.state.busy}
                        onClick={() => void store.unbindServer(server.hostId)}
                      >
                        {t("organization.servers.unbind", { name: server.name })}
                      </Button>
                    </Show>
                  </ItemActions>
                </Item>
              )}
            </For>
          </ItemGroup>
        </Show>
        <Show when={store.state.bindable.length > 0}>
          <Field label={t("organization.servers.bind")} description={t("organization.servers.bindHint")}>
            <ChoiceSelect
              label={t("organization.servers.bind")}
              placeholder={t("organization.servers.bindPick")}
              options={store.state.bindable.map((server) => ({ id: server.hostId, label: server.name }))}
              value={serverPick()}
              onChange={setServerPick}
            />
          </Field>
          <Button
            size="sm"
            disabled={store.state.busy || serverPick() === null}
            onClick={() => {
              const id = serverPick();
              if (id !== null) void store.bindServer(id).then((done) => done && setServerPick(null));
            }}
          >
            {t("organization.servers.bindConfirm")}
          </Button>
        </Show>
      </SettingsSection>

      <ConfirmDialog
        open={pending() !== null}
        title={confirmCopy().title}
        description={confirmCopy().body}
        confirmLabel={confirmCopy().label}
        pending={store.state.busy}
        error={
          pending() !== null && store.state.error ? (
            <>
              {store.state.error.message}
              <ErrorReference reference={store.state.error.reference} />
            </>
          ) : undefined
        }
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </>
  );
}
