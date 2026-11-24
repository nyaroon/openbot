CREATE TABLE account_vaults (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kdf TEXT NOT NULL CHECK (length(kdf) BETWEEN 2 AND 200),
  salt TEXT NOT NULL CHECK (length(salt) BETWEEN 16 AND 88),
  wrapped_key TEXT NOT NULL CHECK (length(wrapped_key) BETWEEN 40 AND 200),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  change_seq INTEGER NOT NULL DEFAULT 0 CHECK (change_seq >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE account_vault_items (
  user_id TEXT NOT NULL REFERENCES account_vaults(user_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL CHECK (length(item_id) BETWEEN 1 AND 64),
  kind TEXT NOT NULL CHECK (kind IN ('login', 'card', 'contact', 'apiKey')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  ciphertext TEXT CHECK (ciphertext IS NULL OR length(ciphertext) <= 98304),
  removal TEXT CHECK (removal IS NULL OR removal IN ('deleted', 'unshared')),
  deleted_at INTEGER,
  updated_at INTEGER NOT NULL,
  change_seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id),
  CHECK ((removal IS NULL) = (deleted_at IS NULL)),
  CHECK ((removal IS NULL) = (ciphertext IS NOT NULL))
);

CREATE INDEX account_vault_items_changes ON account_vault_items(user_id, change_seq);
CREATE INDEX account_vault_items_tombstones ON account_vault_items(deleted_at) WHERE deleted_at IS NOT NULL;
