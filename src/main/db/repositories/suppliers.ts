import type BetterSqlite3 from "better-sqlite3";

export interface SupplierRecord {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
  archived: number;
}

export function getById(db: BetterSqlite3.Database, id: number): SupplierRecord | null {
  const stmt = db.prepare<[number], SupplierRecord>(
    "SELECT id, name, contact_name, phone, address, supplies, archived FROM suppliers WHERE id = ?"
  );
  return stmt.get(id) ?? null;
}

export function listActive(db: BetterSqlite3.Database): { id: number; name: string }[] {
  const stmt = db.prepare<[], { id: number; name: string }>(
    "SELECT id, name FROM suppliers WHERE archived = 0 ORDER BY name COLLATE NOCASE ASC"
  );
  return stmt.all();
}
