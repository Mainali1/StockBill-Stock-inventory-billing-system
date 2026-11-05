import type BetterSqlite3 from "better-sqlite3";

export function get(db: BetterSqlite3.Database, key: string): string | null {
  const stmt = db.prepare<[string], { value: string }>(
    "SELECT value FROM settings WHERE key = ?"
  );
  const row = stmt.get(key);
  return row ? row.value : null;
}

export function set(db: BetterSqlite3.Database, key: string, value: string): void {
  const stmt = db.prepare<[string, string]>(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  stmt.run(key, value);
}
