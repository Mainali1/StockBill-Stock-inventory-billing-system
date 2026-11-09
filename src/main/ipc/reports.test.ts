import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/connection";
import { reportsGetHandler } from "./reports";
import type { DuesReportDto, ProfitReportDto, SalesReportDto, StockReportDto } from "@shared/ipc/reports";

describe("REP-1: Reports validation", () => {
  const db = openDatabase(":memory:");

  it("REP-1: rejects reversed ranges, invalid dates and ranges over 366 days", async () => {
    // 1. Invalid date
    const resInvalid = await reportsGetHandler(
      { tab: "sales", from: "invalid-date", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resInvalid.ok).toBe(false);
    if (!resInvalid.ok) {
      expect(resInvalid.error.code).toBe("VALIDATION");
      expect(resInvalid.error.fields?.from).toBe("Enter a valid date.");
    }

    // 2. Reversed range (from > to)
    const resReversed = await reportsGetHandler(
      { tab: "sales", from: "2026-11-05", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resReversed.ok).toBe(false);
    if (!resReversed.ok) {
      expect(resReversed.error.code).toBe("VALIDATION");
      expect(resReversed.error.fields?.from).toBe("Start date must be on or before the end date.");
    }

    // 3. Range over 366 days
    const resTooLong = await reportsGetHandler(
      { tab: "sales", from: "2025-01-01", to: "2026-01-05" }, // 370 days
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resTooLong.ok).toBe(false);
    if (!resTooLong.ok) {
      expect(resTooLong.error.code).toBe("VALIDATION");
      expect(resTooLong.error.fields?.to).toBe("Choose a range of 366 days or less.");
    }
  });
});

describe("REP-2: Sales report handler", () => {
  it("REP-2: by-day buckets are zero-filled and by-hour appears only for a single day in reports:get", async () => {
    const db = openDatabase(":memory:");
    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier')").run();
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Rice', 'Grocery', 8000, 10000, 50, 10, 0),
             (2, 'Oil', 'Grocery', 20000, 25000, 50, 10, 0)
    `).run();

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 2, 10000, 8000, '2026-11-03 09:15'),
             (2, 1, 25000, 20000, '2026-11-03 14:30'),
             (1, 1, 10000, 8000, '2026-11-05 10:00')
    `).run();

    const resMulti = await reportsGetHandler(
      { tab: "sales", from: "2026-11-02", to: "2026-11-04" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resMulti.ok).toBe(true);
    if (resMulti.ok) {
      const data = resMulti.data as SalesReportDto;
      expect(data.tab).toBe("sales");
      expect(data.total).toBe(45000);
      expect(data.count).toBe(2);
      expect(data.byDay).toHaveLength(3);
      expect(data.byHour).toBeNull();
    }

    const resSingle = await reportsGetHandler(
      { tab: "sales", from: "2026-11-03", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(resSingle.ok).toBe(true);
    if (resSingle.ok) {
      const data = resSingle.data as SalesReportDto;
      expect(data.tab).toBe("sales");
      expect(data.total).toBe(45000);
      expect(data.count).toBe(2);
      expect(data.byDay).toHaveLength(1);
      expect(data.byHour).toHaveLength(24);
      expect(data.byHour?.[9]).toBe(20000);
      expect(data.byHour?.[14]).toBe(25000);
    }
  });
});

describe("REP-3: Profit report handler", () => {
  it("REP-3: gross profit equals sales minus cost of goods in reports:get", async () => {
    const db = openDatabase(":memory:");
    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier')").run();
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Item A', 'Cat', 6000, 10000, 50, 10, 0),
             (2, 'Item B', 'Cat', 20000, 25000, 50, 10, 0),
             (3, 'Item C', 'Cat', 10000, 9000, 50, 10, 0)
    `).run();

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 4, 10000, 6000, '2026-11-03 10:00'),
             (2, 2, 25000, 20000, '2026-11-03 11:00'),
             (3, 1, 9000, 10000, '2026-11-03 12:00')
    `).run();

    const res = await reportsGetHandler(
      { tab: "profit", from: "2026-11-03", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as ProfitReportDto;
      expect(data.tab).toBe("profit");
      expect(data.totalSales).toBe(99000);
      expect(data.costOfGoods).toBe(74000);
      expect(data.grossProfit).toBe(25000);
      expect(data.count).toBe(3);
      expect(data.byDay).toHaveLength(1);
      expect(data.top).toHaveLength(3);
      expect(data.top[0]?.name).toBe("Item B");
      expect(data.top[1]?.name).toBe("Item A");
      expect(data.top[2]?.name).toBe("Item C");
    }
  });
});

describe("REP-4: Stock report handler", () => {
  it("REP-4: stock valuation is the sum of quantity times cost; low list includes OUT in reports:get", async () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (id, name, category, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Rice', 'Grocery', 98000, 115000, 24, 10, 0),
             (2, 'Tea', 'Grocery', 23500, 28000, 2, 8, 0),
             (3, 'Salt', 'Grocery', 2200, 2800, 0, 15, 0),
             (4, 'Archived Item', 'Other', 5000, 6000, 1, 5, 1)
    `).run();

    const res = await reportsGetHandler(
      { tab: "stock", from: "2026-11-03", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as StockReportDto;
      expect(data.tab).toBe("stock");
      expect(data.valuation).toBe(2352000 + 47000);
      expect(data.productCount).toBe(3);
      expect(data.low).toHaveLength(2);

      const salt = data.low.find((p) => p.name === "Salt");
      expect(salt).toBeDefined();
      expect(salt?.quantity).toBe(0);
      expect(salt?.status).toBe("OUT");

      const tea = data.low.find((p) => p.name === "Tea");
      expect(tea).toBeDefined();
      expect(tea?.quantity).toBe(2);
      expect(tea?.status).toBe("LOW");
    }
  });
});

describe("REP-5: Supplier dues report", () => {
  it("REP-5: dues report lists only suppliers owed and totals correctly", async () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO suppliers (id, name, archived)
      VALUES (1, 'Koshi Wholesale', 0),
             (2, 'Himal Traders', 0),
             (3, 'Everest Oil Depot', 0),
             (4, 'Archived Supplier', 1)
    `).run();

    db.prepare(`
      INSERT INTO supplier_invoices (id, supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (1, 1, 'KW-1', '2026-10-01', 30000, 10000, '2026-10-01 10:00'), -- due: 20000
             (2, 2, 'HT-1', '2026-10-02', 50000, 50000, '2026-10-02 10:00'), -- due: 0 (settled)
             (3, 3, 'EOD-1', '2026-10-03', 45000, 0, '2026-10-03 10:00'),     -- due: 45000
             (4, 4, 'ARC-1', '2026-10-04', 99000, 0, '2026-10-04 10:00')      -- archived
    `).run();

    const res = await reportsGetHandler(
      { tab: "dues", from: "2026-11-03", to: "2026-11-03" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as DuesReportDto;
      expect(data.tab).toBe("dues");
      expect(data.totalDue).toBe(65000);
      expect(data.suppliers).toHaveLength(2);

      // Only suppliers with due > 0: Everest Oil Depot (45,000) and Koshi Wholesale (20,000)
      const eod = data.suppliers.find((s) => s.name === "Everest Oil Depot");
      expect(eod).toBeDefined();
      expect(eod?.due).toBe(45000);

      const kw = data.suppliers.find((s) => s.name === "Koshi Wholesale");
      expect(kw).toBeDefined();
      expect(kw?.due).toBe(20000);

      // Himal Traders has due 0, so not in suppliers list
      expect(data.suppliers.find((s) => s.name === "Himal Traders")).toBeUndefined();
      // Archived supplier not listed
      expect(data.suppliers.find((s) => s.name === "Archived Supplier")).toBeUndefined();
    }
  });
});
