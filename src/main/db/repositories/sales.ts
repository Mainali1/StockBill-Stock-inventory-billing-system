import type BetterSqlite3 from "better-sqlite3";
import { listForPicker, getById } from "./products";
import { isValidDateTime, addDays, hourOf } from "../../domain/dates";
import { DomainError } from "../../domain/errors";
import type {
  SalePickerProductDto,
  SaleLineInput,
  DaySalesDto,
  SaleRowDto,
} from "@shared/ipc/sales";

export function getPickerData(
  db: BetterSqlite3.Database,
  filter: { search?: string; category?: string | null }
): { products: SalePickerProductDto[]; categories: string[] } {
  const products = listForPicker(db, filter);

  const catRows = db
    .prepare<[], { category: string }>(
      "SELECT DISTINCT category FROM products WHERE archived = 0 ORDER BY category COLLATE NOCASE ASC"
    )
    .all();

  const categories = catRows.map((r) => r.category);

  return { products, categories };
}

export function getDaySales(db: BetterSqlite3.Database, date: string): DaySalesDto {
  const nextDate = addDays(date, 1);
  const start = `${date} 00:00`;
  const end = `${nextDate} 00:00`;

  const rows = db
    .prepare<[string, string], {
      id: number;
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      unit_cost: number;
      sold_at: string;
    }>(
      `SELECT s.id, s.product_id, p.name as product_name, s.quantity, s.unit_price, s.unit_cost, s.sold_at
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.sold_at >= ? AND s.sold_at < ?
       ORDER BY s.sold_at ASC, s.id ASC`
    )
    .all(start, end);

  let total = 0;
  let profit = 0;
  const hourly = new Array<number>(24).fill(0);
  const saleRows: SaleRowDto[] = [];

  for (const r of rows) {
    const lineTotal = r.quantity * r.unit_price;
    const lineCost = r.quantity * r.unit_cost;
    const lineProfit = lineTotal - lineCost;

    total += lineTotal;
    profit += lineProfit;

    const hr = hourOf(r.sold_at);
    if (hr >= 0 && hr < 24) {
      hourly[hr] = (hourly[hr] ?? 0) + lineTotal;
    }

    saleRows.push({
      id: r.id,
      soldAt: r.sold_at,
      productId: r.product_id,
      productName: r.product_name,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      unitCost: r.unit_cost,
      lineTotal,
      profit: lineProfit,
    });
  }

  return {
    date,
    total,
    profit,
    count: rows.length,
    hourly,
    rows: saleRows,
  };
}

export function saveSale(
  db: BetterSqlite3.Database,
  input: { soldAt: string; lines: SaleLineInput[] }
): DaySalesDto {
  if (!isValidDateTime(input.soldAt)) {
    throw new DomainError("VALIDATION", "Enter a valid date and time.");
  }

  if (!input.lines || input.lines.length === 0) {
    throw new DomainError("VALIDATION", "Add at least one item.");
  }

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new DomainError("VALIDATION", "Enter a whole number of 1 or more.");
    }
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new DomainError("VALIDATION", "Enter an amount of 0 or more, with at most 2 decimals.");
    }
  }

  const requiredStockMap = new Map<number, number>();
  for (const line of input.lines) {
    requiredStockMap.set(
      line.productId,
      (requiredStockMap.get(line.productId) ?? 0) + line.quantity
    );
  }

  for (const line of input.lines) {
    const product = getById(db, line.productId);
    if (!product || product.archived === 1) {
      throw new DomainError("NOT_FOUND", "Product not found.");
    }

    const needed = requiredStockMap.get(line.productId) ?? 0;
    if (needed > product.quantity) {
      throw new DomainError("RULE", `Only ${product.quantity} of ${product.name} in stock.`);
    }
  }

  const datePart = input.soldAt.slice(0, 10);

  const runTransaction = db.transaction(() => {
    const insertStmt = db.prepare<[number, number, number, number, string]>(
      `INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
       VALUES (?, ?, ?, ?, ?)`
    );

    const updateStockStmt = db.prepare<[number, number]>(
      "UPDATE products SET quantity = quantity - ? WHERE id = ?"
    );

    for (const line of input.lines) {
      const product = getById(db, line.productId)!;
      insertStmt.run(line.productId, line.quantity, line.unitPrice, product.cost, input.soldAt);
    }

    for (const [prodId, qty] of requiredStockMap.entries()) {
      updateStockStmt.run(qty, prodId);
    }
  });

  runTransaction();

  return getDaySales(db, datePart);
}

export function updateSale(
  db: BetterSqlite3.Database,
  input: { id: number; quantity: number; unitPrice: number; soldAt: string }
): void {
  if (!isValidDateTime(input.soldAt)) {
    throw new DomainError("VALIDATION", "Enter a valid date and time.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new DomainError("VALIDATION", "Enter a whole number of 1 or more.");
  }
  if (!Number.isInteger(input.unitPrice) || input.unitPrice < 0) {
    throw new DomainError("VALIDATION", "Enter an amount of 0 or more, with at most 2 decimals.");
  }

  const existing = db
    .prepare<[number], { id: number; product_id: number; quantity: number }>(
      "SELECT id, product_id, quantity FROM sales WHERE id = ?"
    )
    .get(input.id);

  if (!existing) {
    throw new DomainError("NOT_FOUND", "Sale not found.");
  }

  const product = getById(db, existing.product_id);
  if (!product) {
    throw new DomainError("NOT_FOUND", "Product not found.");
  }

  const delta = existing.quantity - input.quantity;
  const availableStock = product.quantity + existing.quantity;

  if (product.quantity + delta < 0) {
    throw new DomainError("RULE", `Only ${availableStock} of ${product.name} in stock.`);
  }

  const runTransaction = db.transaction(() => {
    db.prepare<[number, number]>("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(
      delta,
      product.id
    );

    db.prepare<[number, number, string, number]>(
      "UPDATE sales SET quantity = ?, unit_price = ?, sold_at = ? WHERE id = ?"
    ).run(input.quantity, input.unitPrice, input.soldAt, input.id);
  });

  runTransaction();
}

export function deleteSale(db: BetterSqlite3.Database, id: number): void {
  const existing = db
    .prepare<[number], { id: number; product_id: number; quantity: number }>(
      "SELECT id, product_id, quantity FROM sales WHERE id = ?"
    )
    .get(id);

  if (!existing) {
    throw new DomainError("NOT_FOUND", "Sale not found.");
  }

  const runTransaction = db.transaction(() => {
    db.prepare<[number, number]>("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(
      existing.quantity,
      existing.product_id
    );

    db.prepare<[number]>("DELETE FROM sales WHERE id = ?").run(id);
  });

  runTransaction();
}
