import type BetterSqlite3 from "better-sqlite3";

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export function count(db: BetterSqlite3.Database): number {
  const stmt = db.prepare<[], { total: number }>("SELECT COUNT(*) as total FROM users");
  const row = stmt.get();
  return row ? row.total : 0;
}

export function findByUsername(db: BetterSqlite3.Database, username: string): UserRecord | null {
  const stmt = db.prepare<[string], UserRecord>(
    "SELECT id, username, password_hash, created_at FROM users WHERE username = ?"
  );
  return stmt.get(username) ?? null;
}

export function insert(
  db: BetterSqlite3.Database,
  user: { username: string; passwordHash: string; createdAt: string }
): number {
  const stmt = db.prepare<[string, string, string]>(
    "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
  );
  const info = stmt.run(user.username, user.passwordHash, user.createdAt);
  return Number(info.lastInsertRowid);
}
