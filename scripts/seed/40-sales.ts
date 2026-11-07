import type BetterSqlite3 from "better-sqlite3";
import { saveSale } from "../../src/main/db/repositories/sales";
import { buildSalesPlan, DEMO_PRODUCTS } from "./plan";

export default async function seed(
  db: BetterSqlite3.Database,
  ctx: { today: string }
): Promise<void> {
  const plan = buildSalesPlan(ctx.today);

  const products = db
    .prepare<[], { id: number; name: string }>(
      "SELECT id, name FROM products WHERE archived = 0"
    )
    .all();
  const prodMap = new Map(products.map((p) => [p.name, p.id]));

  for (const row of plan) {
    const productId = prodMap.get(row.productName);
    if (!productId) {
      throw new Error(`Product not found for seed sale: ${row.productName}`);
    }

    saveSale(db, {
      soldAt: row.soldAt,
      lines: [
        {
          productId,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
        },
      ],
    });
  }

  // Assert that every product's stock equals its finalQty; throw if not
  for (const demoProd of DEMO_PRODUCTS) {
    const row = db
      .prepare<[string], { quantity: number }>("SELECT quantity FROM products WHERE name = ?")
      .get(demoProd.name);

    if (!row) {
      throw new Error(`Product missing after seed: ${demoProd.name}`);
    }

    if (row.quantity !== demoProd.finalQty) {
      throw new Error(
        `Product stock mismatch for ${demoProd.name}: expected ${demoProd.finalQty}, got ${row.quantity}`
      );
    }
  }
}
