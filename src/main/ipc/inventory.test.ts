import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/connection";
import * as inventoryRepo from "../db/repositories/inventory";

describe("INV-1 requirement tests", () => {
  it("INV-1: search matches name or code case-insensitively", () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Basmati Rice 5kg', 'RICE5', 'Grocery', 98000, 115000, 24, 10, 0),
             ('Lentils 1kg', 'LENTIL1', 'Grocery', 14000, 17000, 35, 15, 0)
    `).run();

    const byName = inventoryRepo.list(db, { search: "rice" });
    expect(byName).toHaveLength(1);
    expect(byName[0]!.name).toBe("Basmati Rice 5kg");

    const byCode = inventoryRepo.list(db, { search: "lentil" });
    expect(byCode).toHaveLength(1);
    expect(byCode[0]!.code).toBe("LENTIL1");
  });

  it("INV-1: search treats % and _ literally", () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Special 100% Cotton', 'CODE%1', 'Household', 10000, 15000, 10, 5, 0),
             ('Special A Cotton', 'CODE_1', 'Household', 10000, 15000, 10, 5, 0)
    `).run();

    const percentMatch = inventoryRepo.list(db, { search: "%" });
    expect(percentMatch).toHaveLength(1);
    expect(percentMatch[0]!.name).toBe("Special 100% Cotton");

    const underscoreMatch = inventoryRepo.list(db, { search: "_" });
    expect(underscoreMatch).toHaveLength(1);
    expect(underscoreMatch[0]!.name).toBe("Special A Cotton");
  });

  it("INV-1: category and low-stock filters combine with search", () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Sunflower Oil 1L', null, 'Grocery', 27000, 32000, 4, 12, 0),
             ('Wheat Flour 5kg', null, 'Grocery', 52000, 60000, 18, 8, 0),
             ('Notebook A4', null, 'Stationery', 7200, 9000, 5, 15, 0)
    `).run();

    const filtered = inventoryRepo.list(db, { search: "oil", category: "Grocery", lowOnly: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe("Sunflower Oil 1L");

    const noMatch = inventoryRepo.list(db, { search: "oil", category: "Stationery" });
    expect(noMatch).toHaveLength(0);
  });

  it("INV-1: archived products are never listed", () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Old Rice', 'OLD', 'Grocery', 1000, 1200, 10, 5, 1),
             ('New Rice', 'NEW', 'Grocery', 1000, 1200, 10, 5, 0)
    `).run();

    const list = inventoryRepo.list(db, {});
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("New Rice");
  });

  it("INV-1: search with ' OR '1'='1 returns nothing and changes nothing", () => {
    const db = openDatabase(":memory:");
    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Rice', 'R1', 'Grocery', 1000, 1200, 10, 5, 0)
    `).run();

    const list = inventoryRepo.list(db, { search: "' OR '1'='1" });
    expect(list).toHaveLength(0);

    const all = inventoryRepo.list(db, {});
    expect(all).toHaveLength(1);
  });
});

describe("INV-2 requirement tests", () => {
  it("INV-2: creates a product and returns its status", () => {
    const db = openDatabase(":memory:");
    const result = inventoryRepo.saveProduct(db, {
      name: "Basmati Rice 5kg",
      code: "RICE5",
      category: "Grocery",
      supplierId: null,
      cost: 98000,
      price: 115000,
      quantity: 24,
      reorderLevel: 10,
    });
    expect(result.product.id).toBeDefined();
    expect(result.product.name).toBe("Basmati Rice 5kg");
    expect(result.product.status).toBe("IN_STOCK");
    expect(result.warnings).toEqual([]);
  });

  it("INV-2: rejects empty name and category with exact messages", () => {
    const db = openDatabase(":memory:");
    expect(() => inventoryRepo.saveProduct(db, {
      name: "   ",
      code: null,
      category: "Grocery",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Name is required.");

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Valid Name",
      code: null,
      category: "   ",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Category is required.");
  });

  it("INV-2: rejects duplicate code and names the other product", () => {
    const db = openDatabase(":memory:");
    inventoryRepo.saveProduct(db, {
      name: "First Product",
      code: "CODE1",
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    });

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Second Product",
      code: "CODE1",
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("That code is already used by First Product.");
  });

  it("INV-2: empty code is stored as null and two products may both have no code", () => {
    const db = openDatabase(":memory:");
    const p1 = inventoryRepo.saveProduct(db, {
      name: "Product 1",
      code: "",
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    });
    const p2 = inventoryRepo.saveProduct(db, {
      name: "Product 2",
      code: "   ",
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    });

    expect(p1.product.code).toBeNull();
    expect(p2.product.code).toBeNull();
  });

  it("INV-2: rejects negative or over-precise money, and non-integer quantities", () => {
    const db = openDatabase(":memory:");
    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: null,
      cost: -100,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: -10,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: -1,
      reorderLevel: 2,
    })).toThrow("Enter a whole number of 0 or more.");

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: null,
      cost: 1000,
      price: 1200,
      quantity: 2.5,
      reorderLevel: 2,
    })).toThrow("Enter a whole number of 0 or more.");
  });

  it("INV-2: rejects an archived or unknown supplier", () => {
    const db = openDatabase(":memory:");
    db.prepare("INSERT INTO suppliers (name, archived) VALUES ('Archived Supplier', 1)").run();

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: 999,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Choose a supplier from the list.");

    expect(() => inventoryRepo.saveProduct(db, {
      name: "Product",
      code: null,
      category: "Category",
      supplierId: 1,
      cost: 1000,
      price: 1200,
      quantity: 5,
      reorderLevel: 2,
    })).toThrow("Choose a supplier from the list.");
  });
});

describe("INV-3 requirement tests", () => {
  it("INV-3: status is OUT at 0, LOW at or below reorder level, otherwise IN_STOCK", () => {
    const db = openDatabase(":memory:");
    const pOut = inventoryRepo.saveProduct(db, {
      name: "Salt",
      code: null,
      category: "Grocery",
      supplierId: null,
      cost: 2200,
      price: 2800,
      quantity: 0,
      reorderLevel: 15,
    });
    expect(pOut.product.status).toBe("OUT");

    const pLowEqual = inventoryRepo.saveProduct(db, {
      name: "Notebook Low",
      code: null,
      category: "Stationery",
      supplierId: null,
      cost: 7200,
      price: 9000,
      quantity: 15,
      reorderLevel: 15,
    });
    expect(pLowEqual.product.status).toBe("LOW");

    const pLowUnder = inventoryRepo.saveProduct(db, {
      name: "Tea Low",
      code: null,
      category: "Grocery",
      supplierId: null,
      cost: 23500,
      price: 28000,
      quantity: 2,
      reorderLevel: 8,
    });
    expect(pLowUnder.product.status).toBe("LOW");

    const pInStock = inventoryRepo.saveProduct(db, {
      name: "Sugar In Stock",
      code: null,
      category: "Grocery",
      supplierId: null,
      cost: 9500,
      price: 11000,
      quantity: 16,
      reorderLevel: 15,
    });
    expect(pInStock.product.status).toBe("IN_STOCK");
  });
});

describe("INV-4 requirement tests", () => {
  it("INV-4: product with a sale is archived, not deleted", () => {
    const db = openDatabase(":memory:");
    const { product } = inventoryRepo.saveProduct(db, {
      name: "Product with Sale",
      code: "SALE1",
      category: "Cat",
      supplierId: null,
      cost: 1000,
      price: 1500,
      quantity: 10,
      reorderLevel: 2,
    });

    db.prepare(`
      INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at)
      VALUES (?, 1, 1500, 1000, '2026-11-03 14:30')
    `).run(product.id);

    const res = inventoryRepo.deleteProduct(db, product.id);
    expect(res).toEqual({ result: "archived" });

    // Ensure it is marked archived = 1 in db
    const row = db.prepare("SELECT archived FROM products WHERE id = ?").get(product.id) as { archived: number };
    expect(row.archived).toBe(1);

    // Ensure list does not return it
    expect(inventoryRepo.list(db, {})).toHaveLength(0);
  });

  it("INV-4: product with a supplier invoice item is archived, not deleted", () => {
    const db = openDatabase(":memory:");
    db.prepare("INSERT INTO suppliers (name, archived) VALUES ('Supp', 0)").run();
    const { product } = inventoryRepo.saveProduct(db, {
      name: "Product with Invoice",
      code: "INV1",
      category: "Cat",
      supplierId: 1,
      cost: 1000,
      price: 1500,
      quantity: 10,
      reorderLevel: 2,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (1, 'INV-001', '2026-11-03', 1000, 1000, '2026-11-03 10:00')
    `).run();

    db.prepare(`
      INSERT INTO supplier_invoice_items (invoice_id, product_id, quantity, unit_cost)
      VALUES (1, ?, 10, 1000)
    `).run(product.id);

    const res = inventoryRepo.deleteProduct(db, product.id);
    expect(res).toEqual({ result: "archived" });

    const row = db.prepare("SELECT archived FROM products WHERE id = ?").get(product.id) as { archived: number };
    expect(row.archived).toBe(1);
    expect(inventoryRepo.list(db, {})).toHaveLength(0);
  });

  it("INV-4: product with no history is deleted", () => {
    const db = openDatabase(":memory:");
    const { product } = inventoryRepo.saveProduct(db, {
      name: "Product Clean",
      code: "CLEAN",
      category: "Cat",
      supplierId: null,
      cost: 1000,
      price: 1500,
      quantity: 10,
      reorderLevel: 2,
    });

    const res = inventoryRepo.deleteProduct(db, product.id);
    expect(res).toEqual({ result: "deleted" });

    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(product.id);
    expect(row).toBeUndefined();
  });
});

describe("INV-5 requirement tests", () => {
  it("INV-5: price below cost returns the warning and still saves", () => {
    const db = openDatabase(":memory:");
    const res = inventoryRepo.saveProduct(db, {
      name: "Loss Leader Item",
      code: "LOSS1",
      category: "Grocery",
      supplierId: null,
      cost: 5000,
      price: 4000,
      quantity: 10,
      reorderLevel: 2,
    });

    expect(res.warnings).toEqual(["Price is lower than cost. You will lose money on each sale."]);
    expect(res.product.id).toBeDefined();
    expect(res.product.price).toBe(4000);
    expect(res.product.cost).toBe(5000);

    const saved = inventoryRepo.getProductDtoById(db, res.product.id);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Loss Leader Item");
  });
});
