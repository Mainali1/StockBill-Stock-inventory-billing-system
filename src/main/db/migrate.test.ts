import { describe, expect, it } from "vitest";
import { openDatabase } from "./connection";
import { migrate } from "./migrate";

describe("DB: schema and constraints", () => {
  it("DB: migrations apply once", () => {
    const db = openDatabase(":memory:");

    const applied = db
      .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
      .all() as { version: number; name: string }[];
    expect(applied).toEqual([{ version: 1, name: "001_init.sql" }]);

    // Running migrations again applies nothing.
    migrate(db);
    const count = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as {
      count: number;
    };
    expect(count.count).toBe(1);

    db.close();
  });

  it("DB: foreign keys are enforced", () => {
    const db = openDatabase(":memory:");

    expect(() =>
      db
        .prepare(
          "INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(999, 1, 100, 50, "2026-11-01 10:00"),
    ).toThrow();

    db.close();
  });

  it("DB: sold_at format is enforced", () => {
    const db = openDatabase(":memory:");
    db.prepare(
      "INSERT INTO products (name, code, category, cost, price, quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("Rice", null, "Grocery", 100, 200, 5, 1);

    const insert = db.prepare(
      "INSERT INTO sales (product_id, quantity, unit_price, unit_cost, sold_at) VALUES (?, ?, ?, ?, ?)",
    );

    expect(() => insert.run(1, 1, 200, 100, "2026-11-01T10:00")).toThrow();
    expect(() => insert.run(1, 1, 200, 100, "2026-11-01 10:00")).not.toThrow();

    db.close();
  });
});
