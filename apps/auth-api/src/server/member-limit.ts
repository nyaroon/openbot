/**
 * The per-server member limit set by the operator in `server_member_limits`. A server without a row
 * uses `TEAM_MEMBER_LIMIT`. The row counts only while its owner still owns the server.
 */
export const SERVER_MEMBER_LIMIT_SQL = `SELECT l.member_limit FROM server_member_limits l
  JOIN remote_hosts h ON h.host_id = l.server_id AND h.owner_user_id = l.owner_user_id
 WHERE l.server_id = ?`;
