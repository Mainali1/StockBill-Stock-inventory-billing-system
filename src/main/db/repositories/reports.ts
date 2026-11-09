import type BetterSqlite3 from "better-sqlite3";
import type { ProductStatus } from "@shared/ipc/common";
import { productStatus } from "../../domain/stock";
import type { SaleFact } from "../../domain/reports";

/**
 * Fetches sale facts for a date range [from 00:00, to 23:59].
 * Product name is joined from products table.
 */
export function getSaleFacts(
  db: BetterSqlite3.Database,
  from: string,
  to: string
): SaleFact[] {
  return db
    .prepare<[string, string], SaleFact>(
      `
    SELECT
      s.sold_at AS soldAt,
      s.product_id AS productId,
      p.name AS productName,
      s.quantity AS quantity,
      s.unit_price AS unitPrice,
      s.unit_cost AS unitCost
    FROM sales s
    JOIN products p ON p.id = s.product_id
    WHERE s.sold_at >= ? AND s.sold_at <= ?
    ORDER BY s.sold_at ASC, s.id ASC
  `
    )
    .all(`${from} 00:00`, `${to} 23:59`);
}

export interface StockProductRow {
  id: number;
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  cost: number;
}

/**
 * Returns all non-archived products for stock valuation and reporting.
 */
export function getActiveProducts(db: BetterSqlite3.Database): StockProductRow[] {
  return db
    .prepare<[], StockProductRow>(
      `
    SELECT
      id,
      name,
      category,
      quantity,
      reorder_level AS reorderLevel,
      cost
    FROM products
    WHERE archived = 0
    ORDER BY name COLLATE NOCASE ASC
  `
    )
    .all();
}

/**
 * Returns low and out-of-stock products (quantity <= reorder_level and archived = 0).
 */
export function getLowStockProducts(
  db: BetterSqlite3.Database
): { id: number; name: string; quantity: number; reorderLevel: number; status: ProductStatus }[] {
  const rows = db
    .prepare<
      [],
      { id: number; name: string; quantity: number; reorderLevel: number }
    >(
      `
    SELECT
      id,
      name,
      quantity,
      reorder_level AS reorderLevel
    FROM products
    WHERE archived = 0 AND quantity <= reorder_level
    ORDER BY quantity ASC, name COLLATE NOCASE ASC
  `
    )
    .all();

  return rows.map((r) => ({
    ...r,
    status: productStatus(r.quantity, r.reorderLevel),
  }));
}

export interface SupplierDueRow {
  id: number;
  name: string;
  due: number;
}

/**
 * Returns all non-archived suppliers with a balance due (total - paid_amount > 0).
 */
export function getSupplierDues(db: BetterSqlite3.Database): SupplierDueRow[] {
  return db
    .prepare<[], SupplierDueRow>(
      `
    SELECT
      s.id,
      s.name,
      SUM(i.total - i.paid_amount) AS due
    FROM suppliers s
    JOIN supplier_invoices i ON i.supplier_id = s.id
    WHERE s.archived = 0
    GROUP BY s.id, s.name
    HAVING due > 0
    ORDER BY s.name COLLATE NOCASE ASC
  `
    )
    .all();
}
