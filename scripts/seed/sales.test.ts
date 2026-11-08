import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/connection";
import seedCore from "./10-core";
import seedInvoices from "./30-invoices";
import { DEMO_PRODUCTS } from "./plan";

describe("SEED: sales stock consistency test", () => {
  it("SEED: final stock equals the target for every product", async () => {
    const db = openDatabase(":memory:");
    const today = "2026-11-03";

    await seedCore(db, { today });
    await seedInvoices(db, { today });

    const seedSalesMod = await import("./40-sales");
    const seedSales = seedSalesMod.default;
    await seedSales(db, { today });

    for (const demoProd of DEMO_PRODUCTS) {
      const row = db
        .prepare<[string], { quantity: number }>("SELECT quantity FROM products WHERE name = ?")
        .get(demoProd.name);

      expect(row).toBeDefined();
      expect(row!.quantity).toBe(demoProd.finalQty);
    }
  });
});
