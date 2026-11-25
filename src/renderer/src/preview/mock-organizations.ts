import {
  EMPTY_ORGANIZATIONS,
  type OpenBotDesktopApi,
  type OrganizationMember,
  type OrganizationSummary,
  type OrganizationsState,
  type OrganizationVault,
  type OrganizationVaultItem,
} from "@openbot/contracts/ipc";

const MEMBERS: readonly OrganizationMember[] = [
  { userId: "preview-you", phone: "+628123456789", name: "You", role: "owner" },
  { userId: "preview-sari", phone: "+628111222333", name: "Sari", role: "admin" },
  { userId: "preview-budi", phone: "+628444555666", name: "Budi", role: "member" },
];

const ITEMS: readonly OrganizationVaultItem[] = [
  { id: "preview-item-1", kind: "login", title: "analytics.example.com", detail: "team@example.com", shared: true },
  {
    id: "preview-item-2",
    kind: "apiKey",
    title: "OPENAI_API_KEY",
    detail: "Shared with the support agents",
    shared: true,
  },
  { id: "preview-item-3", kind: "card", title: "Company card", detail: "•••• 4242", shared: false },
];

/** Preview data for the Organizations settings. Nothing here reaches a real account service. */
export function createMockOrganizations(): OpenBotDesktopApi["organizations"] {
  let members: OrganizationMember[] = [...MEMBERS];
  let items: OrganizationVaultItem[] = [...ITEMS];
  let name = "Preview Co";
  let exists = true;
  const summary = (): OrganizationSummary[] =>
    exists
      ? [
          {
            id: "preview-org",
            name,
            role: "owner",
            platformOwner: true,
            canManage: true,
            memberCount: members.length,
            sharedCount: items.filter((item) => item.shared).length,
            itemCount: items.length,
          },
        ]
      : [];
  const state = (): OrganizationsState => ({
    ...EMPTY_ORGANIZATIONS,
    signedIn: true,
    lastSyncAt: Date.now(),
    platformOwner: true,
    organizations: summary(),
  });
  const vault = (): OrganizationVault => ({ organizationId: "preview-org", items });
  const listeners = new Set<(next: OrganizationsState) => void>();
  const change = () => {
    const next = state();
    for (const listener of listeners) listener(next);
    return next;
  };
  return {
    status: async () => state(),
    refresh: async () => change(),
    create: async (input) => {
      name = input.name;
      exists = true;
      return change();
    },
    rename: async (input) => {
      name = input.name;
      return change();
    },
    remove: async () => {
      exists = false;
      return change();
    },
    leave: async () => {
      exists = false;
      return change();
    },
    members: async () => members,
    addMember: async (input) => {
      members = [
        ...members,
        { userId: `preview-${members.length}`, phone: input.number, name: null, role: input.role },
      ];
      change();
      return members;
    },
    setMemberRole: async (input) => {
      members = members.map((member) => (member.userId === input.userId ? { ...member, role: input.role } : member));
      return members;
    },
    removeMember: async (input) => {
      members = members.filter((member) => member.userId !== input.userId);
      change();
      return members;
    },
    vault: async () => vault(),
    addVaultItem: async (input) => {
      items = [
        ...items,
        { id: `preview-item-${items.length + 1}`, kind: input.kind, title: "New item", detail: "", shared: false },
      ];
      change();
      return vault();
    },
    shareVaultItem: async (input) => {
      items = items.map((item) => (item.id === input.itemId ? { ...item, shared: input.shared } : item));
      change();
      return vault();
    },
    removeVaultItem: async (input) => {
      items = items.filter((item) => item.id !== input.itemId);
      change();
      return vault();
    },
    onChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
