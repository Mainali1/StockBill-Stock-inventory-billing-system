import type BetterSqlite3 from "better-sqlite3";
import { escapeLike } from "../sql";
import { DomainError } from "../../domain/errors";
import type { SupplierDetailDto, SupplierInput, SupplierSummaryDto } from "@shared/ipc/suppliers";

export function listSuppliers(
  db: BetterSqlite3.Database,
  filter: { search?: string }
): { suppliers: SupplierSummaryDto[]; totalDue: number } {
  let query = `
    SELECT
      s.id,
      s.name,
      s.supplies,
      MAX(i.invoice_date) AS lastInvoiceDate,
      COALESCE(SUM(i.total - i.paid_amount), 0) AS due
    FROM suppliers s
    LEFT JOIN supplier_invoices i ON i.supplier_id = s.id
    WHERE s.archived = 0
  `;
  const params: string[] = [];

  if (filter.search && filter.search.trim().length > 0) {
    const escaped = escapeLike(filter.search.trim());
    query += ` AND (s.name LIKE ? ESCAPE '\\' OR (s.supplies IS NOT NULL AND s.supplies LIKE ? ESCAPE '\\'))`;
    const pattern = `%${escaped}%`;
    params.push(pattern, pattern);
  }

  query += ` GROUP BY s.id ORDER BY s.name COLLATE NOCASE ASC`;

  const rows = db.prepare(query).all(...params) as {
    id: number;
    name: string;
    supplies: string | null;
    lastInvoiceDate: string | null;
    due: number;
  }[];

  const totalDue = rows.reduce((acc, r) => acc + (r.due ?? 0), 0);

  return {
    suppliers: rows.map((r) => ({
      id: r.id,
      name: r.name,
      supplies: r.supplies,
      lastInvoiceDate: r.lastInvoiceDate,
      due: r.due ?? 0,
    })),
    totalDue,
  };
}

export function saveSupplier(
  db: BetterSqlite3.Database,
  input: SupplierInput
): SupplierDetailDto {
  const fields: Record<string, string> = {};

  const name = input.name?.trim() ?? "";
  if (name.length === 0 || name.length > 80) {
    fields["name"] = "Name is required.";
  }

  const contactName = input.contactName?.trim() ? input.contactName.trim() : null;
  const phone = input.phone?.trim() ? input.phone.trim() : null;
  const address = input.address?.trim() ? input.address.trim() : null;
  const supplies = input.supplies?.trim() ? input.supplies.trim() : null;

  if (Object.keys(fields).length > 0) {
    throw new DomainError("VALIDATION", fields["name"] ?? "Validation failed.", fields);
  }

  if (name.length > 0) {
    const existing = input.id
      ? db.prepare<[string, number], { id: number }>(
          "SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE AND id != ?"
        ).get(name, input.id)
      : db.prepare<[string], { id: number }>(
          "SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE"
        ).get(name);

    if (existing) {
      throw new DomainError("CONFLICT", "A supplier with that name already exists.", {
        name: "A supplier with that name already exists.",
      });
    }
  }

  let savedId: number;
  if (input.id) {
    const existing = db
      .prepare<[number], { archived: number }>("SELECT archived FROM suppliers WHERE id = ?")
      .get(input.id);
    if (!existing || existing.archived === 1) {
      throw new DomainError("NOT_FOUND", "Supplier not found.");
    }

    db.prepare(`
      UPDATE suppliers
      SET name = ?, contact_name = ?, phone = ?, address = ?, supplies = ?
      WHERE id = ?
    `).run(name, contactName, phone, address, supplies, input.id);
    savedId = input.id;
  } else {
    const info = db.prepare(`
      INSERT INTO suppliers (name, contact_name, phone, address, supplies, archived)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(name, contactName, phone, address, supplies);
    savedId = Number(info.lastInsertRowid);
  }

  return getSupplierDetail(db, savedId);
}

export function deleteSupplier(
  db: BetterSqlite3.Database,
  id: number
): { result: "deleted" | "archived" } {
  const existing = db
    .prepare<[number], { id: number; archived: number }>("SELECT id, archived FROM suppliers WHERE id = ?")
    .get(id);

  if (!existing || existing.archived === 1) {
    throw new DomainError("NOT_FOUND", "Supplier not found.");
  }

  const invoicesCount = db
    .prepare<[number], { count: number }>("SELECT COUNT(*) AS count FROM supplier_invoices WHERE supplier_id = ?")
    .get(id)?.count ?? 0;

  const productsCount = db
    .prepare<[number], { count: number }>("SELECT COUNT(*) AS count FROM products WHERE supplier_id = ?")
    .get(id)?.count ?? 0;

  if (invoicesCount > 0 || productsCount > 0) {
    db.prepare("UPDATE suppliers SET archived = 1 WHERE id = ?").run(id);
    return { result: "archived" };
  } else {
    db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    return { result: "deleted" };
  }
}

export function getSupplierDetail(
  db: BetterSqlite3.Database,
  id: number
): SupplierDetailDto {
  const supp = db.prepare<[number], {
    id: number;
    name: string;
    contact_name: string | null;
    phone: string | null;
    address: string | null;
    supplies: string | null;
    archived: number;
  }>("SELECT id, name, contact_name, phone, address, supplies, archived FROM suppliers WHERE id = ?").get(id);

  if (!supp || supp.archived === 1) {
    throw new DomainError("NOT_FOUND", "Supplier not found.");
  }

  const dueRow = db.prepare<[number], { due: number }>(`
    SELECT COALESCE(SUM(total - paid_amount), 0) AS due
    FROM supplier_invoices
    WHERE supplier_id = ?
  `).get(id);
  const due = dueRow?.due ?? 0;

  const invoicesRows = db.prepare<[number], {
    id: number;
    supplier_id: number;
    invoice_no: string;
    invoice_date: string;
    total: number;
    paid_amount: number;
  }>(`
    SELECT id, supplier_id, invoice_no, invoice_date, total, paid_amount
    FROM supplier_invoices
    WHERE supplier_id = ?
    ORDER BY invoice_date DESC, id DESC
  `).all(id);

  const invoices = invoicesRows.map((inv) => {
    const itemsRows = db.prepare<[number], {
      product_id: number;
      product_name: string;
      quantity: number;
      unit_cost: number;
    }>(`
      SELECT
        item.product_id,
        p.name AS product_name,
        item.quantity,
        item.unit_cost
      FROM supplier_invoice_items item
      JOIN products p ON p.id = item.product_id
      WHERE item.invoice_id = ?
      ORDER BY item.id ASC
    `).all(inv.id);

    return {
      id: inv.id,
      supplierId: inv.supplier_id,
      supplierName: supp.name,
      invoiceNo: inv.invoice_no,
      invoiceDate: inv.invoice_date,
      total: inv.total,
      paidAmount: inv.paid_amount,
      status: (inv.paid_amount >= inv.total ? "PAID" : "DUE") as "PAID" | "DUE",
      items: itemsRows.map((it) => ({
        productId: it.product_id,
        productName: it.product_name,
        quantity: it.quantity,
        unitCost: it.unit_cost,
      })),
    };
  });

  return {
    id: supp.id,
    name: supp.name,
    contactName: supp.contact_name,
    phone: supp.phone,
    address: supp.address,
    supplies: supp.supplies,
    due,
    invoices,
  };
}
