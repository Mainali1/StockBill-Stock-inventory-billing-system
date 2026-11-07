import type BetterSqlite3 from "better-sqlite3";
import { DomainError } from "../../domain/errors";
import { nowDbDateTime, isValidDate } from "../../domain/dates";
import { formatCard } from "../../domain/money";
import { getSupplierDetail } from "./suppliersAdmin";
import type { InvoiceDto, InvoiceInput, SupplierDetailDto } from "@shared/ipc/suppliers";

export function createInvoice(
  db: BetterSqlite3.Database,
  input: InvoiceInput
): InvoiceDto {
  const supp = db
    .prepare<[number], { id: number; name: string; archived: number }>(
      "SELECT id, name, archived FROM suppliers WHERE id = ?"
    )
    .get(input.supplierId);

  if (!supp || supp.archived === 1) {
    throw new DomainError("NOT_FOUND", "Supplier not found.");
  }

  const invoiceNo = input.invoiceNo?.trim() ?? "";
  if (invoiceNo.length === 0 || invoiceNo.length > 40) {
    throw new DomainError("VALIDATION", "Invoice number is required.", {
      invoiceNo: "Invoice number is required.",
    });
  }

  const existingInv = db
    .prepare<[number, string], { id: number }>(
      "SELECT id FROM supplier_invoices WHERE supplier_id = ? AND invoice_no = ?"
    )
    .get(input.supplierId, invoiceNo);
  if (existingInv) {
    throw new DomainError(
      "CONFLICT",
      "This supplier already has an invoice with that number.",
      { invoiceNo: "This supplier already has an invoice with that number." }
    );
  }

  if (!input.invoiceDate || !isValidDate(input.invoiceDate)) {
    throw new DomainError("VALIDATION", "Enter a valid date.", {
      invoiceDate: "Enter a valid date.",
    });
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError("VALIDATION", "Add at least one item.", {
      items: "Add at least one item.",
    });
  }

  const productIdsSeen = new Set<number>();
  for (const item of input.items) {
    if (productIdsSeen.has(item.productId)) {
      throw new DomainError(
        "VALIDATION",
        "Each product can appear only once per invoice.",
        { items: "Each product can appear only once per invoice." }
      );
    }
    productIdsSeen.add(item.productId);

    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      throw new DomainError("VALIDATION", "Enter a whole number of 1 or more.", {
        quantity: "Enter a whole number of 1 or more.",
      });
    }

    if (
      typeof item.unitCost !== "number" ||
      !Number.isInteger(item.unitCost) ||
      item.unitCost < 0
    ) {
      throw new DomainError(
        "VALIDATION",
        "Enter an amount of 0 or more, with at most 2 decimals.",
        { unitCost: "Enter an amount of 0 or more, with at most 2 decimals." }
      );
    }
  }

  let total = 0;
  for (const item of input.items) {
    total += item.quantity * item.unitCost;
  }

  if (
    typeof input.paidNow !== "number" ||
    !Number.isInteger(input.paidNow) ||
    input.paidNow < 0 ||
    input.paidNow > total
  ) {
    throw new DomainError(
      "VALIDATION",
      "Amount paid cannot be more than the invoice total.",
      { paidNow: "Amount paid cannot be more than the invoice total." }
    );
  }

  const runTransaction = db.transaction(() => {
    const createdAt = nowDbDateTime();
    const info = db
      .prepare(`
        INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(input.supplierId, invoiceNo, input.invoiceDate, total, input.paidNow, createdAt);

    const invoiceId = Number(info.lastInsertRowid);

    const itemsDto: InvoiceDto["items"] = [];

    const insertItemStmt = db.prepare(`
      INSERT INTO supplier_invoice_items (invoice_id, product_id, quantity, unit_cost)
      VALUES (?, ?, ?, ?)
    `);

    const updateProductStmt = db.prepare(`
      UPDATE products
      SET quantity = quantity + ?, cost = ?
      WHERE id = ? AND archived = 0
    `);

    const getProductStmt = db.prepare<[number], { name: string; archived: number }>(
      "SELECT name, archived FROM products WHERE id = ?"
    );

    for (const item of input.items) {
      const prod = getProductStmt.get(item.productId);
      if (!prod || prod.archived === 1) {
        throw new DomainError("NOT_FOUND", "Product not found.");
      }

      insertItemStmt.run(invoiceId, item.productId, item.quantity, item.unitCost);
      const updateResult = updateProductStmt.run(item.quantity, item.unitCost, item.productId);
      if (updateResult.changes === 0) {
        throw new DomainError("NOT_FOUND", "Product not found.");
      }

      itemsDto.push({
        productId: item.productId,
        productName: prod.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
      });
    }

    const invoiceDto: InvoiceDto = {
      id: invoiceId,
      supplierId: input.supplierId,
      supplierName: supp.name,
      invoiceNo,
      invoiceDate: input.invoiceDate,
      total,
      paidAmount: input.paidNow,
      status: input.paidNow >= total ? "PAID" : "DUE",
      items: itemsDto,
    };

    return invoiceDto;
  });

  return runTransaction();
}

export function recordPayment(
  db: BetterSqlite3.Database,
  input: { supplierId: number; amount: number }
): SupplierDetailDto {
  if (
    typeof input.amount !== "number" ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    throw new DomainError("VALIDATION", "Enter an amount greater than 0.", {
      amount: "Enter an amount greater than 0.",
    });
  }

  const supp = db
    .prepare<[number], { id: number; archived: number }>(
      "SELECT id, archived FROM suppliers WHERE id = ?"
    )
    .get(input.supplierId);

  if (!supp || supp.archived === 1) {
    throw new DomainError("NOT_FOUND", "Supplier not found.");
  }

  const runTransaction = db.transaction(() => {
    const dueRow = db.prepare<[number], { due: number }>(`
      SELECT COALESCE(SUM(total - paid_amount), 0) AS due
      FROM supplier_invoices
      WHERE supplier_id = ?
    `).get(input.supplierId);
    const due = dueRow?.due ?? 0;

    if (input.amount > due) {
      const formattedDue = formatCard(due).replace(/^Rs\.\s*/, "");
      throw new DomainError(
        "RULE",
        `Payment is more than the balance due (Rs. ${formattedDue}).`
      );
    }

    const unpaidInvoices = db.prepare<[number], {
      id: number;
      total: number;
      paid_amount: number;
    }>(`
      SELECT id, total, paid_amount
      FROM supplier_invoices
      WHERE supplier_id = ? AND paid_amount < total
      ORDER BY invoice_date ASC, id ASC
    `).all(input.supplierId);

    let remaining = input.amount;
    const updateInvoiceStmt = db.prepare(`
      UPDATE supplier_invoices
      SET paid_amount = paid_amount + ?
      WHERE id = ?
    `);

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const invoiceDue = inv.total - inv.paid_amount;
      const paymentForInv = Math.min(remaining, invoiceDue);
      updateInvoiceStmt.run(paymentForInv, inv.id);
      remaining -= paymentForInv;
    }

    db.prepare(`
      INSERT INTO supplier_payments (supplier_id, amount, paid_at)
      VALUES (?, ?, ?)
    `).run(input.supplierId, input.amount, nowDbDateTime());

    return getSupplierDetail(db, input.supplierId);
  });

  return runTransaction();
}
