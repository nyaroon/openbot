-- An artifact is a page that an agent publishes for an organization. The HTML of each version is
-- in object storage below `artifacts/<id>/<version>.html`; these tables hold everything else.
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  version INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'organization' CHECK (visibility IN ('organization', 'public')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX artifacts_organization ON artifacts(organization_id, updated_at DESC);

CREATE TABLE artifact_versions (
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, version)
);

CREATE TABLE artifact_comments (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX artifact_comments_artifact ON artifact_comments(artifact_id, created_at);
