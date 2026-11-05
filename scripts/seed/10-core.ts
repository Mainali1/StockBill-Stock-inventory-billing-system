import type BetterSqlite3 from "better-sqlite3";
import { hashPassword } from "../../src/main/auth/password";
import { DEMO_PRODUCTS, DEMO_SUPPLIERS } from "./plan";
import * as usersRepo from "../../src/main/db/repositories/users";
import * as settingsRepo from "../../src/main/db/repositories/settings";

export default async function seed(
  db: BetterSqlite3.Database,
  ctx: { today: string },
): Promise<void> {
  // 1. User admin / admin12345
  const passwordHash = await hashPassword("admin12345");
  usersRepo.insert(db, {
    username: "admin",
    passwordHash,
    createdAt: `${ctx.today} 00:00`,
  });

  // 2. Setting shop_name: "Demo Mart"
  settingsRepo.set(db, "shop_name", "Demo Mart");

  // 3. Suppliers
  const insertSupplier = db.prepare<[string, string, string, string, string]>(
    "INSERT INTO suppliers (name, contact_name, phone, address, supplies) VALUES (?, ?, ?, ?, ?)",
  );
  const supplierIdMap = new Map<string, number>();

  for (const s of DEMO_SUPPLIERS) {
    const info = insertSupplier.run(
      s.name,
      s.contactName,
      s.phone,
      "Kathmandu, Nepal",
      s.supplies,
    );
    supplierIdMap.set(s.name, Number(info.lastInsertRowid));
  }

  // 4. Products with quantity 0
  const insertProduct = db.prepare<
    [string, string | null, string, number, number, number, number, number]
  >(
    "INSERT INTO products (name, code, category, supplier_id, cost, price, quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  for (const p of DEMO_PRODUCTS) {
    const supplierId = supplierIdMap.get(p.supplier) ?? null;
    insertProduct.run(
      p.name,
      p.code,
      p.category,
      supplierId as number,
      p.cost,
      p.price,
      0,
      p.reorderAt,
    );
  }
}
