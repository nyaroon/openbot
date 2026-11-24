CREATE TABLE account_vault_blobs (
  user_id TEXT NOT NULL REFERENCES account_vaults(user_id) ON DELETE CASCADE,
  blob_id TEXT NOT NULL CHECK (length(blob_id) BETWEEN 1 AND 64),
  size INTEGER NOT NULL CHECK (size >= 1),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blob_id)
);
