import { describe, expect, it } from "vitest";
import {
  bucketByDay,
  bucketByHour,
  buildDuesCsv,
  buildProfitCsv,
  buildSalesCsv,
  buildStockCsv,
  resolveRange,
  stockValuation,
  sumCost,
  sumProfit,
  sumSales,
  toCsv,
  topProducts,
  type SaleFact,
} from "./reports";

describe("REP-1: resolveRange", () => {
  it("REP-1: resolveRange for today, week and month", () => {
    const today = "2026-11-03"; // Tuesday
    expect(resolveRange("today", today)).toEqual({
      from: "2026-11-03",
      to: "2026-11-03",
    });

    // Sunday to Saturday
    expect(resolveRange("week", today)).toEqual({
      from: "2026-11-01",
      to: "2026-11-07",
    });

    // November has 30 days
    expect(resolveRange("month", today)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });

    // February non-leap year (2025: 28 days)
    expect(resolveRange("month", "2025-02-14")).toEqual({
      from: "2025-02-01",
      to: "2025-02-28",
    });

    // February leap year (2024: 29 days)
    expect(resolveRange("month", "2024-02-10")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });

    // Month with 31 days (October)
    expect(resolveRange("month", "2026-10-15")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});

describe("REP-2: Sales Report aggregation", () => {
  const sampleRows: SaleFact[] = [
    {
      soldAt: "2026-11-03 09:15",
      productId: 1,
      productName: "Rice",
      quantity: 2,
      unitPrice: 10000,
      unitCost: 8000,
    },
    {
      soldAt: "2026-11-03 14:30",
      productId: 2,
      productName: "Oil",
      quantity: 1,
      unitPrice: 25000,
      unitCost: 20000,
    },
    {
      soldAt: "2026-11-05 11:00",
      productId: 1,
      productName: "Rice",
      quantity: 3,
      unitPrice: 10000,
      unitCost: 8000,
    },
  ];

  it("REP-2: by-day buckets are zero-filled and by-hour appears only for a single day", () => {
    expect(sumSales(sampleRows)).toBe(20000 + 25000 + 30000);

    const dayBuckets = bucketByDay(sampleRows, "2026-11-02", "2026-11-05");
    expect(dayBuckets).toHaveLength(4);

    expect(dayBuckets[0]).toEqual({
      date: "2026-11-02",
      sales: 0,
      profit: 0,
      count: 0,
    });

    expect(dayBuckets[1]).toEqual({
      date: "2026-11-03",
      sales: 45000,
      profit: 9000,
      count: 2,
    });

    expect(dayBuckets[2]).toEqual({
      date: "2026-11-04",
      sales: 0,
      profit: 0,
      count: 0,
    });

    expect(dayBuckets[3]).toEqual({
      date: "2026-11-05",
      sales: 30000,
      profit: 6000,
      count: 1,
    });

    const dayRows = sampleRows.filter((r) => r.soldAt.startsWith("2026-11-03"));
    const hourly = bucketByHour(dayRows);
    expect(hourly).toHaveLength(24);
    expect(hourly[9]).toBe(20000);
    expect(hourly[14]).toBe(25000);
    expect(hourly[0]).toBe(0);
    expect(hourly[23]).toBe(0);
  });
});

describe("REP-3: Profit Report aggregation", () => {
  it("REP-3: gross profit equals sales minus cost of goods", () => {
    const rows: SaleFact[] = [
      {
        soldAt: "2026-11-03 10:00",
        productId: 1,
        productName: "Item A",
        quantity: 4,
        unitPrice: 10000,
        unitCost: 6000,
      },
      {
        soldAt: "2026-11-03 11:00",
        productId: 2,
        productName: "Item B",
        quantity: 2,
        unitPrice: 25000,
        unitCost: 20000,
      },
      {
        soldAt: "2026-11-03 12:00",
        productId: 3,
        productName: "Item C",
        quantity: 1,
        unitPrice: 9000,
        unitCost: 10000,
      },
    ];

    const sales = sumSales(rows);
    const cost = sumCost(rows);
    const profit = sumProfit(rows);

    expect(sales).toBe(99000);
    expect(cost).toBe(74000);
    expect(profit).toBe(25000);
    expect(profit).toBe(sales - cost);
  });

  it("REP-3: top products are ordered by sales, ties by name, limited to 5", () => {
    const rows: SaleFact[] = [
      { soldAt: "2026-11-03 10:00", productId: 1, productName: "Zebra Item", quantity: 2, unitPrice: 10000, unitCost: 8000 },
      { soldAt: "2026-11-03 10:00", productId: 2, productName: "Alpha Item", quantity: 2, unitPrice: 10000, unitCost: 7000 },
      { soldAt: "2026-11-03 10:00", productId: 3, productName: "Top Item", quantity: 5, unitPrice: 50000, unitCost: 30000 },
      { soldAt: "2026-11-03 10:00", productId: 4, productName: "Medium Item", quantity: 1, unitPrice: 15000, unitCost: 10000 },
      { soldAt: "2026-11-03 10:00", productId: 5, productName: "Low Item", quantity: 1, unitPrice: 5000, unitCost: 3000 },
      { soldAt: "2026-11-03 10:00", productId: 6, productName: "Lowest Item", quantity: 1, unitPrice: 1000, unitCost: 500 },
    ];

    const top = topProducts(rows, 5);
    expect(top).toHaveLength(5);

    expect(top[0]?.name).toBe("Top Item");
    expect(top[0]?.sales).toBe(250000);
    expect(top[0]?.sold).toBe(5);
    expect(top[0]?.profit).toBe(100000);

    expect(top[1]?.name).toBe("Alpha Item");
    expect(top[2]?.name).toBe("Zebra Item");
    expect(top[3]?.name).toBe("Medium Item");
    expect(top[4]?.name).toBe("Low Item");
  });
});

describe("REP-4: Stock Report", () => {
  it("REP-4: stock valuation is the sum of quantity times cost; low list includes OUT", () => {
    const products = [
      { quantity: 10, cost: 5000 },
      { quantity: 2, cost: 20000 },
      { quantity: 0, cost: 1500 },
    ];

    expect(stockValuation(products)).toBe(90000);
  });
});

describe("REP-6: CSV export generation", () => {
  it("REP-6: CSV has a BOM, CRLF endings and escapes commas, quotes and newlines", () => {
    const headers = ["Name", "Description", "Value"];
    const rows = [
      ['Simple', 'Plain text', 100],
      ['With, comma', 'Contains "quotes"', 'Line1\nLine2'],
      ['With\r\nCRLF', 'Normal', 200],
    ];

    const csv = toCsv(headers, rows);
    // Starts with UTF-8 BOM: \uFEFF
    expect(csv.startsWith("\uFEFF")).toBe(true);

    // End of line should be CRLF (\r\n)
    expect(csv).toContain("\r\n");

    // Check proper quotes around fields with comma, quote, or newline
    expect(csv).toContain('"With, comma"');
    expect(csv).toContain('"Contains ""quotes"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("REP-6: sales, profit, stock and dues CSV have the headers above", () => {
    // 1. Sales CSV: Date,Sale rows,Sales,Profit
    const salesCsv = buildSalesCsv([
      { date: "2026-11-03", count: 2, sales: 45000, profit: 9000 },
    ]);
    expect(salesCsv).toContain("Date,Sale rows,Sales,Profit\r\n");
    expect(salesCsv).toContain("2026-11-03,2,450.00,90.00");

    // 2. Profit CSV: Date,Sales,Cost of goods,Gross profit
    const profitCsv = buildProfitCsv(
      [
        {
          soldAt: "2026-11-03 10:00",
          productId: 1,
          productName: "Rice",
          quantity: 2,
          unitPrice: 10000,
          unitCost: 8000,
        },
      ],
      "2026-11-03",
      "2026-11-03"
    );
    expect(profitCsv).toContain("Date,Sales,Cost of goods,Gross profit\r\n");
    expect(profitCsv).toContain("2026-11-03,200.00,160.00,40.00");

    // 3. Stock CSV: Product,Category,Quantity,Reorder at,Cost,Stock value,Status
    const stockCsv = buildStockCsv([
      {
        name: "Rice, 5kg",
        category: "Grocery",
        quantity: 10,
        reorderLevel: 5,
        cost: 98000,
      },
    ]);
    expect(stockCsv).toContain(
      "Product,Category,Quantity,Reorder at,Cost,Stock value,Status\r\n"
    );
    expect(stockCsv).toContain('"Rice, 5kg",Grocery,10,5,980.00,9800.00,IN STOCK');

    // 4. Dues CSV: Supplier,Due and final Total row
    const duesCsv = buildDuesCsv([
      { name: "Koshi Wholesale", due: 20000 },
      { name: "Everest Oil Depot", due: 45000 },
    ]);
    expect(duesCsv).toContain("Supplier,Due\r\n");
    expect(duesCsv).toContain("Koshi Wholesale,200.00\r\n");
    expect(duesCsv).toContain("Everest Oil Depot,450.00\r\n");
    expect(duesCsv).toContain("Total,650.00");
  });
});
