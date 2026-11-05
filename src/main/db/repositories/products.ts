import type BetterSqlite3 from "better-sqlite3";
import { escapeLike } from "../sql";
import { DomainError } from "../../domain/errors";
import type { SalePickerProductDto } from "@shared/ipc/sales";

export interface ProductRecord {
  id: number;
  name: string;
  code: string | null;
  category: string;
  supplier_id: number | null;
  cost: number;
  price: number;
  quantity: number;
  reorder_level: number;
  archived: number;
}

export function getById(db: BetterSqlite3.Database, id: number): ProductRecord | null {
  const stmt = db.prepare<[number], ProductRecord>(
    "SELECT id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived FROM products WHERE id = ?"
  );
  return stmt.get(id) ?? null;
}

export function listForPicker(
  db: BetterSqlite3.Database,
  filter: { search?: string; category?: string | null }
): SalePickerProductDto[] {
  let query = `
    SELECT id, name, code, category, quantity, price
    FROM products
    WHERE archived = 0
  `;
  const params: (string | number)[] = [];

  if (filter.search && filter.search.trim().length > 0) {
    const escaped = escapeLike(filter.search.trim());
    query += ` AND (name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')`;
    const pattern = `%${escaped}%`;
    params.push(pattern, pattern);
  }

  if (filter.category && filter.category.trim().length > 0) {
    query += ` AND category = ?`;
    params.push(filter.category.trim());
  }

  query += ` ORDER BY name COLLATE NOCASE ASC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as {
    id: number;
    name: string;
    code: string | null;
    category: string;
    quantity: number;
    price: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    category: r.category,
    quantity: r.quantity,
    price: r.price,
  }));
}

export function adjustStock(
  db: BetterSqlite3.Database,
  productId: number,
  delta: number
): void {
  const product = getById(db, productId);
  if (!product) {
    throw new DomainError("NOT_FOUND", "Product not found.");
  }

  const newQty = product.quantity + delta;
  if (newQty < 0) {
    throw new DomainError("RULE", `Only ${product.quantity} of ${product.name} in stock.`);
  }

  const stmt = db.prepare<[number, number]>("UPDATE products SET quantity = ? WHERE id = ?");
  stmt.run(newQty, productId);
}
