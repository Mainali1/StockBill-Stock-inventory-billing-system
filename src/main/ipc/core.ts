import type BetterSqlite3 from "better-sqlite3";
import { app } from "electron";
import { z } from "zod";
import { handle } from "./handle";

/** The handlers that core provides: getVersion. */
export function register(_db: BetterSqlite3.Database): void {
  handle("app:getVersion", z.void(), { auth: false }, () => ({ version: app.getVersion() }));
}
