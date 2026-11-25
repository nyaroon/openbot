-- A server (remote host) belongs to at most one organization. Unbinding or deleting the
-- organization only clears the link; it never changes who is a member of the server.
ALTER TABLE remote_hosts ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX remote_hosts_organization ON remote_hosts(organization_id) WHERE organization_id IS NOT NULL;
