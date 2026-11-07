import type BetterSqlite3 from "better-sqlite3";
import { z } from "zod";
import { createHandler, handle } from "./handle";
import { getPickerData, saveSale, getDaySales, updateSale, deleteSale } from "../db/repositories/sales";

const pickerInputSchema = z.object({
  search: z.string().optional(),
  category: z.string().nullable().optional(),
});

const updateSaleInputSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  soldAt: z.string(),
});

const deleteSaleInputSchema = z.object({
  id: z.number().int().positive(),
});

const saleLineInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive("Enter a whole number of 1 or more."),
  unitPrice: z.number().int().nonnegative("Enter an amount of 0 or more, with at most 2 decimals."),
});

const saveSaleInputSchema = z.object({
  soldAt: z.string(),
  lines: z.array(saleLineInputSchema),
});

export const pickerHandler = createHandler(
  pickerInputSchema,
  { auth: true },
  (input, ctx) => {
    return getPickerData(ctx.db, input);
  }
);

const daySalesInputSchema = z.object({
  date: z.string(),
});

export const saveSaleHandler = createHandler(
  saveSaleInputSchema,
  { auth: true },
  (input, ctx) => {
    return saveSale(ctx.db, input);
  }
);

export const getDaySalesHandler = createHandler(
  daySalesInputSchema,
  { auth: true },
  (input, ctx) => {
    return getDaySales(ctx.db, input.date);
  }
);

export const updateSaleHandler = createHandler(
  updateSaleInputSchema,
  { auth: true },
  (input, ctx) => {
    return updateSale(ctx.db, input);
  }
);

export const deleteSaleHandler = createHandler(
  deleteSaleInputSchema,
  { auth: true },
  (input, ctx) => {
    return deleteSale(ctx.db, input.id);
  }
);

export function register(_db: BetterSqlite3.Database): void {
  handle("sales:picker", pickerInputSchema, { auth: true }, (input, ctx) => {
    return getPickerData(ctx.db, input);
  });

  handle("sales:save", saveSaleInputSchema, { auth: true }, (input, ctx) => {
    return saveSale(ctx.db, input);
  });

  handle("sales:day", daySalesInputSchema, { auth: true }, (input, ctx) => {
    return getDaySales(ctx.db, input.date);
  });

  handle("sales:update", updateSaleInputSchema, { auth: true }, (input, ctx) => {
    return updateSale(ctx.db, input);
  });

  handle("sales:delete", deleteSaleInputSchema, { auth: true }, (input, ctx) => {
    return deleteSale(ctx.db, input.id);
  });
}
