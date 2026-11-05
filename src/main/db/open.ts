import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { applyMigrations, type MigrationFiles } from "./migrate";

/**
 * Opens a SQLite database at the given path, applies pragmas, and runs the provided migrations.
 * Skip WAL for in-memory databases.
 */
export function openDatabaseWith(path: string, files: MigrationFiles): BetterSqlite3.Database {
  const db = new Database(path);

  db.pragma("foreign_keys = ON");
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  applyMigrations(db, files);

  return db;
}
