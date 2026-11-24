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
  let revision = 0;

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
    if (digits === null || nameError() !== null) return;
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
      setTouched(false);
      await refresh();
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
    markPhoneTouched: () => setTouched(true),
    create,
    refresh,
  };
}

export type SettingsAccountsStore = ReturnType<typeof createSettingsAccountsStore>;
