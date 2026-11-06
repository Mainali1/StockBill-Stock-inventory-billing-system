import { z } from "zod";
import type BetterSqlite3 from "better-sqlite3";
import { handle } from "./handle";
import * as suppliersRepo from "../db/repositories/suppliers";

export function register(_db: BetterSqlite3.Database): void {
  handle("suppliers:listActive", z.void(), { auth: true }, async (_input, ctx) => {
    return suppliersRepo.listActive(ctx.db);
  });
}
