import Database from "better-sqlite3";
import { migrate } from "./migrate";

/**
 * Opens a SQLite database, enables foreign keys and WAL (except for in-memory
 * databases, which cannot use WAL) and brings the schema up to date.
 */
export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  migrate(db);
  return db;
}
