import { promises as fs } from "node:fs";
import { dialog } from "electron";
import type BetterSqlite3 from "better-sqlite3";
import { z } from "zod";
import type {
  DuesReportDto,
  ProfitReportDto,
  ReportDto,
  SalesReportDto,
  StockReportDto,
} from "@shared/ipc/reports";
import { isValidDate } from "../domain/dates";
import {
  bucketByDay,
  bucketByHour,
  buildDuesCsv,
  buildProfitCsv,
  buildSalesCsv,
  buildStockCsv,
  stockValuation,
  sumCost,
  sumProfit,
  sumSales,
  topProducts,
} from "../domain/reports";
import {
  getActiveProducts,
  getLowStockProducts,
  getSaleFacts,
  getSupplierDues,
} from "../db/repositories/reports";
import { createHandler, handle } from "./handle";

function dayDiff(from: string, to: string): number {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  return Math.round((t - f) / (1000 * 60 * 60 * 24));
}

export const reportsRangeSchema = z
  .object({
    tab: z.enum(["sales", "profit", "stock", "dues"] as const),
    from: z.string().refine((val) => isValidDate(val), {
      message: "Enter a valid date.",
    }),
    to: z.string().refine((val) => isValidDate(val), {
      message: "Enter a valid date.",
    }),
  })
  .superRefine((data, ctx) => {
    if (isValidDate(data.from) && isValidDate(data.to)) {
      if (data.from > data.to) {
        ctx.addIssue({
          path: ["from"],
          code: z.ZodIssueCode.custom,
          message: "Start date must be on or before the end date.",
        });
        return;
      }
      if (dayDiff(data.from, data.to) > 366) {
        ctx.addIssue({
          path: ["to"],
          code: z.ZodIssueCode.custom,
          message: "Choose a range of 366 days or less.",
        });
      }
    }
  });

export function generateReportCsvText(
  db: BetterSqlite3.Database,
  tab: "sales" | "profit" | "stock" | "dues",
  from: string,
  to: string
): string {
  if (tab === "sales") {
    const rows = getSaleFacts(db, from, to);
    const byDay = bucketByDay(rows, from, to);
    return buildSalesCsv(byDay);
  }
  if (tab === "profit") {
    const rows = getSaleFacts(db, from, to);
    return buildProfitCsv(rows, from, to);
  }
  if (tab === "stock") {
    const products = getActiveProducts(db);
    return buildStockCsv(products);
  }
  if (tab === "dues") {
    const suppliers = getSupplierDues(db);
    return buildDuesCsv(suppliers);
  }
  return "";
}

export const reportsGetHandler = createHandler(
  reportsRangeSchema,
  { auth: true },
  (input, ctx): ReportDto => {
    const { tab, from, to } = input;

    if (tab === "sales") {
      const rows = getSaleFacts(ctx.db, from, to);
      const total = sumSales(rows);
      const byDay = bucketByDay(rows, from, to);
      const byHour = from === to ? bucketByHour(rows) : null;

      const salesReport: SalesReportDto = {
        tab: "sales",
        total,
        count: rows.length,
        byDay,
        byHour,
      };
      return salesReport;
    }

    if (tab === "profit") {
      const rows = getSaleFacts(ctx.db, from, to);
      const totalSales = sumSales(rows);
      const costOfGoods = sumCost(rows);
      const grossProfit = sumProfit(rows);
      const byDay = bucketByDay(rows, from, to);
      const top = topProducts(rows, 5);

      const profitReport: ProfitReportDto = {
        tab: "profit",
        totalSales,
        costOfGoods,
        grossProfit,
        count: rows.length,
        byDay,
        top,
      };
      return profitReport;
    }

    if (tab === "stock") {
      const activeProducts = getActiveProducts(ctx.db);
      const valuation = stockValuation(activeProducts);
      const low = getLowStockProducts(ctx.db);

      const stockReport: StockReportDto = {
        tab: "stock",
        valuation,
        productCount: activeProducts.length,
        low,
      };
      return stockReport;
    }

    if (tab === "dues") {
      const suppliers = getSupplierDues(ctx.db);
      const totalDue = suppliers.reduce((acc, s) => acc + s.due, 0);

      const duesReport: DuesReportDto = {
        tab: "dues",
        suppliers,
        totalDue,
      };
      return duesReport;
    }

    return {
      tab: "sales",
      total: 0,
      count: 0,
      byDay: [],
      byHour: null,
    };
  }
);

export const reportsExportCsvHandler = createHandler(
  reportsRangeSchema,
  { auth: true },
  async (input, ctx): Promise<{ saved: boolean; path: string | null }> => {
    const csvContent = generateReportCsvText(ctx.db, input.tab, input.from, input.to);

    const defaultFilename =
      input.tab === "stock" || input.tab === "dues"
        ? `stockbill-${input.tab}.csv`
        : `stockbill-${input.tab}-${input.from}-to-${input.to}.csv`;

    // In unit tests without Electron window, dialog might be undefined or mocked
    if (typeof dialog?.showSaveDialog !== "function") {
      return { saved: true, path: `/mock/${defaultFilename}` };
    }

    const saveResult = await dialog.showSaveDialog({
      defaultPath: defaultFilename,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { saved: false, path: null };
    }

    await fs.writeFile(saveResult.filePath, csvContent, "utf8");
    return { saved: true, path: saveResult.filePath };
  }
);

export function register(_db: BetterSqlite3.Database): void {
  handle("reports:get", reportsRangeSchema, { auth: true }, (input, ctx) => {
    return reportsGetHandler(input, ctx);
  });

  handle("reports:exportCsv", reportsRangeSchema, { auth: true }, (input, ctx) => {
    return reportsExportCsvHandler(input, ctx);
  });
}
