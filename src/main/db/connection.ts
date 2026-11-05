import type BetterSqlite3 from "better-sqlite3";
import { bundledMigrations } from "./bundledMigrations";
import { openDatabaseWith } from "./open";

/**
 * Opens a SQLite database at the given path, enforces foreign keys, sets
 * WAL mode (for disk files) and applies all pending migrations using bundled migrations.
 * Tests pass `":memory:"`.
 */
export function openDatabase(path: string): BetterSqlite3.Database {
  return openDatabaseWith(path, bundledMigrations);
}
