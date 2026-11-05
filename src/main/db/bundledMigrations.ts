import type { MigrationFiles } from "./migrate";

/**
 * Every migration file lives next to this module. Vite inlines them with `?raw`
 * so the packaged app never has to read from the source tree at runtime.
 */
export const bundledMigrations: MigrationFiles = import.meta.glob("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
