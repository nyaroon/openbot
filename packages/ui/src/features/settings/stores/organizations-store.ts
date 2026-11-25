import {
  EMPTY_ORGANIZATIONS,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationsDesktopApi,
  type OrganizationsState,
  type OrganizationVaultItem,
  type VaultItemKind,
  type VaultState,
} from "@openbot/contracts/ipc";
import type { UserErrorDetails } from "@openbot/user-errors";
import { createStore } from "solid-js";
import { currentText } from "../../../text";

export interface OrganizationsStoreProps {
  api: () => OrganizationsDesktopApi;
  /** Personal vault items that can be copied into an organization. */
  personalVault: () => Promise<VaultState>;
}

export interface PersonalVaultChoice {
  id: string;
  kind: VaultItemKind;
  title: string;
}

interface OrganizationsPanels {
  organizations: OrganizationsState;
  selectedId: string | null;
  members: OrganizationMember[];
  vault: OrganizationVaultItem[];
  personal: PersonalVaultChoice[];
  loading: boolean;
  busy: boolean;
  error: UserErrorDetails | null;
}

function personalTitle(item: VaultState["items"][number]): string {
  if (item.kind === "login") return item.website || item.username;
  if (item.kind === "card") return item.label || item.last4;
  if (item.kind === "apiKey") return item.name;
  return item.label || item.fullName || item.email;
}

export function createOrganizationsStore(props: OrganizationsStoreProps) {
  const [state, setState] = createStore<OrganizationsPanels>({
    organizations: { ...EMPTY_ORGANIZATIONS },
    selectedId: null,
    members: [],
    vault: [],
    personal: [],
    loading: false,
    busy: false,
    error: null,
  });
  let detailRequest = 0;

  const fail = (error: unknown) => {
    const { errorDetails, t } = currentText();
    setState((draft) => {
      draft.error = errorDetails(error, t("organization.failed"));
    });
  };

  const show = (next: OrganizationsState) => {
    setState((draft) => {
      draft.organizations = next;
      if (draft.selectedId !== null && !next.organizations.some((org) => org.id === draft.selectedId)) {
        draft.selectedId = null;
        draft.members = [];
        draft.vault = [];
      }
    });
  };

  async function guarded(action: () => Promise<void>): Promise<boolean> {
    setState((draft) => {
      draft.busy = true;
      draft.error = null;
    });
    try {
      await action();
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setState((draft) => {
        draft.busy = false;
      });
    }
  }

  async function loadDetail(organizationId: string) {
    const current = ++detailRequest;
    const api = props.api();
    const [members, vault] = await Promise.all([api.members({ organizationId }), api.vault({ organizationId })]);
    if (current !== detailRequest) return;
    setState((draft) => {
      draft.members = members;
      draft.vault = vault.items;
    });
  }

  async function loadPersonal() {
    const vault = await props.personalVault();
    setState((draft) => {
      draft.personal = vault.items
        .filter((item) => item.organization === undefined)
        .map((item) => ({ id: item.id, kind: item.kind, title: personalTitle(item) }));
    });
  }

  const selectedOrganization = () => state.organizations.organizations.find((org) => org.id === state.selectedId);

  return {
    state,
    selectedOrganization,
    subscribe: () => props.api().onChanged(show),
    refresh: async () => {
      setState((draft) => {
        draft.loading = true;
      });
      try {
        show(await props.api().status());
      } catch (error) {
        fail(error);
      } finally {
        setState((draft) => {
          draft.loading = false;
        });
      }
    },
    syncNow: () =>
      guarded(async () => {
        show(await props.api().refresh());
        const id = state.selectedId;
        if (id !== null) await loadDetail(id);
      }),
    open: (organizationId: string) =>
      guarded(async () => {
        detailRequest++;
        setState((draft) => {
          draft.selectedId = organizationId;
          draft.members = [];
          draft.vault = [];
        });
        await Promise.all([loadDetail(organizationId), loadPersonal()]);
      }),
    close: () => {
      detailRequest++;
      setState((draft) => {
        draft.selectedId = null;
        draft.members = [];
        draft.vault = [];
        draft.error = null;
      });
    },
    create: (name: string, ownerNumber: string) =>
      guarded(async () => show(await props.api().create({ name, ownerNumber }))),
    rename: (name: string) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId !== null) show(await props.api().rename({ organizationId, name }));
      }),
    remove: () =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId !== null) show(await props.api().remove({ organizationId }));
      }),
    leave: () =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId !== null) show(await props.api().leave({ organizationId }));
      }),
    addMember: (number: string, role: "admin" | "member") =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const members = await props.api().addMember({ organizationId, number, role });
        setState((draft) => {
          draft.members = members;
        });
      }),
    setMemberRole: (userId: string, role: OrganizationRole) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const members = await props.api().setMemberRole({ organizationId, userId, role });
        setState((draft) => {
          draft.members = members;
        });
      }),
    removeMember: (userId: string) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const members = await props.api().removeMember({ organizationId, userId });
        setState((draft) => {
          draft.members = members;
        });
      }),
    addVaultItem: (itemId: string, kind: VaultItemKind) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const vault = await props.api().addVaultItem({ organizationId, itemId, kind });
        setState((draft) => {
          draft.vault = vault.items;
        });
      }),
    shareVaultItem: (itemId: string, shared: boolean) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const vault = await props.api().shareVaultItem({ organizationId, itemId, shared });
        setState((draft) => {
          draft.vault = vault.items;
        });
      }),
    removeVaultItem: (itemId: string) =>
      guarded(async () => {
        const organizationId = state.selectedId;
        if (organizationId === null) return;
        const vault = await props.api().removeVaultItem({ organizationId, itemId });
        setState((draft) => {
          draft.vault = vault.items;
        });
      }),
  };
}

export type OrganizationsStore = ReturnType<typeof createOrganizationsStore>;
