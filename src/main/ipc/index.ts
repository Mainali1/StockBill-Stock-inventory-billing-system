import type BetterSqlite3 from "better-sqlite3";
import { z } from "zod";
import { CHANNELS } from "@shared/ipc/channels";
import { DomainError } from "../domain/errors";
import { getRegisteredChannels, handle, setDatabase } from "./handle";

type RegisterFn = (db: BetterSqlite3.Database) => void;

const featureModules = import.meta.glob<{ register?: RegisterFn }>(
  ["./*.ts", "!./index.ts", "!./handle.ts", "!./*.test.ts"],
  { eager: true },
);

/**
 * Loads every sibling feature file (each exporting `register(db)`) and then
 * fills any channel that still has no handler with a fallback that reports the
 * feature as not built.
 */
export function registerAllHandlers(db: BetterSqlite3.Database): void {
  setDatabase(db);

  for (const module of Object.values(featureModules)) {
    if (typeof module.register === "function") {
      module.register(db);
    }
  }

  const registered = getRegisteredChannels();
  for (const channel of CHANNELS) {
    if (registered.has(channel)) {
      continue;
    }
    handle(channel, z.unknown(), { auth: false }, () => {
      throw new DomainError("RULE", "This feature is not built yet.");
    });
  }
}
