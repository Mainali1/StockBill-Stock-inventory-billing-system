import type BetterSqlite3 from "better-sqlite3";
import { escapeLike } from "../sql";
import { productStatus } from "../../domain/stock";
import { DomainError } from "../../domain/errors";
import type { ProductDto, ProductInput } from "@shared/ipc/inventory";

export interface ListFilter {
  search?: string;
  category?: string | null;
  lowOnly?: boolean;
}

export function list(db: BetterSqlite3.Database, filter: ListFilter): ProductDto[] {
  let query = `
    SELECT
      p.id,
      p.name,
      p.code,
      p.category,
      p.supplier_id AS supplierId,
      s.name AS supplierName,
      p.cost,
      p.price,
      p.quantity,
      p.reorder_level AS reorderLevel
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.archived = 0
  `;
  const params: (string | number)[] = [];

  if (filter.search && filter.search.trim().length > 0) {
    const escaped = escapeLike(filter.search.trim());
    query += ` AND (p.name LIKE ? ESCAPE '\\' OR p.code LIKE ? ESCAPE '\\')`;
    const pattern = `%${escaped}%`;
    params.push(pattern, pattern);
  }

  if (filter.category && filter.category.trim().length > 0) {
    query += ` AND p.category = ?`;
    params.push(filter.category.trim());
  }

  if (filter.lowOnly) {
    query += ` AND p.quantity <= p.reorder_level`;
  }

  query += ` ORDER BY p.name COLLATE NOCASE ASC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as {
    id: number;
    name: string;
    code: string | null;
    category: string;
    supplierId: number | null;
    supplierName: string | null;
    cost: number;
    price: number;
    quantity: number;
    reorderLevel: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    category: r.category,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    cost: r.cost,
    price: r.price,
    quantity: r.quantity,
    reorderLevel: r.reorderLevel,
    status: productStatus(r.quantity, r.reorderLevel),
  }));
}

export function listCategories(db: BetterSqlite3.Database): string[] {
  const stmt = db.prepare(`
    SELECT DISTINCT category
    FROM products
    WHERE archived = 0
    ORDER BY category COLLATE NOCASE ASC
  `);
  const rows = stmt.all() as { category: string }[];
  return rows.map((r) => r.category);
}

export function getProductDtoById(db: BetterSqlite3.Database, id: number): ProductDto | null {
  const stmt = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.code,
      p.category,
      p.supplier_id AS supplierId,
      s.name AS supplierName,
      p.cost,
      p.price,
      p.quantity,
      p.reorder_level AS reorderLevel
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ? AND p.archived = 0
  `);
  const r = stmt.get(id) as {
    id: number;
    name: string;
    code: string | null;
    category: string;
    supplierId: number | null;
    supplierName: string | null;
    cost: number;
    price: number;
    quantity: number;
    reorderLevel: number;
  } | undefined;

  if (!r) return null;

  return {
    id: r.id,
    name: r.name,
    code: r.code,
    category: r.category,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    cost: r.cost,
    price: r.price,
    quantity: r.quantity,
    reorderLevel: r.reorderLevel,
    status: productStatus(r.quantity, r.reorderLevel),
  };
}

