import { BOARDS_SCHEMA_SQL } from "./0070-boards";
import type { OpenBotMigration } from "./migration";

/**
 * Creates the board tables in a database that was imported from OpenBot. There, version 70 is
 * another migration (the thread activity index, version 71 here), so `0070-boards` never ran.
 * In every other database the tables exist and this changes nothing.
 */
export const migration: OpenBotMigration = {
  version: 72,
  name: "boards-repair",
  up: (db) => db.exec(BOARDS_SCHEMA_SQL),
};
