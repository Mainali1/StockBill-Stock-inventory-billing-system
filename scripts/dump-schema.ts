import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/main/db/connection";

/**
 * Opens an in-memory database (which runs the migrations) and mirrors the
 * resulting schema into `docs/schema.sql`. Tables and indexes are written in
 * the order SQLite stores them, excluding SQLite internals and the migration
 * bookkeeping table.
 */
const db = openDatabase(":memory:");

const rows = db
  .prepare(
    `SELECT sql FROM sqlite_master
     WHERE type IN ('table', 'index')
       AND name NOT LIKE 'sqlite_%'
       AND name <> 'schema_migrations'
     ORDER BY (type = 'index'), name`,
  )
  .all() as { sql: string | null }[];

const statements = rows
  .map((row) => row.sql)
  .filter((sql): sql is string => sql !== null)
  .map((sql) => {
    const trimmed = sql.trim();
    return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
  });

const output = `${statements.join("\n\n")}\n`;
const target = join(process.cwd(), "docs", "schema.sql");
writeFileSync(target, output, "utf8");

db.close();

console.log(`Wrote ${target}`);
