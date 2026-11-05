import fs from "node:fs";
import path from "node:path";
import type { MigrationFiles } from "../../src/main/db/migrate";

/**
 * Reads migration files from src/main/db/migrations/*.sql from disk.
 * Used only by scripts running directly under Node / tsx.
 */
export function readMigrationsFromDisk(): MigrationFiles {
  const dir = path.resolve(process.cwd(), "src/main/db/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const result: MigrationFiles = {};
  for (const f of files) {
    result[`./migrations/${f}`] = fs.readFileSync(path.join(dir, f), "utf8");
  }
  return result;
}
