import type { MockModule } from "../mockApi";
import type { SalePickerProductDto } from "@shared/ipc/sales";

interface MockProduct {
  id: number;
  name: string;
  code: string | null;
  category: string;
  quantity: number;
  price: number;
  cost: number;
  archived: number;
}

const mockProducts: MockProduct[] = [
  { id: 1, name: "Basmati Rice 5kg", code: "RICE5", category: "Grocery", quantity: 24, price: 115000, cost: 98000, archived: 0 },
  { id: 2, name: "Lentils 1kg", code: null, category: "Grocery", quantity: 35, price: 17000, cost: 14000, archived: 0 },
  { id: 3, name: "Wheat Flour 5kg", code: null, category: "Grocery", quantity: 18, price: 60000, cost: 52000, archived: 0 },
  { id: 4, name: "Sunflower Oil 1L", code: null, category: "Grocery", quantity: 4, price: 32000, cost: 27000, archived: 0 },
  { id: 5, name: "Tea 250g", code: null, category: "Grocery", quantity: 2, price: 28000, cost: 23500, archived: 0 },
  { id: 6, name: "Sugar 1kg", code: "SUG1", category: "Grocery", quantity: 60, price: 11000, cost: 9500, archived: 0 },
  { id: 7, name: "Salt 1kg", code: null, category: "Grocery", quantity: 0, price: 2800, cost: 2200, archived: 0 },
  { id: 8, name: "Notebook A4", code: null, category: "Stationery", quantity: 5, price: 9000, cost: 7200, archived: 0 },
  { id: 9, name: "Ballpoint Pen Pack", code: null, category: "Stationery", quantity: 40, price: 6000, cost: 4500, archived: 0 },
  { id: 10, name: "Marker Set", code: null, category: "Stationery", quantity: 22, price: 16000, cost: 12000, archived: 0 },
  { id: 11, name: "Soap Bar", code: null, category: "Household", quantity: 80, price: 4500, cost: 3600, archived: 0 },
  { id: 12, name: "Detergent Powder 1kg", code: null, category: "Household", quantity: 14, price: 16000, cost: 13000, archived: 0 },
];

const salesMock: MockModule = {
  "sales:picker": (payload: unknown) => {
    const filter = (payload ?? {}) as { search?: string; category?: string | null };
    let list = mockProducts.filter((p) => p.archived === 0);

    if (filter.search && filter.search.trim().length > 0) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
      );
    }

    if (filter.category && filter.category.trim().length > 0) {
      const cat = filter.category.trim().toLowerCase();
      list = list.filter((p) => p.category.toLowerCase() === cat);
    }

    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const categories = Array.from(
      new Set(mockProducts.filter((p) => p.archived === 0).map((p) => p.category))
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    const products: SalePickerProductDto[] = list.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category,
      quantity: p.quantity,
      price: p.price,
    }));

    return { products, categories };
  },

  "sales:save": (payload: unknown) => {
    const input = payload as { soldAt: string; lines: { productId: number; quantity: number; unitPrice: number }[] };
    if (!input.lines || input.lines.length === 0) {
      throw { code: "VALIDATION", message: "Add at least one item." };
    }

    const requiredMap = new Map<number, number>();
    for (const l of input.lines) {
      requiredMap.set(l.productId, (requiredMap.get(l.productId) ?? 0) + l.quantity);
    }

    for (const l of input.lines) {
      const prod = mockProducts.find((p) => p.id === l.productId && p.archived === 0);
      if (!prod) {
        throw { code: "NOT_FOUND", message: "Product not found." };
      }
      const totalReq = requiredMap.get(l.productId) ?? 0;
      if (totalReq > prod.quantity) {
        throw { code: "RULE", message: `Only ${prod.quantity} of ${prod.name} in stock.` };
      }
    }

    for (const [prodId, qty] of requiredMap.entries()) {
      const prod = mockProducts.find((p) => p.id === prodId)!;
      prod.quantity -= qty;
    }

    const datePart = input.soldAt.slice(0, 10);
    return {
      date: datePart,
      total: 0,
      profit: 0,
      count: input.lines.length,
      hourly: new Array(24).fill(0),
      rows: [],
    };
  },

  "sales:day": (payload: unknown) => {
    const input = payload as { date: string };
    return {
      date: input.date,
      total: 0,
      profit: 0,
      count: 0,
      hourly: new Array(24).fill(0),
      rows: [],
    };
  },

  "sales:update": (_payload: unknown) => {
    return;
  },

  "sales:delete": (_payload: unknown) => {
    return;
  },
};

export default salesMock;
