import fs from "node:fs";
import path from "node:path";
import { openDatabaseWith } from "../src/main/db/open";
import { readMigrationsFromDisk } from "./lib/migrations";
import { todayDb } from "../src/main/domain/dates";

// Parse CLI args
const args = process.argv.slice(2);
let outPath = path.resolve("./demo/stockbill-demo.db");
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  if (arg === "--out" && nextArg) {
    outPath = path.resolve(nextArg);
    i++;
  }
}

// Ensure target directory exists
const dir = path.dirname(outPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Delete existing database file if present
if (fs.existsSync(outPath)) {
  fs.unlinkSync(outPath);
}
// Also remove WAL / SHM files if present
if (fs.existsSync(`${outPath}-wal`)) fs.unlinkSync(`${outPath}-wal`);
if (fs.existsSync(`${outPath}-shm`)) fs.unlinkSync(`${outPath}-shm`);

console.log(`Creating demo database at: ${outPath}`);
const migrations = readMigrationsFromDisk();
const db = openDatabaseWith(outPath, migrations);

const seedDir = path.resolve("scripts/seed");
const seedFiles = fs
  .readdirSync(seedDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "plan.ts")
  .sort();

const today = todayDb();

async function runSeeds() {
  for (const file of seedFiles) {
    const filePath = path.join(seedDir, file);
    const mod = await import(filePath);
    const seedFn = mod.default ?? mod.seed;
    if (typeof seedFn === "function") {
      console.log(`Running seed: ${file}`);
      await seedFn(db, { today });
    }
  }

  // Print row count per table
  const tables = [
    "users",
    "settings",
    "suppliers",
    "products",
    "sales",
    "supplier_invoices",
    "supplier_invoice_items",
    "supplier_payments",
  ];

  console.log("\nSeed finished. Table counts:");
  for (const table of tables) {
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
      count: number;
    };
    console.log(`  - ${table}: ${countRow.count}`);
  }

  db.close();
}

runSeeds().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
