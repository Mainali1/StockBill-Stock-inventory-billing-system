import { addDays } from "../../src/main/domain/dates";

export interface DemoSupplier {
  name: string;
  supplies: string;
  contactName: string;
  phone: string;
}

export interface DemoProduct {
  name: string;
  category: string;
  supplier: string;
  code: string | null;
  cost: number; // in paisa
  price: number; // in paisa
  finalQty: number;
  reorderAt: number;
}

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    name: "Koshi Wholesale",
    supplies: "Grocery staples",
    contactName: "Koshi Rep",
    phone: "9800000001",
  },
  {
    name: "Everest Oil Depot",
    supplies: "Cooking oil",
    contactName: "Everest Rep",
    phone: "9800000002",
  },
  { name: "Himal Traders", supplies: "Tea, sugar, salt", contactName: "Himal Rep", phone: "9800000003" },
  {
    name: "Sagarmatha Stationers",
    supplies: "Stationery",
    contactName: "Sagarmatha Rep",
    phone: "9800000004",
  },
  {
    name: "Mechi Household Supplies",
    supplies: "Soap, cleaning",
    contactName: "Mechi Rep",
    phone: "9800000005",
  },
];

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "Basmati Rice 5kg",
    category: "Grocery",
    supplier: "Koshi Wholesale",
    code: "RICE5",
    cost: 98000,
    price: 115000,
    finalQty: 24,
    reorderAt: 10,
  },
  {
    name: "Lentils 1kg",
    category: "Grocery",
    supplier: "Koshi Wholesale",
    code: null,
    cost: 14000,
    price: 17000,
    finalQty: 35,
    reorderAt: 15,
  },
  {
    name: "Wheat Flour 5kg",
    category: "Grocery",
    supplier: "Koshi Wholesale",
    code: null,
    cost: 52000,
    price: 60000,
    finalQty: 18,
    reorderAt: 8,
  },
  {
    name: "Sunflower Oil 1L",
    category: "Grocery",
    supplier: "Everest Oil Depot",
    code: null,
    cost: 27000,
    price: 32000,
    finalQty: 4,
    reorderAt: 12,
  },
  {
    name: "Tea 250g",
    category: "Grocery",
    supplier: "Himal Traders",
    code: null,
    cost: 23500,
    price: 28000,
    finalQty: 2,
    reorderAt: 8,
  },
  {
    name: "Sugar 1kg",
    category: "Grocery",
    supplier: "Himal Traders",
    code: "SUG1",
    cost: 9500,
    price: 11000,
    finalQty: 60,
    reorderAt: 20,
  },
  {
    name: "Salt 1kg",
    category: "Grocery",
    supplier: "Himal Traders",
    code: null,
    cost: 2200,
    price: 2800,
    finalQty: 0,
    reorderAt: 15,
  },
  {
    name: "Notebook A4",
    category: "Stationery",
    supplier: "Sagarmatha Stationers",
    code: null,
    cost: 7200,
    price: 9000,
    finalQty: 5,
    reorderAt: 15,
  },
  {
    name: "Ballpoint Pen Pack",
    category: "Stationery",
    supplier: "Sagarmatha Stationers",
    code: null,
    cost: 4500,
    price: 6000,
    finalQty: 40,
    reorderAt: 12,
  },
  {
    name: "Marker Set",
    category: "Stationery",
    supplier: "Sagarmatha Stationers",
    code: null,
    cost: 12000,
    price: 16000,
    finalQty: 22,
    reorderAt: 6,
  },
  {
    name: "Soap Bar",
    category: "Household",
    supplier: "Mechi Household Supplies",
    code: null,
    cost: 3600,
    price: 4500,
    finalQty: 80,
    reorderAt: 25,
  },
  {
    name: "Detergent Powder 1kg",
    category: "Household",
    supplier: "Mechi Household Supplies",
    code: null,
    cost: 13000,
    price: 16000,
    finalQty: 14,
    reorderAt: 10,
  },
];

export interface PlannedSaleRow {
  productName: string;
  quantity: number;
  unitPrice: number;
  soldAt: string; // "YYYY-MM-DD HH:MM"
}

function createPrng(seed: number) {
  let s = seed;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSalesPlan(today: string): PlannedSaleRow[] {
  const rand = createPrng(20261103);

  const dates: string[] = [];
  for (let i = 9; i >= 0; i--) {
    dates.push(addDays(today, -i));
  }

  const productWeights = [
    5, // Basmati Rice
    6, // Lentils
    5, // Wheat Flour
    4, // Sunflower Oil
    4, // Tea
    8, // Sugar
    7, // Salt
    3, // Notebook A4
    4, // Ballpoint Pen Pack
    2, // Marker Set
    5, // Soap Bar
    3, // Detergent Powder
  ];

  const totalWeight = productWeights.reduce((a, b) => a + b, 0);

  function pickProduct(): DemoProduct {
    let r = rand() * totalWeight;
    for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
      const weight = productWeights[i] ?? 0;
      r -= weight;
      if (r <= 0) {
        return DEMO_PRODUCTS[i] ?? DEMO_PRODUCTS[0]!;
      }
    }
    return DEMO_PRODUCTS[0]!;
  }

  const rows: PlannedSaleRow[] = [];

  const dayCounts: number[] = [
    11, // Sun
    7, // Mon
    8, // Tue
    9, // Wed
    14, // Thu
    10, // Fri
    13, // Sat
    12, // Sun 2
    6, // Mon 2
    9, // Tue 2
  ];

  for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
    const date = dates[dayIdx] ?? today;
    const count = dayCounts[dayIdx] ?? 10;

    const dayRows: PlannedSaleRow[] = [];
    for (let r = 0; r < count; r++) {
      const prod = pickProduct();
      const qty = 1 + Math.floor(rand() * 4);
      const hour = 9 + Math.floor(rand() * 12);
      const minute = Math.floor(rand() * 60);
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      dayRows.push({
        productName: prod.name,
        quantity: qty,
        unitPrice: prod.price,
        soldAt: `${date} ${timeStr}`,
      });
    }

    dayRows.sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    rows.push(...dayRows);
  }

  return rows;
}
