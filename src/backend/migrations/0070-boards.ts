import type { OpenBotMigration } from "./migration";

export const BOARDS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT NOT NULL PRIMARY KEY CHECK(length(id) = 32),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
    color TEXT CHECK(color IS NULL OR color IN ('slate', 'blue', 'green', 'amber', 'red', 'violet')),
    position INTEGER NOT NULL,
    archived_at TEXT,
    created_by TEXT NOT NULL CHECK(length(created_by) BETWEEN 1 AND 128),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_kind TEXT NOT NULL CHECK(updated_by_kind IN ('member', 'agent')),
    updated_by TEXT NOT NULL CHECK(length(updated_by) BETWEEN 1 AND 128),
    revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1)
  );
  CREATE INDEX IF NOT EXISTS boards_order ON boards(position, created_at, id);
  CREATE TABLE IF NOT EXISTS board_columns (
    id TEXT NOT NULL PRIMARY KEY CHECK(length(id) = 32),
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
    position INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1))
  );
  CREATE INDEX IF NOT EXISTS board_columns_board ON board_columns(board_id, position, id);
  CREATE TABLE IF NOT EXISTS board_cards (
    id TEXT NOT NULL PRIMARY KEY CHECK(length(id) = 32),
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 8000),
    assignee_kind TEXT CHECK(assignee_kind IS NULL OR assignee_kind IN ('member', 'agent')),
    assignee_id TEXT CHECK(assignee_id IS NULL OR length(assignee_id) BETWEEN 1 AND 128),
    agent_id TEXT CHECK(agent_id IS NULL OR length(agent_id) BETWEEN 1 AND 128),
    thread_id TEXT CHECK(thread_id IS NULL OR length(thread_id) BETWEEN 1 AND 128),
    due_at TEXT CHECK(due_at IS NULL OR due_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    labels_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(labels_json)),
    created_by_kind TEXT NOT NULL CHECK(created_by_kind IN ('member', 'agent')),
    created_by TEXT NOT NULL CHECK(length(created_by) BETWEEN 1 AND 128),
    updated_by_kind TEXT NOT NULL CHECK(updated_by_kind IN ('member', 'agent')),
    updated_by TEXT NOT NULL CHECK(length(updated_by) BETWEEN 1 AND 128),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    CHECK((assignee_kind IS NULL) = (assignee_id IS NULL)),
    CHECK((agent_id IS NULL) = (thread_id IS NULL))
  );
  CREATE INDEX IF NOT EXISTS board_cards_column ON board_cards(column_id, position, id) WHERE archived_at IS NULL;
  CREATE INDEX IF NOT EXISTS board_cards_board ON board_cards(board_id, archived_at);
`;

export const BOARDS_TABLES_AFTER_MIGRATION: Record<string, never[]> = {
  boards: [],
  board_columns: [],
  board_cards: [],
};

export const migration: OpenBotMigration = {
  version: 70,
  name: "boards",
  up: (db) => db.exec(BOARDS_SCHEMA_SQL),
};
