import { describe, expect, it } from "vitest";
import { openDatabase } from "./connection";
import { bundledMigrations } from "./bundledMigrations";
import { readMigrationsFromDisk } from "../../../scripts/lib/migrations";

describe("DB migrations", () => {
  it("DB: migrations apply once", () => {
    const db = openDatabase(":memory:");

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as { name: string }[];

    expect(tables.map((t) => t.name)).toContain("schema_migrations");
    expect(tables.map((t) => t.name)).toContain("users");
    expect(tables.map((t) => t.name)).toContain("products");
    expect(tables.map((t) => t.name)).toContain("sales");

    const applied = db
      .prepare("SELECT COUNT(*) as count FROM schema_migrations")
      .get() as { count: number };
    expect(applied.count).toBeGreaterThan(0);
  });

  it("DB: running openDatabase twice on the same file does not fail", () => {
    const db = openDatabase(":memory:");
    expect(() => openDatabase(":memory:")).not.toThrow();
    db.close();
  });

  it("DB: foreign keys are enforced", () => {
    const db = openDatabase(":memory:");
    const row = db.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });

  it("DB: disk migrations equal bundled migrations", () => {
    const diskMigrations = readMigrationsFromDisk();
    expect(Object.keys(diskMigrations).sort()).toEqual(Object.keys(bundledMigrations).sort());
    for (const key of Object.keys(diskMigrations)) {
      expect(diskMigrations[key]).toBe(bundledMigrations[key]);
    }
  });
});
