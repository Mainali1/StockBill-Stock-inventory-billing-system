import type BetterSqlite3 from "better-sqlite3";
import { z } from "zod";
import { isValidDate } from "../domain/dates";
import { createHandler, handle } from "./handle";
import { getDashboardData } from "../db/repositories/dashboard";

const getDashboardInputSchema = z.object({
  date: z.string().refine((val) => isValidDate(val), {
    message: "Enter a valid date.",
  }),
});

export const getDashboardHandler = createHandler(
  getDashboardInputSchema,
  { auth: true },
  (input, ctx) => {
    return getDashboardData(ctx.db, input.date);
  }
);

export function register(_db: BetterSqlite3.Database): void {
  handle("dashboard:get", getDashboardInputSchema, { auth: true }, (input, ctx) => {
    return getDashboardData(ctx.db, input.date);
  });
}
