import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/connection";
import { setDatabase } from "./handle";
import { setSession } from "../session";
import type BetterSqlite3 from "better-sqlite3";

describe("SAL-1: Product picker", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });

    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    const insertProd = db.prepare(`
      INSERT INTO products (id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);

    insertProd.run(1, "Basmati Rice 5kg", "RICE5", "Grocery", 98000, 115000, 24, 10, 0);
    insertProd.run(2, "Lentils 1kg", null, "Grocery", 14000, 17000, 0, 15, 0);
    insertProd.run(3, "Notebook A4", "NOTE1", "Stationery", 7200, 9000, 5, 15, 0);
    insertProd.run(4, "Archived Item", "ARCH1", "Grocery", 1000, 2000, 10, 5, 1);
  });

  it("SAL-1: picker returns non-archived products and filters by search and category", async () => {
    const { pickerHandler } = await import("./sales");
    const res = await pickerHandler({ search: "rice", category: "Grocery" }, { db, session: { userId: 1, username: "admin" } });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.products.length).toBe(1);
    expect(res.data.products[0]?.name).toBe("Basmati Rice 5kg");
    expect(res.data.categories).toContain("Grocery");
    expect(res.data.categories).toContain("Stationery");
    expect(res.data.categories).not.toContain("Archived");
  });

  it("SAL-1: picker returns out-of-stock products", async () => {
    const { pickerHandler } = await import("./sales");
    const res = await pickerHandler({}, { db, session: { userId: 1, username: "admin" } });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const outItem = res.data.products.find((p) => p.name === "Lentils 1kg");
    expect(outItem).toBeDefined();
    expect(outItem?.quantity).toBe(0);

    const archItem = res.data.products.find((p) => p.name === "Archived Item");
    expect(archItem).toBeUndefined();
  });
});

describe("SAL-2: Save sales transaction, stock decrement, and oversell guards", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });

    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    const insertProd = db.prepare(`
      INSERT INTO products (id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);

    insertProd.run(1, "Basmati Rice 5kg", "RICE5", "Grocery", 98000, 115000, 24, 10, 0);
    insertProd.run(2, "Lentils 1kg", null, "Grocery", 14000, 17000, 5, 15, 0);
    insertProd.run(3, "Archived Item", "ARCH1", "Grocery", 1000, 2000, 10, 5, 1);
  });

  it("SAL-2: save writes one row per line with the chosen date-time", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 14:30",
        lines: [
          { productId: 1, quantity: 2, unitPrice: 115000 },
          { productId: 2, quantity: 1, unitPrice: 17000 },
        ],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    const rows = db.prepare("SELECT * FROM sales ORDER BY id ASC").all() as {
      id: number;
      product_id: number;
      quantity: number;
      unit_price: number;
      unit_cost: number;
      sold_at: string;
    }[];

    expect(rows.length).toBe(2);
    expect(rows[0]?.sold_at).toBe("2026-11-03 14:30");
    expect(rows[0]?.product_id).toBe(1);
    expect(rows[0]?.quantity).toBe(2);
    expect(rows[1]?.sold_at).toBe("2026-11-03 14:30");
    expect(rows[1]?.product_id).toBe(2);
  });

  it("SAL-2: save snapshots unit price from the line and unit cost from the product", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [{ productId: 1, quantity: 3, unitPrice: 120000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    const row = db.prepare("SELECT * FROM sales WHERE product_id = 1").get() as {
      unit_price: number;
      unit_cost: number;
    };
    expect(row.unit_price).toBe(120000);
    expect(row.unit_cost).toBe(98000);
  });

  it("SAL-2: save decrements stock", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [{ productId: 1, quantity: 4, unitPrice: 115000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(true);
    const prod = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prod.quantity).toBe(20);
  });

  it("SAL-2: refuses to sell more than stock and saves nothing", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [
          { productId: 1, quantity: 2, unitPrice: 115000 },
          { productId: 2, quantity: 6, unitPrice: 17000 },
        ],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;

    expect(res.error.code).toBe("RULE");
    expect(res.error.message).toBe("Only 5 of Lentils 1kg in stock.");

    const salesCount = (db.prepare("SELECT COUNT(*) as cnt FROM sales").get() as { cnt: number }).cnt;
    expect(salesCount).toBe(0);

    const prod1 = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prod1.quantity).toBe(24);
  });

  it("SAL-2: two lines of the same product are checked against the summed quantity", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [
          { productId: 2, quantity: 3, unitPrice: 17000 },
          { productId: 2, quantity: 3, unitPrice: 16000 },
        ],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;

    expect(res.error.code).toBe("RULE");
    expect(res.error.message).toBe("Only 5 of Lentils 1kg in stock.");

    const salesCount = (db.prepare("SELECT COUNT(*) as cnt FROM sales").get() as { cnt: number }).cnt;
    expect(salesCount).toBe(0);
  });

  it("SAL-2: rejects invalid date-time, empty lines, zero quantity", async () => {
    const { saveSaleHandler } = await import("./sales");

    const res1 = await saveSaleHandler(
      {
        soldAt: "2026-02-30 10:00",
        lines: [{ productId: 1, quantity: 1, unitPrice: 115000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error.message).toMatch(/valid date and time/i);
    }

    const res2 = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [],
      },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.message).toMatch(/at least one item/i);
    }

    const res3 = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [{ productId: 1, quantity: 0, unitPrice: 115000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res3.ok).toBe(false);
    if (!res3.ok) {
      expect(res3.error.code).toBe("VALIDATION");
    }
  });

  it("SAL-2: archived product cannot be sold", async () => {
    const { saveSaleHandler } = await import("./sales");
    const res = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [{ productId: 3, quantity: 1, unitPrice: 2000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("SAL-4: Edit and delete sale rows with stock restoration", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });

    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    const insertProd = db.prepare(`
      INSERT INTO products (id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);

    insertProd.run(1, "Basmati Rice 5kg", "RICE5", "Grocery", 98000, 115000, 20, 10, 0);
  });

  it("SAL-4: editing quantity applies the stock difference", async () => {
    const { updateSaleHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (id, product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (10, 1, 5, 115000, 98000, '2026-11-03 10:00')
    `).run();

    const res = await updateSaleHandler(
      { id: 10, quantity: 3, unitPrice: 115000, soldAt: "2026-11-03 10:00" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);

    const prod = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prod.quantity).toBe(22);

    const sale = db.prepare("SELECT quantity FROM sales WHERE id = 10").get() as { quantity: number };
    expect(sale.quantity).toBe(3);
  });

  it("SAL-4: editing to a quantity above available stock is rejected", async () => {
    const { updateSaleHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (id, product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (10, 1, 5, 115000, 98000, '2026-11-03 10:00')
    `).run();

    const res = await updateSaleHandler(
      { id: 10, quantity: 26, unitPrice: 115000, soldAt: "2026-11-03 10:00" },
      { db, session: { userId: 1, username: "admin" } }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("RULE");
      expect(res.error.message).toBe("Only 25 of Basmati Rice 5kg in stock.");
    }

    const prod = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prod.quantity).toBe(20);
    const sale = db.prepare("SELECT quantity FROM sales WHERE id = 10").get() as { quantity: number };
    expect(sale.quantity).toBe(5);
  });

  it("SAL-4: editing the date-time moves the row to another day", async () => {
    const { updateSaleHandler, getDaySalesHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (id, product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (10, 1, 2, 115000, 98000, '2026-11-03 10:00')
    `).run();

    const res = await updateSaleHandler(
      { id: 10, quantity: 2, unitPrice: 115000, soldAt: "2026-11-05 15:30" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);

    const day1 = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    if (day1.ok) expect(day1.data.count).toBe(0);

    const day2 = await getDaySalesHandler({ date: "2026-11-05" }, { db, session: { userId: 1, username: "admin" } });
    if (day2.ok) {
      expect(day2.data.count).toBe(1);
      expect(day2.data.rows[0]?.soldAt).toBe("2026-11-05 15:30");
    }
  });

  it("SAL-4: deleting restores stock exactly once; deleting twice returns NOT_FOUND", async () => {
    const { deleteSaleHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (id, product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (10, 1, 4, 115000, 98000, '2026-11-03 10:00')
    `).run();

    const res1 = await deleteSaleHandler({ id: 10 }, { db, session: { userId: 1, username: "admin" } });
    expect(res1.ok).toBe(true);

    const prod = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prod.quantity).toBe(24);

    const saleCount = (db.prepare("SELECT COUNT(*) as cnt FROM sales WHERE id = 10").get() as { cnt: number }).cnt;
    expect(saleCount).toBe(0);

    const res2 = await deleteSaleHandler({ id: 10 }, { db, session: { userId: 1, username: "admin" } });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe("NOT_FOUND");
    }
    const prodAfter = db.prepare("SELECT quantity FROM products WHERE id = 1").get() as { quantity: number };
    expect(prodAfter.quantity).toBe(24);
  });

  it("SAL-4: edit never changes unit cost or product", async () => {
    const { updateSaleHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (id, product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (10, 1, 2, 115000, 98000, '2026-11-03 10:00')
    `).run();

    db.prepare("UPDATE products SET cost = 90000 WHERE id = 1").run();

    const res = await updateSaleHandler(
      { id: 10, quantity: 3, unitPrice: 120000, soldAt: "2026-11-03 11:00" },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(res.ok).toBe(true);

    const sale = db.prepare("SELECT product_id, unit_cost, unit_price FROM sales WHERE id = 10").get() as {
      product_id: number;
      unit_cost: number;
      unit_price: number;
    };
    expect(sale.product_id).toBe(1);
    expect(sale.unit_cost).toBe(98000);
    expect(sale.unit_price).toBe(120000);
  });
});

describe("SAL-5: Snapshot immutability", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });

    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    db.prepare(`
      INSERT INTO products (id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (1, 'Basmati Rice 5kg', 'RICE5', 'Grocery', 1, 98000, 115000, 50, 10, 0)
    `).run();
  });

  it("SAL-5: changing a product's cost or price later does not change old rows' profit", async () => {
    const { saveSaleHandler, getDaySalesHandler } = await import("./sales");

    const saveRes = await saveSaleHandler(
      {
        soldAt: "2026-11-03 10:00",
        lines: [{ productId: 1, quantity: 2, unitPrice: 115000 }],
      },
      { db, session: { userId: 1, username: "admin" } }
    );
    expect(saveRes.ok).toBe(true);

    db.prepare("UPDATE products SET cost = 110000, price = 140000 WHERE id = 1").run();

    const res = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows.length).toBe(1);
      const row = res.data.rows[0]!;
      expect(row.unitPrice).toBe(115000);
      expect(row.unitCost).toBe(98000);
      expect(row.lineTotal).toBe(230000);
      expect(row.profit).toBe(34000);
      expect(res.data.total).toBe(230000);
      expect(res.data.profit).toBe(34000);
    }
  });
});

