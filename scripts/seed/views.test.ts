import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/connection";
import { getDashboardHandler } from "../../src/main/ipc/dashboard";
import { reportsGetHandler } from "../../src/main/ipc/reports";
import type {
  DashboardDto,
  DuesReportDto,
  ProfitReportDto,
  SalesReportDto,
  StockReportDto,
} from "@shared/ipc/reports";
import seedCore from "./10-core";
import seedInvoices from "./30-invoices";
import seedSales from "./40-sales";

/** Returns the date `days` days before `date` (both as YYYY-MM-DD), using UTC to avoid daylight saving. */
function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const result = new Date(Date.UTC(year, month - 1, day - days));
  return result.toISOString().slice(0, 10);
}

describe("SEED: dashboard and report views", () => {
  const today = "2026-11-03";
  const session = { userId: 1, username: "admin" };

  async function seededDatabase() {
    const db = openDatabase(":memory:");
    await seedCore(db, { today });
    await seedInvoices(db, { today });
    await seedSales(db, { today });
    return db;
  }

  it("SEED: every dashboard and report view has data for today", async () => {
    const db = await seededDatabase();
    const from = daysBefore(today, 9);

    const dashboardResult = await getDashboardHandler({ date: today }, { db, session });
    expect(dashboardResult.ok).toBe(true);
    const dashboard = dashboardResult.ok ? (dashboardResult.data as DashboardDto) : null;
    expect(dashboard).not.toBeNull();
    expect(dashboard!.sales, "sales today").toBeGreaterThan(0);
    expect(dashboard!.profit, "profit today").toBeGreaterThan(0);
    expect(dashboard!.lowStockCount, "low-stock items").toBeGreaterThan(0);
    expect(dashboard!.supplierDue, "supplier dues").toBeGreaterThan(0);
    expect(
      dashboard!.week.some((bar) => bar.sales > 0),
      "week bars",
    ).toBe(true);
    expect(dashboard!.restock.length, "restock list").toBeGreaterThan(0);
    expect(dashboard!.recentInvoices.length, "recent invoices").toBeGreaterThan(0);

    const sales = await reportsGetHandler({ tab: "sales", from, to: today }, { db, session });
    expect(sales.ok).toBe(true);
    const salesReport = sales.ok ? (sales.data as SalesReportDto) : null;
    expect(salesReport!.total, "sales report total").toBeGreaterThan(0);
    expect(salesReport!.count, "sales report rows").toBeGreaterThan(0);
    expect(
      salesReport!.byDay.some((day) => day.sales > 0),
      "sales by day",
    ).toBe(true);

    const singleDay = await reportsGetHandler(
      { tab: "sales", from: today, to: today },
      { db, session },
    );
    const singleDayReport = singleDay.ok ? (singleDay.data as SalesReportDto) : null;
    expect(singleDayReport?.byHour, "by-hour chart for one day").not.toBeNull();
    expect(
      singleDayReport!.byHour!.some((value) => value > 0),
      "by-hour values",
    ).toBe(true);

    const profit = await reportsGetHandler({ tab: "profit", from, to: today }, { db, session });
    const profitReport = profit.ok ? (profit.data as ProfitReportDto) : null;
    expect(profitReport!.grossProfit, "gross profit").toBeGreaterThan(0);
    expect(profitReport!.costOfGoods, "cost of goods").toBeGreaterThan(0);
    expect(profitReport!.top.length, "top products").toBeGreaterThan(0);

    const stock = await reportsGetHandler({ tab: "stock", from, to: today }, { db, session });
    const stockReport = stock.ok ? (stock.data as StockReportDto) : null;
    expect(stockReport!.valuation, "stock valuation").toBeGreaterThan(0);
    expect(stockReport!.productCount, "product count").toBeGreaterThan(0);
    expect(stockReport!.low.length, "low-stock list").toBeGreaterThan(0);

    const dues = await reportsGetHandler({ tab: "dues", from, to: today }, { db, session });
    const duesReport = dues.ok ? (dues.data as DuesReportDto) : null;
    expect(duesReport!.suppliers.length, "suppliers with dues").toBeGreaterThan(0);
    expect(duesReport!.totalDue, "total dues").toBeGreaterThan(0);

    db.close();
  });
});
