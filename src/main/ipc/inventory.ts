import { z } from "zod";
import type BetterSqlite3 from "better-sqlite3";
import { handle } from "./handle";
import * as inventoryRepo from "../db/repositories/inventory";

const listInputSchema = z.object({
  search: z.string().optional(),
  category: z.string().nullable().optional(),
  lowOnly: z.boolean().optional(),
});

const productInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string(),
  code: z.string().nullable().optional(),
  category: z.string(),
  supplierId: z.number().int().positive().nullable().optional(),
  cost: z.number(),
  price: z.number(),
  quantity: z.number(),
  reorderLevel: z.number(),
});

const deleteInputSchema = z.object({
  id: z.number().int().positive(),
});

export function register(_db: BetterSqlite3.Database): void {
  handle("inventory:list", listInputSchema, { auth: true }, async (input, ctx) => {
    return inventoryRepo.list(ctx.db, input);
  });

  handle("inventory:categories", z.void(), { auth: true }, async (_input, ctx) => {
    return inventoryRepo.listCategories(ctx.db);
  });

  handle("inventory:save", productInputSchema, { auth: true }, async (input, ctx) => {
    return inventoryRepo.saveProduct(ctx.db, {
      ...input,
      code: input.code ?? null,
      supplierId: input.supplierId ?? null,
    });
  });

  handle("inventory:delete", deleteInputSchema, { auth: true }, async (input, ctx) => {
    return inventoryRepo.deleteProduct(ctx.db, input.id);
  });
}
