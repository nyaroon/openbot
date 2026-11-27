import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type { CreateOwnerAccountInput, CreateOwnerAccountResult, OwnerAccount } from "@openbot/contracts/ipc";
import { normalizePhoneNumber } from "@openbot/contracts/phone-identity";
import { validateProfileName } from "@openbot/contracts/validation";
import { errorReference, type UserErrorDetails } from "@openbot/user-errors";
import { createEffect, createSignal, createStore } from "solid-js";
import { currentText } from "../../../text";

interface AccountsStoreProps {
  open: boolean;
  onListOwnerAccounts?: (() => Promise<OwnerAccount[]>) | undefined;
  onCreateOwnerAccount?: ((input: CreateOwnerAccountInput) => Promise<CreateOwnerAccountResult>) | undefined;
}

/** The choice that starts a new organization instead of joining one. */
export const NEW_ORGANIZATION = "new";
const ORGANIZATION_NAME_LIMIT = 80;

export interface OwnerOrganization {
  id: string;
  name: string;
  members: number;
  connected: number;
}

interface AccountsPanels {
  items: OwnerAccount[];
  loading: boolean;
  loadError: UserErrorDetails | null;
  creating: boolean;
  createError: UserErrorDetails | null;
  createdPhone: string | null;
}

export function createSettingsAccountsStore(props: AccountsStoreProps, isActive: () => boolean) {
  const [panels, setPanels] = createStore<AccountsPanels>({
    items: [],
    loading: false,
    loadError: null,
    creating: false,
    createError: null,
    createdPhone: null,
  });
  const [phone, setPhone] = createSignal("");
  const [name, setName] = createSignal("");
  const [touched, setTouched] = createSignal(false);
  const [organization, setOrganization] = createSignal<string | null>(null);
  const [organizationName, setOrganizationName] = createSignal("");
  const [role, setRole] = createSignal<"admin" | "member">("member");
  let revision = 0;

  /** Every organization that has a member, with how many of its members are signed in somewhere. */
  const organizations = (): OwnerOrganization[] => {
    const found = new Map<string, OwnerOrganization>();
    for (const account of panels.items) {
      for (const entry of account.organizations) {
        const current = found.get(entry.id) ?? { id: entry.id, name: entry.name, members: 0, connected: 0 };
        current.members += 1;
        if (account.sessionCount > 0) current.connected += 1;
        found.set(entry.id, current);
      }
    }
    return [...found.values()].sort((left, right) => left.name.localeCompare(right.name));
  };
  const totals = () => ({
    organizations: organizations().length,
    accounts: panels.items.length,
    connected: panels.items.filter((account) => account.sessionCount > 0).length,
    sessions: panels.items.reduce((sum, account) => sum + account.sessionCount, 0),
  });
  const startsOrganization = () => organization() === NEW_ORGANIZATION;
  const place = (): Pick<CreateOwnerAccountInput, "organizationId" | "organizationName" | "role"> | null => {
    const chosen = organization();
    if (chosen === NEW_ORGANIZATION) {
      const trimmed = organizationName().trim();
      return trimmed.length === 0 || trimmed.length > ORGANIZATION_NAME_LIMIT ? null : { organizationName: trimmed };
    }
    return chosen && organizations().some((item) => item.id === chosen)
      ? { organizationId: chosen, role: role() }
      : null;
  };
  const organizationError = () =>
    touched() && place() === null ? currentText().t("settings.accounts.organization.required") : null;

  const normalizedPhone = () => normalizePhoneNumber(phone());
  const phoneError = () => {
    if (normalizedPhone() !== null) return null;
    return currentText().t("settings.accounts.phone.invalid");
  };
  const nameError = () => {
    if (name().trim().length === 0) return null;
    const { t } = currentText();
    switch (validateProfileName(name()).error) {
      case "unsafe":
        return t("settings.profile.name.unsafe");
      case "too-short":
        return t("settings.profile.name.tooShort", { limit: INPUT_LIMITS.profileNameMin });
      case "too-long":
        return t("settings.profile.name.tooLong", { limit: INPUT_LIMITS.profileName });
      default:
        return null;
    }
  };
  const visiblePhoneError = () => (touched() ? phoneError() : null);

  async function refresh() {
    if (!props.onListOwnerAccounts) return;
    const current = ++revision;
    setPanels((state) => {
      state.loading = true;
      state.loadError = null;
    });
    try {
      const items = await props.onListOwnerAccounts();
      if (current !== revision) return;
      setPanels((state) => {
        state.items = items;
      });
    } catch (error) {
      if (current !== revision) return;
      setPanels((state) => {
        state.loadError = {
          message: currentText().t("settings.accounts.list.loadFailed"),
          reference: errorReference(error),
        };
      });
    } finally {
      if (current === revision)
        setPanels((state) => {
          state.loading = false;
        });
    }
  }

  async function create() {
    if (!props.onCreateOwnerAccount || panels.creating) return;
    setTouched(true);
    const digits = normalizedPhone();
    const target = place();
    if (digits === null || nameError() !== null || target === null) return;
    const trimmedName = name().trim().length === 0 ? null : validateProfileName(name()).name;
    setPanels((state) => {
      state.creating = true;
      state.createError = null;
      state.createdPhone = null;
    });
    try {
      const result = await props.onCreateOwnerAccount({
        phone: `+${digits}`,
        ...(trimmedName === null ? {} : { name: trimmedName }),
        ...target,
      });
      if (result.status === "exists") {
        setPanels((state) => {
          state.createError = { message: currentText().t("settings.accounts.create.exists"), reference: null };
        });
        return;
      }
      setPanels((state) => {
        state.createdPhone = `+${digits}`;
      });
      setPhone("");
      setName("");
      setOrganizationName("");
      setTouched(false);
      await refresh();
      // A new organization is in the list now, so the next person can be added to it.
      if ("organizationName" in target) {
        const started = organizations().find((item) => item.name === target.organizationName);
        setOrganization(started?.id ?? null);
      }
    } catch (error) {
      setPanels((state) => {
        state.createError = {
          message: currentText().t("settings.accounts.create.failed"),
          reference: errorReference(error),
        };
      });
    } finally {
      setPanels((state) => {
        state.creating = false;
      });
    }
  }

  createEffect(
    () => ({ open: props.open, active: isActive(), list: props.onListOwnerAccounts }),
    ({ open, active, list }) => {
      revision += 1;
      setPanels((state) => {
        state.items = [];
        state.createdPhone = null;
        state.createError = null;
      });
      if (open && active && list) void refresh();
      return () => {
        revision += 1;
      };
    },
  );

  return {
    state: panels,
    phone,
    name,
    nameError,
    visiblePhoneError,
    updatePhone: (value: string) => {
      setPhone(value);
      setPanels((state) => {
        state.createdPhone = null;
        state.createError = null;
      });
    },
    updateName: setName,
    organizations,
    totals,
    organization,
    organizationName,
    organizationError,
    role,
    startsOrganization,
    updateOrganization: setOrganization,
    updateOrganizationName: setOrganizationName,
    updateRole: setRole,
    markPhoneTouched: () => setTouched(true),
    create,
    refresh,
  };
}

export type SettingsAccountsStore = ReturnType<typeof createSettingsAccountsStore>;