describe("SAL-3: Day sales totals, hourly buckets and day panel", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
    setDatabase(db);
    setSession({ userId: 1, username: "admin" });

    db.prepare("INSERT INTO suppliers (id, name) VALUES (1, 'Supplier A')").run();
    const insertProd = db.prepare(`
      INSERT INTO products (id, name, code, category, supplier_id, cost, price, quantity, reorder_level, archived)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);

    insertProd.run(1, "Basmati Rice 5kg", "RICE5", "Grocery", 98000, 115000, 100, 10, 0);
    insertProd.run(2, "Lentils 1kg", null, "Grocery", 14000, 17000, 100, 15, 0);
  });

  it("SAL-3: day totals, profit, count and hourly buckets are correct", async () => {
    const { getDaySalesHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 2, 115000, 98000, '2026-11-03 09:15'),
             (2, 3, 17000, 14000, '2026-11-03 14:30')
    `).run();

    const res = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.date).toBe("2026-11-03");
    expect(res.data.count).toBe(2);
    expect(res.data.total).toBe(230000 + 51000);
    expect(res.data.profit).toBe(34000 + 9000);

    expect(res.data.hourly[9]).toBe(230000);
    expect(res.data.hourly[14]).toBe(51000);
    expect(res.data.hourly[0]).toBe(0);
    expect(res.data.hourly[10]).toBe(0);
  });

  it("SAL-3: rows near midnight land on the right day", async () => {
    const { getDaySalesHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 1, 115000, 98000, '2026-11-03 23:59'),
             (1, 1, 115000, 98000, '2026-11-04 00:00')
    `).run();

    const resDay1 = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    expect(resDay1.ok).toBe(true);
    if (resDay1.ok) {
      expect(resDay1.data.count).toBe(1);
      expect(resDay1.data.rows[0]?.soldAt).toBe("2026-11-03 23:59");
      expect(resDay1.data.hourly[23]).toBe(115000);
    }

    const resDay2 = await getDaySalesHandler({ date: "2026-11-04" }, { db, session: { userId: 1, username: "admin" } });
    expect(resDay2.ok).toBe(true);
    if (resDay2.ok) {
      expect(resDay2.data.count).toBe(1);
      expect(resDay2.data.rows[0]?.soldAt).toBe("2026-11-04 00:00");
      expect(resDay2.data.hourly[0]).toBe(115000);
    }
  });

  it("SAL-3: negative profit is reported as negative", async () => {
    const { getDaySalesHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 1, 50000, 98000, '2026-11-03 10:00')
    `).run();

    const res = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.profit).toBe(-48000);
      expect(res.data.rows[0]?.profit).toBe(-48000);
    }
  });

  it("SAL-3: rows are ordered by time", async () => {
    const { getDaySalesHandler } = await import("./sales");

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (1, 1, 115000, 98000, '2026-11-03 18:00'),
             (1, 1, 115000, 98000, '2026-11-03 09:00'),
             (1, 1, 115000, 98000, '2026-11-03 12:30')
    `).run();

    const res = await getDaySalesHandler({ date: "2026-11-03" }, { db, session: { userId: 1, username: "admin" } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows.map((r: { soldAt: string }) => r.soldAt)).toEqual([
        "2026-11-03 09:00",
        "2026-11-03 12:30",
        "2026-11-03 18:00",
      ]);
    }
  });
});
