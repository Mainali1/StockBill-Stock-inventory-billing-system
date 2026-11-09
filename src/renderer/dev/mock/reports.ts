import type {
  DuesReportDto,
  ProfitReportDto,
  ReportTab,
  SalesReportDto,
  StockReportDto,
} from "@shared/ipc/reports";
import type { MockModule } from "../mockApi";

interface MockReportsGetInput {
  tab: ReportTab;
  from: string;
  to: string;
}

const reportsMock: MockModule = {
  "reports:get": (rawInput: unknown) => {
    const { tab, from, to } = rawInput as MockReportsGetInput;

    if (tab === "profit") {
      const profitReport: ProfitReportDto = {
        tab: "profit",
        totalSales: 28640000,
        costOfGoods: 21930000,
        grossProfit: 6710000,
        count: 142,
        byDay: [
          { date: "2026-11-01", sales: 70000, profit: 16000, count: 5 },
          { date: "2026-11-02", sales: 95000, profit: 22000, count: 7 },
          { date: "2026-11-03", sales: 60000, profit: 14000, count: 4 },
          { date: "2026-11-04", sales: 120000, profit: 28000, count: 8 },
          { date: "2026-11-05", sales: 150000, profit: 35000, count: 10 },
          { date: "2026-11-06", sales: 85000, profit: 20000, count: 6 },
          { date: "2026-11-07", sales: 110000, profit: 26000, count: 8 },
        ],
        top: [
          { productId: 1, name: "Basmati rice 5kg", sold: 96, sales: 11040000, profit: 1632000 },
          { productId: 2, name: "Sunflower oil 1L", sold: 120, sales: 3840000, profit: 600000 },
          { productId: 3, name: "Sugar 1kg", sold: 210, sales: 2310000, profit: 315000 },
          { productId: 4, name: "Tea 250g", sold: 80, sales: 2240000, profit: 360000 },
          { productId: 5, name: "Notebook A4", sold: 150, sales: 1350000, profit: 270000 },
        ],
      };
      return profitReport;
    }

    if (tab === "sales") {
      const salesReport: SalesReportDto = {
        tab: "sales",
        total: 28640000,
        count: 142,
        byDay: [
          { date: "2026-11-01", sales: 70000, profit: 16000, count: 5 },
          { date: "2026-11-02", sales: 95000, profit: 22000, count: 7 },
          { date: "2026-11-03", sales: 60000, profit: 14000, count: 4 },
          { date: "2026-11-04", sales: 120000, profit: 28000, count: 8 },
          { date: "2026-11-05", sales: 150000, profit: 35000, count: 10 },
          { date: "2026-11-06", sales: 85000, profit: 20000, count: 6 },
          { date: "2026-11-07", sales: 110000, profit: 26000, count: 8 },
        ],
        byHour:
          from === to
            ? [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 20000, 30000, 15000, 45000, 10000, 25000, 0, 0,
                0, 0, 0, 0, 0, 0, 0,
              ]
            : null,
      };
      return salesReport;
    }

    if (tab === "stock") {
      const stockReport: StockReportDto = {
        tab: "stock",
        valuation: 45000000,
        productCount: 12,
        low: [
          { id: 4, name: "Sunflower Oil 1L", quantity: 4, reorderLevel: 12, status: "LOW" },
          { id: 5, name: "Tea 250g", quantity: 2, reorderLevel: 8, status: "LOW" },
          { id: 7, name: "Salt 1kg", quantity: 0, reorderLevel: 15, status: "OUT" },
          { id: 8, name: "Notebook A4", quantity: 5, reorderLevel: 15, status: "LOW" },
        ],
      };
      return stockReport;
    }

    if (tab === "dues") {
      const duesReport: DuesReportDto = {
        tab: "dues",
        suppliers: [
          { id: 1, name: "Koshi Wholesale", due: 3500000 },
          { id: 3, name: "Himal Traders", due: 1500000 },
          { id: 4, name: "Sagarmatha Stationers", due: 2000000 },
        ],
        totalDue: 7000000,
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
  },

  "reports:exportCsv": () => {
    return {
      saved: true,
      path: "/mock/download/stockbill-report.csv",
    };
  },
};

export default reportsMock;
