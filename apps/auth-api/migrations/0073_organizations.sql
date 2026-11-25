CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  vault_change_seq INTEGER NOT NULL DEFAULT 0 CHECK (vault_change_seq >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX organization_members_user ON organization_members(user_id);

CREATE TABLE organization_vault_items (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL CHECK (length(item_id) BETWEEN 1 AND 64),
  kind TEXT NOT NULL CHECK (kind IN ('login', 'card', 'contact', 'apiKey')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  ciphertext TEXT CHECK (ciphertext IS NULL OR length(ciphertext) <= 98304),
  shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0, 1)),
  deleted_at INTEGER,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  change_seq INTEGER NOT NULL,
  PRIMARY KEY (organization_id, item_id),
  CHECK ((deleted_at IS NULL) = (ciphertext IS NOT NULL))
);

CREATE INDEX organization_vault_items_changes ON organization_vault_items(organization_id, change_seq);
