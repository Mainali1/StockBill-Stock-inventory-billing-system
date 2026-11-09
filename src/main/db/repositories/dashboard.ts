import type BetterSqlite3 from "better-sqlite3";
import type { InvoiceStatus } from "@shared/ipc/common";
import type { DashboardDto } from "@shared/ipc/reports";
import { buildWeekBars, isDateToday } from "../../domain/dashboard";
import { weekRange } from "../../domain/dates";

export function getDashboardData(db: BetterSqlite3.Database, date: string): DashboardDto {
  // 1. Sales and profit on that date
  const salesRow = db.prepare<[string, string], { totalSales: number; totalProfit: number }>(`
    SELECT
      COALESCE(SUM(quantity * unit_price), 0) AS totalSales,
      COALESCE(SUM(quantity * (unit_price - unit_cost)), 0) AS totalProfit
    FROM sales
    WHERE sold_at >= ? AND sold_at <= ?
  `).get(`${date} 00:00`, `${date} 23:59`);

  // 2. Low-stock items count (products with quantity <= reorder_level and archived = 0)
  const lowStockRow = db.prepare<[], { count: number }>(`
    SELECT COUNT(*) AS count
    FROM products
    WHERE archived = 0 AND quantity <= reorder_level
  `).get();

  // 3. Supplier dues across active (non-archived) suppliers
  const dueRow = db.prepare<[], { totalDue: number }>(`
    SELECT COALESCE(SUM(i.total - i.paid_amount), 0) AS totalDue
    FROM supplier_invoices i
    JOIN suppliers s ON s.id = i.supplier_id
    WHERE s.archived = 0
  `).get();

  // 4. Week bars for the week containing `date`
  const { start, end } = weekRange(date);
  const weekSalesRows = db.prepare<[string, string], { dayDate: string; daySales: number; dayProfit: number }>(`
    SELECT
      substr(sold_at, 1, 10) AS dayDate,
      COALESCE(SUM(quantity * unit_price), 0) AS daySales,
      COALESCE(SUM(quantity * (unit_price - unit_cost)), 0) AS dayProfit
    FROM sales
    WHERE sold_at >= ? AND sold_at <= ?
    GROUP BY dayDate
  `).all(`${start} 00:00`, `${end} 23:59`);

  const week = buildWeekBars(
    date,
    weekSalesRows.map((r) => ({
      date: r.dayDate,
      sales: r.daySales,
      profit: r.dayProfit,
    }))
  );

  // 5. Restock list: up to 4 non-archived products at or below reorder level, lowest quantity first, then name
  const restockRows = db.prepare<[], { productId: number; name: string; quantity: number }>(`
    SELECT
      id AS productId,
      name,
      quantity
    FROM products
    WHERE archived = 0 AND quantity <= reorder_level
    ORDER BY quantity ASC, name COLLATE NOCASE ASC
    LIMIT 4
  `).all();

  // 6. Recent supplier invoices: the last 4 by created_at descending then id descending
  const recentInvoicesRows = db.prepare<
    [],
    {
      id: number;
      supplierId: number;
      invoiceNo: string;
      supplierName: string;
      total: number;
      status: InvoiceStatus;
    }
  >(`
    SELECT
      i.id,
      i.supplier_id AS supplierId,
      i.invoice_no AS invoiceNo,
      s.name AS supplierName,
      i.total,
      CASE WHEN i.paid_amount >= i.total THEN 'PAID' ELSE 'DUE' END AS status
    FROM supplier_invoices i
    JOIN suppliers s ON s.id = i.supplier_id
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT 4
  `).all();

  return {
    date,
    isToday: isDateToday(date),
    sales: salesRow?.totalSales ?? 0,
    profit: salesRow?.totalProfit ?? 0,
    lowStockCount: lowStockRow?.count ?? 0,
    supplierDue: dueRow?.totalDue ?? 0,
    week,
    restock: restockRows,
    recentInvoices: recentInvoicesRows,
  };
}
