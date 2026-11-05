import type BetterSqlite3 from "better-sqlite3";

/**
 * Every migration file lives next to this module. Vite inlines them with `?raw`
 * so the packaged app never has to read from the source tree at runtime.
 */
const migrationFiles = import.meta.glob("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  return Object.entries(migrationFiles)
    .map(([path, sql]) => {
      const name = path.split("/").pop() ?? path;
      const match = /^(\d+)_/.exec(name);
      const rawVersion = match?.[1];
      if (rawVersion === undefined) {
        throw new Error(`Migration file must start with a number: ${name}`);
      }
      return { version: Number(rawVersion), name, sql };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Applies every migration that has not been recorded yet. Each migration runs
 * inside its own transaction, so a failure leaves the previous state intact.
 * Running it twice applies nothing the second time.
 */
export function migrate(db: BetterSqlite3.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL
     );`,
  );

  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations")
    .all() as { version: number }[];
  const applied = new Set(appliedRows.map((row) => row.version));

  const record = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of loadMigrations()) {
    if (applied.has(migration.version)) {
      continue;
    }
    const run = db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name, new Date().toISOString());
    });
    run();
  }
}
