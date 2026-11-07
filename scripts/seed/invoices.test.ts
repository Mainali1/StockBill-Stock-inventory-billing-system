import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/connection";
import seedCore from "./10-core";
import seedInvoices from "./30-invoices";
import { buildSalesPlan, DEMO_PRODUCTS } from "./plan";

describe("SEED: invoices stock consistency test", () => {
  it("SEED: received minus planned sold equals final quantity for every product", async () => {
    const db = openDatabase(":memory:");
    const today = "2026-11-03";

    await seedCore(db, { today });
    await seedInvoices(db, { today });

    const plannedRows = buildSalesPlan(today);
    const plannedSoldMap = new Map<string, number>();
    for (const r of plannedRows) {
      plannedSoldMap.set(r.productName, (plannedSoldMap.get(r.productName) ?? 0) + r.quantity);
    }

    for (const demoProd of DEMO_PRODUCTS) {
      const row = db
        .prepare<[string], { quantity: number }>("SELECT quantity FROM products WHERE name = ?")
        .get(demoProd.name);

      expect(row).toBeDefined();
      const received = row!.quantity;
      const plannedSold = plannedSoldMap.get(demoProd.name) ?? 0;

      expect(received - plannedSold).toBe(demoProd.finalQty);
    }
  });
});