export function saveProduct(
  db: BetterSqlite3.Database,
  input: ProductInput,
): { product: ProductDto; warnings: string[] } {
  const fields: Record<string, string> = {};

  const name = input.name?.trim() ?? "";
  if (name.length === 0 || name.length > 80) {
    fields["name"] = "Name is required.";
  }

  const category = input.category?.trim() ?? "";
  if (category.length === 0 || category.length > 40) {
    fields["category"] = "Category is required.";
  }

  let code: string | null = input.code?.trim() ?? null;
  if (code !== null && code.length === 0) {
    code = null;
  }
  if (code !== null && code.length > 40) {
    fields["code"] = "Code must be at most 40 characters.";
  }

  if (
    typeof input.cost !== "number" ||
    !Number.isInteger(input.cost) ||
    input.cost < 0
  ) {
    fields["cost"] = "Enter an amount of 0 or more, with at most 2 decimals.";
  }

  if (
    typeof input.price !== "number" ||
    !Number.isInteger(input.price) ||
    input.price < 0
  ) {
    fields["price"] = "Enter an amount of 0 or more, with at most 2 decimals.";
  }

  if (
    typeof input.quantity !== "number" ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 0
  ) {
    fields["quantity"] = "Enter a whole number of 0 or more.";
  }

  if (
    typeof input.reorderLevel !== "number" ||
    !Number.isInteger(input.reorderLevel) ||
    input.reorderLevel < 0
  ) {
    fields["reorderLevel"] = "Enter a whole number of 0 or more.";
  }

  if (input.supplierId !== null && input.supplierId !== undefined) {
    const supp = db
      .prepare<[number], { id: number; archived: number }>(
        "SELECT id, archived FROM suppliers WHERE id = ?"
      )
      .get(input.supplierId);
    if (!supp || supp.archived === 1) {
      fields["supplierId"] = "Choose a supplier from the list.";
    }
  }

  if (code !== null) {
    const existing = input.id
      ? (db
          .prepare<[string, number], { name: string }>(
            "SELECT name FROM products WHERE code = ? AND id != ?"
          )
          .get(code, input.id))
      : (db
          .prepare<[string], { name: string }>(
            "SELECT name FROM products WHERE code = ?"
          )
          .get(code));

    if (existing) {
      throw new DomainError(
        "CONFLICT",
        `That code is already used by ${existing.name}.`,
        { code: `That code is already used by ${existing.name}.` }
      );
    }
  }

  if (Object.keys(fields).length > 0) {
    const firstMessage = Object.values(fields)[0] ?? "Validation failed.";
    throw new DomainError("VALIDATION", firstMessage, fields);
  }

  const warnings: string[] = [];
  if (input.price < input.cost) {
    warnings.push("Price is lower than cost. You will lose money on each sale.");
  }

  let savedId: number;

  if (input.id) {
    const existing = db
      .prepare<[number], { archived: number }>(
        "SELECT archived FROM products WHERE id = ?"
      )
      .get(input.id);
    if (!existing || existing.archived === 1) {
      throw new DomainError("NOT_FOUND", "Product not found.");
    }

    db.prepare(`
      UPDATE products
      SET name = ?, code = ?, category = ?, supplier_id = ?, cost = ?, price = ?, quantity = ?, reorder_level = ?
      WHERE id = ?
    `).run(
      name,
      code,
      category,
      input.supplierId ?? null,
      input.cost,
      input.price,
      input.quantity,
      input.reorderLevel,
      input.id
    );
    savedId = input.id;
  } else {
    const info = db.prepare(`
      INSERT INTO products (name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      name,
      code,
      category,
      input.supplierId ?? null,
      input.cost,
      input.price,
      input.quantity,
      input.reorderLevel
    );
    savedId = Number(info.lastInsertRowid);
  }

  const product = getProductDtoById(db, savedId);
  if (!product) {
    throw new DomainError("INTERNAL", "Something went wrong. Please try again.");
  }

  return { product, warnings };
}

export function deleteProduct(
  db: BetterSqlite3.Database,
  id: number
): { result: "deleted" | "archived" } {
  const existing = db
    .prepare<[number], { id: number; archived: number }>(
      "SELECT id, archived FROM products WHERE id = ?"
    )
    .get(id);

  if (!existing || existing.archived === 1) {
    throw new DomainError("NOT_FOUND", "Product not found.");
  }

  const salesCount = (
    db.prepare<[number], { count: number }>(
      "SELECT COUNT(*) AS count FROM sales WHERE product_id = ?"
    ).get(id)?.count ?? 0
  );

  const invoiceItemsCount = (
    db.prepare<[number], { count: number }>(
      "SELECT COUNT(*) AS count FROM supplier_invoice_items WHERE product_id = ?"
    ).get(id)?.count ?? 0
  );

  if (salesCount > 0 || invoiceItemsCount > 0) {
    db.prepare("UPDATE products SET archived = 1 WHERE id = ?").run(id);
    return { result: "archived" };
  } else {
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    return { result: "deleted" };
  }
}
