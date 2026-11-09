import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/connection";
import { setDatabase } from "./handle";
import { setSession } from "../session";
import type BetterSqlite3 from "better-sqlite3";
import { getDashboardHandler } from "./dashboard";
import { listSuppliers } from "../db/repositories/suppliersAdmin";

describe("DASH-1: Dashboard core metrics", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });
  });

  it("DASH-1: sales and profit are for the selected date only", async () => {
    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Product 1', 'Cat', 6000, 10000, 50, 10, 0),
             (2, 'Product 2', 'Cat', 20000, 25000, 50, 10, 0)
    `).run();

    // Sales on selected date 2026-11-03:
    // 2 x Product 1 (cost 60, price 100): sales 200, profit (100 - 60) * 2 = 80
    // 1 x Product 2 (cost 200, price 250): sales 250, profit (250 - 200) * 1 = 50
    // Total sales = 45000 paisa, profit = 13000 paisa
    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 2, 10000, 6000, '2026-11-03 10:15'),
             (2, 1, 25000, 20000, '2026-11-03 14:30')
    `).run();

    // Sales on another date 2026-11-04:
    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 5, 10000, 6000, '2026-11-04 09:00')
    `).run();

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.date).toBe("2026-11-03");
    expect(res.data.sales).toBe(45000);
    expect(res.data.profit).toBe(13000);
  });

  it("DASH-1: low-stock count includes out-of-stock products and excludes archived ones", async () => {
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'In Stock', 'Cat', 1000, 2000, 20, 10, 0),
             (2, 'Low Stock', 'Cat', 1000, 2000, 5, 10, 0),
             (3, 'At Reorder', 'Cat', 1000, 2000, 10, 10, 0),
             (4, 'Out of Stock', 'Cat', 1000, 2000, 0, 10, 0),
             (5, 'Archived Low Stock', 'Cat', 1000, 2000, 2, 10, 1),
             (6, 'Archived Out of Stock', 'Cat', 1000, 2000, 0, 10, 1)
    `).run();

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.lowStockCount).toBe(3);
  });

  it("DASH-1: supplier due matches the suppliers list", async () => {
    db.prepare(`
      INSERT INTO suppliers (id, name, archived)
      VALUES (1, 'Supplier Active 1', 0),
             (2, 'Supplier Active 2', 0),
             (3, 'Supplier Archived', 1)
    `).run();

    db.prepare(`
      INSERT INTO supplier_invoices (id, supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (1, 1, 'INV-1', '2026-10-01', 30000, 10000, '2026-10-01 10:00'),
             (2, 2, 'INV-2', '2026-10-02', 50000, 50000, '2026-10-02 11:00'),
             (3, 2, 'INV-3', '2026-10-03', 40000, 0, '2026-10-03 12:00'),
             (4, 3, 'INV-4', '2026-10-04', 99000, 0, '2026-10-04 13:00')
    `).run();

    const suppliersList = listSuppliers(db, {});
    const expectedDue = suppliersList.totalDue;
    expect(expectedDue).toBe(60000);

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.supplierDue).toBe(expectedDue);
  });

  it("DASH-2: week bars run Sunday to Saturday for the week containing the date", async () => {
    // 2026-11-03 (Tuesday)
    const resTue = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resTue.ok).toBe(true);
    if (!resTue.ok) return;

    expect(resTue.data.week).toHaveLength(7);
    expect(resTue.data.week[0]?.date).toBe("2026-11-01");
    expect(resTue.data.week[0]?.label).toBe("Sun");
    expect(resTue.data.week[6]?.date).toBe("2026-11-07");
    expect(resTue.data.week[6]?.label).toBe("Sat");

    // 2026-11-01 (Sunday)
    const resSun = await getDashboardHandler(
      { date: "2026-11-01" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resSun.ok).toBe(true);
    if (!resSun.ok) return;
    expect(resSun.data.week[0]?.date).toBe("2026-11-01");
    expect(resSun.data.week[6]?.date).toBe("2026-11-07");

    // 2026-11-07 (Saturday)
    const resSat = await getDashboardHandler(
      { date: "2026-11-07" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resSat.ok).toBe(true);
    if (!resSat.ok) return;
    expect(resSat.data.week[0]?.date).toBe("2026-11-01");
    expect(resSat.data.week[6]?.date).toBe("2026-11-07");
  });

  it("DASH-2: days with no sales are zero", async () => {
    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Product 1', 'Cat', 800, 1000, 50, 10, 0)
    `).run();

    // Sale on 2026-11-03 (Tue): qty 2 => sales 2000, cost 1600, profit 400
    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 2, 1000, 800, '2026-11-03 14:00')
    `).run();

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.week).toHaveLength(7);
    const tue = res.data.week.find((w) => w.date === "2026-11-03");
    expect(tue).toBeDefined();
    expect(tue?.sales).toBe(2000);
    expect(tue?.profit).toBe(400);

    const nonTueDays = res.data.week.filter((w) => w.date !== "2026-11-03");
    expect(nonTueDays).toHaveLength(6);
    for (const d of nonTueDays) {
      expect(d.sales).toBe(0);
      expect(d.profit).toBe(0);
    }
  });

  it("DASH-3: restock list is limited to 4 and ordered by quantity then name", async () => {
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Prod A', 'Cat', 100, 200, 5, 10, 0),
             (2, 'Prod D', 'Cat', 100, 200, 0, 10, 0),
             (3, 'Prod B', 'Cat', 100, 200, 0, 15, 0),
             (4, 'Prod C', 'Cat', 100, 200, 2, 8, 0),
             (5, 'Prod E', 'Cat', 100, 200, 1, 5, 0),
             (6, 'Prod F', 'Cat', 100, 200, 8, 10, 0),
             (7, 'Prod Archived', 'Cat', 100, 200, 0, 10, 1),
             (8, 'Prod Sufficient', 'Cat', 100, 200, 50, 10, 0)
    `).run();

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.restock).toHaveLength(4);
    // Order: lowest quantity first, ties by name
    expect(res.data.restock[0]).toEqual({ productId: 3, name: "Prod B", quantity: 0 });
    expect(res.data.restock[1]).toEqual({ productId: 2, name: "Prod D", quantity: 0 });
    expect(res.data.restock[2]).toEqual({ productId: 5, name: "Prod E", quantity: 1 });
    expect(res.data.restock[3]).toEqual({ productId: 4, name: "Prod C", quantity: 2 });
  });

  it("DASH-4: recent invoices are the last 4 by creation", async () => {
    db.prepare(`
      INSERT INTO suppliers (id, name)
      VALUES (1, 'Koshi Wholesale'), (2, 'Everest Oil Depot')
    `).run();

    db.prepare(`
      INSERT INTO supplier_invoices (id, supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (1, 1, 'KW-001', '2026-10-01', 10000, 10000, '2026-10-01 09:00'),
             (2, 2, 'EOD-002', '2026-10-02', 20000, 10000, '2026-10-02 10:00'),
             (3, 1, 'KW-003', '2026-10-03', 30000, 0, '2026-10-03 11:00'),
             (4, 2, 'EOD-004', '2026-10-04', 40000, 40000, '2026-10-04 12:00'),
             (5, 1, 'KW-005', '2026-10-05', 50000, 0, '2026-10-05 13:00')
    `).run();

    const res = await getDashboardHandler(
      { date: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.recentInvoices).toHaveLength(4);
    expect(res.data.recentInvoices[0]).toEqual({
      id: 5,
      supplierId: 1,
      invoiceNo: "KW-005",
      supplierName: "Koshi Wholesale",
      total: 50000,
      status: "DUE",
    });
    expect(res.data.recentInvoices[1]).toEqual({
      id: 4,
      supplierId: 2,
      invoiceNo: "EOD-004",
      supplierName: "Everest Oil Depot",
      total: 40000,
      status: "PAID",
    });
    expect(res.data.recentInvoices[2]).toEqual({
      id: 3,
      supplierId: 1,
      invoiceNo: "KW-003",
      supplierName: "Koshi Wholesale",
      total: 30000,
      status: "DUE",
    });
    expect(res.data.recentInvoices[3]).toEqual({
      id: 2,
      supplierId: 2,
      invoiceNo: "EOD-002",
      supplierName: "Everest Oil Depot",
      total: 20000,
      status: "DUE",
    });
  });
});
