import type { MockModule } from "../mockApi";
import type { ProductDto, ProductInput } from "@shared/ipc/inventory";
import type { ProductStatus } from "@shared/ipc/common";

function productStatus(quantity: number, reorderLevel: number): ProductStatus {
  if (quantity === 0) return "OUT";
  if (quantity <= reorderLevel) return "LOW";
  return "IN_STOCK";
}

interface ProductMockRecord {
  id: number;
  name: string;
  code: string | null;
  category: string;
  supplierId: number | null;
  supplierName: string | null;
  cost: number;
  price: number;
  quantity: number;
  reorderLevel: number;
  archived: number;
}

const suppliersMap: Record<number, string> = {
  1: "Koshi Wholesale",
  2: "Everest Oil Depot",
  3: "Himal Traders",
  4: "Sagarmatha Stationers",
  5: "Mechi Household Supplies",
};

// Seeded from Demo data table in JULES_TASK.md
let products: ProductMockRecord[] = [
  { id: 1, name: "Basmati Rice 5kg", code: "RICE5", category: "Grocery", supplierId: 1, supplierName: suppliersMap[1] ?? null, cost: 98000, price: 115000, quantity: 24, reorderLevel: 10, archived: 0 },
  { id: 2, name: "Lentils 1kg", code: null, category: "Grocery", supplierId: 1, supplierName: suppliersMap[1] ?? null, cost: 14000, price: 17000, quantity: 35, reorderLevel: 15, archived: 0 },
  { id: 3, name: "Wheat Flour 5kg", code: null, category: "Grocery", supplierId: 1, supplierName: suppliersMap[1] ?? null, cost: 52000, price: 60000, quantity: 18, reorderLevel: 8, archived: 0 },
  { id: 4, name: "Sunflower Oil 1L", code: null, category: "Grocery", supplierId: 2, supplierName: suppliersMap[2] ?? null, cost: 27000, price: 32000, quantity: 4, reorderLevel: 12, archived: 0 },
  { id: 5, name: "Tea 250g", code: null, category: "Grocery", supplierId: 3, supplierName: suppliersMap[3] ?? null, cost: 23500, price: 28000, quantity: 2, reorderLevel: 8, archived: 0 },
  { id: 6, name: "Sugar 1kg", code: "SUG1", category: "Grocery", supplierId: 3, supplierName: suppliersMap[3] ?? null, cost: 9500, price: 11000, quantity: 60, reorderLevel: 20, archived: 0 },
  { id: 7, name: "Salt 1kg", code: null, category: "Grocery", supplierId: 3, supplierName: suppliersMap[3] ?? null, cost: 2200, price: 2800, quantity: 0, reorderLevel: 15, archived: 0 },
  { id: 8, name: "Notebook A4", code: null, category: "Stationery", supplierId: 4, supplierName: suppliersMap[4] ?? null, cost: 7200, price: 9000, quantity: 5, reorderLevel: 15, archived: 0 },
  { id: 9, name: "Ballpoint Pen Pack", code: null, category: "Stationery", supplierId: 4, supplierName: suppliersMap[4] ?? null, cost: 4500, price: 6000, quantity: 40, reorderLevel: 12, archived: 0 },
  { id: 10, name: "Marker Set", code: null, category: "Stationery", supplierId: 4, supplierName: suppliersMap[4] ?? null, cost: 12000, price: 16000, quantity: 22, reorderLevel: 6, archived: 0 },
  { id: 11, name: "Soap Bar", code: null, category: "Household", supplierId: 5, supplierName: suppliersMap[5] ?? null, cost: 3600, price: 4500, quantity: 80, reorderLevel: 25, archived: 0 },
  { id: 12, name: "Detergent Powder 1kg", code: null, category: "Household", supplierId: 5, supplierName: suppliersMap[5] ?? null, cost: 13000, price: 16000, quantity: 14, reorderLevel: 10, archived: 0 },
];

function toDto(p: ProductMockRecord): ProductDto {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    category: p.category,
    supplierId: p.supplierId,
    supplierName: p.supplierName,
    cost: p.cost,
    price: p.price,
    quantity: p.quantity,
    reorderLevel: p.reorderLevel,
    status: productStatus(p.quantity, p.reorderLevel),
  };
}

class MockError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const inventoryMock: MockModule = {
  "inventory:list": (payload: unknown) => {
    const filter = (payload ?? {}) as { search?: string; category?: string | null; lowOnly?: boolean };
    let list = products.filter((p) => p.archived === 0);

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

    if (filter.lowOnly) {
      list = list.filter((p) => p.quantity <= p.reorderLevel);
    }

    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list.map(toDto);
  },

  "inventory:categories": () => {
    const cats = new Set<string>();
    for (const p of products) {
      if (p.archived === 0) {
        cats.add(p.category);
      }
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  },

  "inventory:save": (payload: unknown) => {
    const input = payload as ProductInput;
    const name = input.name?.trim() ?? "";
    const category = input.category?.trim() ?? "";
    const code = input.code?.trim() || null;

    if (code) {
      const existing = products.find((p) => p.code?.toLowerCase() === code.toLowerCase() && p.id !== input.id);
      if (existing) {
        throw new MockError(`That code is already used by ${existing.name}.`, "CONFLICT");
      }
    }

    const warnings: string[] = [];
    if (input.price < input.cost) {
      warnings.push("Price is lower than cost. You will lose money on each sale.");
    }

    const supplierName = input.supplierId ? (suppliersMap[input.supplierId] ?? null) : null;

    if (input.id) {
      const idx = products.findIndex((p) => p.id === input.id && p.archived === 0);
      const current = products[idx];
      if (idx === -1 || !current) {
        throw new MockError("Product not found.", "NOT_FOUND");
      }
      const updated: ProductMockRecord = {
        ...current,
        id: current.id,
        name,
        code,
        category,
        supplierId: input.supplierId ?? null,
        supplierName,
        cost: input.cost,
        price: input.price,
        quantity: input.quantity,
        reorderLevel: input.reorderLevel,
      };
      products[idx] = updated;
      return { product: toDto(updated), warnings };
    } else {
      const nextId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
      const newRec: ProductMockRecord = {
        id: nextId,
        name,
        code,
        category,
        supplierId: input.supplierId ?? null,
        supplierName,
        cost: input.cost,
        price: input.price,
        quantity: input.quantity,
        reorderLevel: input.reorderLevel,
        archived: 0,
      };
      products.push(newRec);
      return { product: toDto(newRec), warnings };
    }
  },

  "inventory:delete": (payload: unknown) => {
    const { id } = payload as { id: number };
    const p = products.find((prod) => prod.id === id);
    if (!p || p.archived === 1) {
      throw new MockError("Product not found.", "NOT_FOUND");
    }

    // Basmati rice and Salt have history in demo
    if (id <= 6) {
      p.archived = 1;
      return { result: "archived" };
    } else {
      products = products.filter((prod) => prod.id !== id);
      return { result: "deleted" };
    }
  },
};

export function applyMockInvoiceItems(
  items: { productId: number; quantity: number; unitCost: number }[]
): void {
  for (const item of items) {
    const prod = products.find((p) => p.id === item.productId && p.archived === 0);
    if (prod) {
      prod.quantity += item.quantity;
      prod.cost = item.unitCost;
    }
  }
}

export default inventoryMock;
