import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../connection";
import type BetterSqlite3 from "better-sqlite3";
import * as productsRepo from "./products";
import * as suppliersRepo from "./suppliers";
import * as settingsRepo from "./settings";
import * as usersRepo from "./users";

describe("Shared repositories and DB constraints", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("DB: foreign keys are enforced", () => {
    expect(() => {
      db.prepare(
        "INSERT INTO products (name, code, category, supplier_id, cost, price, quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run("Test Product", null, "Category", 9999, 100, 200, 10, 5);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("DB: sold_at format is enforced", () => {
    db.prepare("INSERT INTO suppliers (name) VALUES (?)").run("Test Supplier");
    db.prepare(
      "INSERT INTO products (name, category, supplier_id, cost, price, quantity, reorder_level) VALUES (?, ?, 1, 100, 200, 10, 5)"
    ).run("Prod", "Cat");

    expect(() => {
      db.prepare("INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at) VALUES (1, 1, 200, 100, ?)")
        .run("2026-11-03T14:30");
    }).toThrow(/CHECK constraint failed/);

    expect(() => {
      db.prepare("INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at) VALUES (1, 1, 200, 100, ?)")
        .run("2026-11-03 14:30");
    }).not.toThrow();
  });

  it("SETTINGS repo: get and set work correctly", () => {
    expect(settingsRepo.get(db, "shop_name")).toBeNull();
    settingsRepo.set(db, "shop_name", "My Shop");
    expect(settingsRepo.get(db, "shop_name")).toBe("My Shop");
    settingsRepo.set(db, "shop_name", "Updated Shop");
    expect(settingsRepo.get(db, "shop_name")).toBe("Updated Shop");
  });

  it("USERS repo: count, findByUsername, insert", () => {
    expect(usersRepo.count(db)).toBe(0);
    expect(usersRepo.findByUsername(db, "admin")).toBeNull();

    const id = usersRepo.insert(db, {
      username: "admin",
      passwordHash: "hash123",
      createdAt: "2026-11-03 10:00",
    });
    expect(id).toBe(1);
    expect(usersRepo.count(db)).toBe(1);

    const user = usersRepo.findByUsername(db, "admin");
    expect(user).not.toBeNull();
    expect(user?.username).toBe("admin");
    expect(user?.password_hash).toBe("hash123");
  });

  it("SUPPLIERS repo: getById and listActive exclude archived", () => {
    db.prepare("INSERT INTO suppliers (name, archived) VALUES (?, 0)").run("Supplier B");
    db.prepare("INSERT INTO suppliers (name, archived) VALUES (?, 0)").run("Supplier A");
    db.prepare("INSERT INTO suppliers (name, archived) VALUES (?, 1)").run("Supplier Archived");

    const active = suppliersRepo.listActive(db);
    expect(active.length).toBe(2);
    expect(active[0]?.name).toBe("Supplier A");
    expect(active[1]?.name).toBe("Supplier B");

    const s1 = suppliersRepo.getById(db, active[0]!.id);
    expect(s1?.name).toBe("Supplier A");
    expect(suppliersRepo.getById(db, 999)).toBeNull();
  });

  it("PRODUCTS repo: getById, listForPicker, adjustStock", () => {
    db.prepare(
      "INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("Apple 100g", "APP1", "Fruit", 50, 80, 10, 2, 0);

    db.prepare(
      "INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("Banana", "BAN1", "Fruit", 40, 60, 5, 2, 0);

    db.prepare(
      "INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("Carrot", null, "Veg", 30, 50, 0, 2, 1);

    const p1 = productsRepo.getById(db, 1);
    expect(p1?.name).toBe("Apple 100g");

    const all = productsRepo.listForPicker(db, {});
    expect(all.length).toBe(2);

    const searchByName = productsRepo.listForPicker(db, { search: "app" });
    expect(searchByName.length).toBe(1);
    expect(searchByName[0]?.name).toBe("Apple 100g");

    const searchByCode = productsRepo.listForPicker(db, { search: "BAN1" });
    expect(searchByCode.length).toBe(1);
    expect(searchByCode[0]?.name).toBe("Banana");

    productsRepo.adjustStock(db, 1, -3);
    expect(productsRepo.getById(db, 1)?.quantity).toBe(7);

    expect(() => productsRepo.adjustStock(db, 1, -10)).toThrow(/Only 7 of Apple 100g in stock\./);
  });
});
