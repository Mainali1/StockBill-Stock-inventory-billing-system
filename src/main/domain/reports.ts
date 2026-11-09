import type { DayBucketDto } from "@shared/ipc/reports";
import { eachDay, hourOf, monthRange, weekRange } from "./dates";
import { paisaToRupeesString } from "./money";
import { productStatus } from "./stock";

export interface SaleFact {
  soldAt: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export type RangePreset = "today" | "week" | "month";

/**
 * Resolves preset range ('today' | 'week' | 'month') given reference date.
 * - today: { from: date, to: date }
 * - week: Sunday to Saturday
 * - month: first to last day of month
 */
export function resolveRange(
  preset: RangePreset,
  today: string
): { from: string; to: string } {
  if (preset === "today") {
    return { from: today, to: today };
  }
  if (preset === "week") {
    const { start, end } = weekRange(today);
    return { from: start, to: end };
  }
  if (preset === "month") {
    const { start, end } = monthRange(today);
    return { from: start, to: end };
  }
  return { from: today, to: today };
}

/**
 * Sums sales (quantity * unitPrice) across rows in integer paisa.
 */
export function sumSales(rows: SaleFact[]): number {
  return rows.reduce((acc, r) => acc + r.quantity * r.unitPrice, 0);
}

/**
 * Sums cost of goods (quantity * unitCost) across rows in integer paisa.
 */
export function sumCost(rows: SaleFact[]): number {
  return rows.reduce((acc, r) => acc + r.quantity * r.unitCost, 0);
}

/**
 * Sums gross profit (quantity * (unitPrice - unitCost)) across rows in integer paisa.
 */
export function sumProfit(rows: SaleFact[]): number {
  return rows.reduce((acc, r) => acc + r.quantity * (r.unitPrice - r.unitCost), 0);
}

/**
 * Buckets sales into one bucket per day from `from` to `to` inclusive, zero-filled.
 */
export function bucketByDay(
  rows: SaleFact[],
  from: string,
  to: string
): DayBucketDto[] {
  const days = eachDay(from, to);
  const map = new Map<string, { sales: number; profit: number; count: number }>();

  for (const d of days) {
    map.set(d, { sales: 0, profit: 0, count: 0 });
  }

  for (const r of rows) {
    const dateStr = r.soldAt.slice(0, 10);
    const entry = map.get(dateStr);
    if (entry) {
      entry.sales += r.quantity * r.unitPrice;
      entry.profit += r.quantity * (r.unitPrice - r.unitCost);
      entry.count += 1;
    }
  }

  return days.map((d) => {
    const entry = map.get(d) ?? { sales: 0, profit: 0, count: 0 };
    return {
      date: d,
      sales: entry.sales,
      profit: entry.profit,
      count: entry.count,
    };
  });
}

/**
 * 24 entries of sales in paisa, indexed 0 to 23.
 */
export function bucketByHour(rows: SaleFact[]): number[] {
  const hours = new Array(24).fill(0) as number[];
  for (const r of rows) {
    const h = hourOf(r.soldAt);
    if (h >= 0 && h < 24) {
      const current = hours[h] ?? 0;
      hours[h] = current + r.quantity * r.unitPrice;
    }
  }
  return hours;
}

/**
 * Grouped by product; sold = quantity sum; ordered by sales descending, then name ascending.
 */
export function topProducts(
  rows: SaleFact[],
  limit = 5
): { productId: number; name: string; sold: number; sales: number; profit: number }[] {
  const map = new Map<
    number,
    { productId: number; name: string; sold: number; sales: number; profit: number }
  >();

  for (const r of rows) {
    let entry = map.get(r.productId);
    if (!entry) {
      entry = {
        productId: r.productId,
        name: r.productName,
        sold: 0,
        sales: 0,
        profit: 0,
      };
      map.set(r.productId, entry);
    }
    entry.sold += r.quantity;
    entry.sales += r.quantity * r.unitPrice;
    entry.profit += r.quantity * (r.unitPrice - r.unitCost);
  }

  const items = Array.from(map.values());
  items.sort((a, b) => {
    if (b.sales !== a.sales) {
      return b.sales - a.sales;
    }
    return a.name.localeCompare(b.name);
  });

  return items.slice(0, limit);
}

/**
 * Sum of quantity * cost in paisa.
 */
export function stockValuation(
  products: { quantity: number; cost: number }[]
): number {
  return products.reduce((acc, p) => acc + p.quantity * p.cost, 0);
}

function escapeCsvField(val: string | number): string {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Pure CSV serializer with UTF-8 BOM, CRLF line endings, and proper quoting.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvField).join(","));

  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Build CSV for sales tab: Date,Sale rows,Sales,Profit
 */
export function buildSalesCsv(buckets: DayBucketDto[]): string {
  const headers = ["Date", "Sale rows", "Sales", "Profit"];
  const rows = buckets.map((b) => [
    b.date,
    b.count,
    paisaToRupeesString(b.sales),
    paisaToRupeesString(b.profit),
  ]);
  return toCsv(headers, rows);
}

/**
 * Build CSV for profit tab: Date,Sales,Cost of goods,Gross profit
 */
export function buildProfitCsv(
  rows: SaleFact[],
  from: string,
  to: string
): string {
  const days = eachDay(from, to);
  const map = new Map<string, { sales: number; cost: number; profit: number }>();
  for (const d of days) {
    map.set(d, { sales: 0, cost: 0, profit: 0 });
  }

  for (const r of rows) {
    const d = r.soldAt.slice(0, 10);
    const entry = map.get(d);
    if (entry) {
      entry.sales += r.quantity * r.unitPrice;
      entry.cost += r.quantity * r.unitCost;
      entry.profit += r.quantity * (r.unitPrice - r.unitCost);
    }
  }

  const headers = ["Date", "Sales", "Cost of goods", "Gross profit"];
  const csvRows = days.map((d) => {
    const entry = map.get(d) ?? { sales: 0, cost: 0, profit: 0 };
    return [
      d,
      paisaToRupeesString(entry.sales),
      paisaToRupeesString(entry.cost),
      paisaToRupeesString(entry.profit),
    ];
  });

  return toCsv(headers, csvRows);
}

export interface StockCsvItem {
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  cost: number;
}

/**
 * Build CSV for stock tab: Product,Category,Quantity,Reorder at,Cost,Stock value,Status
 */
export function buildStockCsv(products: StockCsvItem[]): string {
  const headers = [
    "Product",
    "Category",
    "Quantity",
    "Reorder at",
    "Cost",
    "Stock value",
    "Status",
  ];

  const rows = products.map((p) => {
    const status = productStatus(p.quantity, p.reorderLevel);
    const statusLabel =
      status === "IN_STOCK" ? "IN STOCK" : status === "LOW" ? "LOW" : "OUT";
    return [
      p.name,
      p.category,
      p.quantity,
      p.reorderLevel,
      paisaToRupeesString(p.cost),
      paisaToRupeesString(p.quantity * p.cost),
      statusLabel,
    ];
  });

  return toCsv(headers, rows);
}

export interface DueCsvItem {
  name: string;
  due: number;
}

/**
 * Build CSV for dues tab: Supplier,Due and final Total row
 */
export function buildDuesCsv(suppliers: DueCsvItem[]): string {
  const headers = ["Supplier", "Due"];
  let totalDue = 0;
  const rows: (string | number)[][] = [];

  for (const s of suppliers) {
    totalDue += s.due;
    rows.push([s.name, paisaToRupeesString(s.due)]);
  }

  rows.push(["Total", paisaToRupeesString(totalDue)]);

  return toCsv(headers, rows);
}
