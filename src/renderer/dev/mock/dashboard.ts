import type { MockModule } from "../mockApi";
import type { DashboardDto } from "@shared/ipc/reports";
import { buildWeekBars, isDateToday } from "../../../main/domain/dashboard";

interface MockProduct {
  id: number;
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  cost: number;
  price: number;
  archived: number;
}

const mockProducts: MockProduct[] = [
  { id: 1, name: "Basmati Rice 5kg", category: "Grocery", quantity: 24, reorderLevel: 10, cost: 98000, price: 115000, archived: 0 },
  { id: 2, name: "Lentils 1kg", category: "Grocery", quantity: 35, reorderLevel: 15, cost: 14000, price: 17000, archived: 0 },
  { id: 3, name: "Wheat Flour 5kg", category: "Grocery", quantity: 18, reorderLevel: 8, cost: 52000, price: 60000, archived: 0 },
  { id: 4, name: "Sunflower Oil 1L", category: "Grocery", quantity: 4, reorderLevel: 12, cost: 27000, price: 32000, archived: 0 },
  { id: 5, name: "Tea 250g", category: "Grocery", quantity: 2, reorderLevel: 8, cost: 23500, price: 28000, archived: 0 },
  { id: 6, name: "Sugar 1kg", category: "Grocery", quantity: 60, reorderLevel: 20, cost: 9500, price: 11000, archived: 0 },
  { id: 7, name: "Salt 1kg", category: "Grocery", quantity: 0, reorderLevel: 15, cost: 2200, price: 2800, archived: 0 },
  { id: 8, name: "Notebook A4", category: "Stationery", quantity: 5, reorderLevel: 15, cost: 7200, price: 9000, archived: 0 },
  { id: 9, name: "Ballpoint Pen Pack", category: "Stationery", quantity: 40, reorderLevel: 12, cost: 4500, price: 6000, archived: 0 },
  { id: 10, name: "Marker Set", category: "Stationery", quantity: 22, reorderLevel: 6, cost: 12000, price: 16000, archived: 0 },
  { id: 11, name: "Soap Bar", category: "Household", quantity: 80, reorderLevel: 25, cost: 3600, price: 4500, archived: 0 },
  { id: 12, name: "Detergent Powder 1kg", category: "Household", quantity: 14, reorderLevel: 10, cost: 13000, price: 16000, archived: 0 },
];

const mockRecentInvoices: DashboardDto["recentInvoices"] = [
  {
    id: 6,
    supplierId: 1,
    invoiceNo: "KW-2026-019",
    supplierName: "Koshi Wholesale",
    total: 1568000,
    status: "DUE",
  },
  {
    id: 5,
    supplierId: 5,
    invoiceNo: "MH-118",
    supplierName: "Mechi Household Supplies",
    total: 470000,
    status: "PAID",
  },
  {
    id: 4,
    supplierId: 4,
    invoiceNo: "SS-207",
    supplierName: "Sagarmatha Stationers",
    total: 480000,
    status: "DUE",
  },
  {
    id: 3,
    supplierId: 3,
    invoiceNo: "HT-3302",
    supplierName: "Himal Traders",
    total: 1040000,
    status: "DUE",
  },
];

const dashboardMock: MockModule = {
  "dashboard:get": (payload: unknown): DashboardDto => {
    const input = (payload ?? {}) as { date?: string };
    const date = input.date ?? "2026-11-03";

    const lowStockCount = mockProducts.filter(
      (p) => p.archived === 0 && p.quantity <= p.reorderLevel
    ).length;

    const restock = mockProducts
      .filter((p) => p.archived === 0 && p.quantity <= p.reorderLevel)
      .sort(
        (a, b) =>
          a.quantity - b.quantity ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      )
      .slice(0, 4)
      .map((p) => ({ productId: p.id, name: p.name, quantity: p.quantity }));

    const week = buildWeekBars(date, [
      { date, sales: 4825000, profit: 912000 },
    ]);

    return {
      date,
      isToday: isDateToday(date),
      sales: 4825000,
      profit: 912000,
      lowStockCount,
      supplierDue: 12000000,
      week,
      restock,
      recentInvoices: mockRecentInvoices,
    };
  },
};

export default dashboardMock;
