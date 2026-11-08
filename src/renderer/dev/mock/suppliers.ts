import { applyMockInvoiceItems } from "./inventory";
import type { MockModule } from "../mockApi";
import type {
  SupplierSummaryDto,
  SupplierDetailDto,
  SupplierInput,
  InvoiceInput,
  InvoiceDto,
} from "@shared/ipc/suppliers";

interface MockProductOption {
  id: number;
  name: string;
  code: string | null;
  cost: number;
}

const mockProducts: MockProductOption[] = [
  { id: 1, name: "Basmati Rice 5kg", code: "RICE5", cost: 98000 },
  { id: 2, name: "Lentils 1kg", code: null, cost: 14000 },
  { id: 3, name: "Wheat Flour 5kg", code: null, cost: 52000 },
  { id: 4, name: "Sunflower Oil 1L", code: null, cost: 27000 },
  { id: 5, name: "Tea 250g", code: null, cost: 23500 },
  { id: 6, name: "Sugar 1kg", code: "SUG1", cost: 9500 },
  { id: 7, name: "Salt 1kg", code: null, cost: 2200 },
  { id: 8, name: "Notebook A4", code: null, cost: 7200 },
  { id: 9, name: "Ballpoint Pen Pack", code: null, cost: 4500 },
  { id: 10, name: "Marker Set", code: null, cost: 12000 },
  { id: 11, name: "Soap Bar", code: null, cost: 3600 },
  { id: 12, name: "Detergent Powder 1kg", code: null, cost: 13000 },
];

interface MockSupplierData {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
  archived: boolean;
  invoices: InvoiceDto[];
}

let mockSuppliers: MockSupplierData[] = [
  {
    id: 1,
    name: "Koshi Wholesale",
    contactName: "Koshi Rep",
    phone: "9800000001",
    address: "Biratnagar",
    supplies: "Grocery staples",
    archived: false,
    invoices: [
      {
        id: 6,
        supplierId: 1,
        supplierName: "Koshi Wholesale",
        invoiceNo: "KW-2026-019",
        invoiceDate: "2026-10-30",
        total: 1568000,
        paidAmount: 0,
        status: "DUE",
        items: [
          {
            productId: 1,
            productName: "Basmati Rice 5kg",
            quantity: 16,
            unitCost: 98000,
          },
        ],
      },
      {
        id: 1,
        supplierId: 1,
        supplierName: "Koshi Wholesale",
        invoiceNo: "KW-2026-014",
        invoiceDate: "2026-10-05",
        total: 6380000,
        paidAmount: 6380000,
        status: "PAID",
        items: [
          {
            productId: 1,
            productName: "Basmati Rice 5kg",
            quantity: 38,
            unitCost: 98000,
          },
          {
            productId: 2,
            productName: "Lentils 1kg",
            quantity: 56,
            unitCost: 14000,
          },
          {
            productId: 3,
            productName: "Wheat Flour 5kg",
            quantity: 36,
            unitCost: 52000,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Everest Oil Depot",
    contactName: "Everest Rep",
    phone: "9800000002",
    address: "Kathmandu",
    supplies: "Cooking oil",
    archived: false,
    invoices: [
      {
        id: 2,
        supplierId: 2,
        supplierName: "Everest Oil Depot",
        invoiceNo: "EOD-0881",
        invoiceDate: "2026-10-08",
        total: 810000,
        paidAmount: 810000,
        status: "PAID",
        items: [
          {
            productId: 4,
            productName: "Sunflower Oil 1L",
            quantity: 30,
            unitCost: 27000,
          },
        ],
      },
    ],
  },
  {
    id: 3,
    name: "Himal Traders",
    contactName: "Himal Rep",
    phone: "9800000003",
    address: "Pokhara",
    supplies: "Tea, sugar, salt",
    archived: false,
    invoices: [
      {
        id: 3,
        supplierId: 3,
        supplierName: "Himal Traders",
        invoiceNo: "HT-3302",
        invoiceDate: "2026-10-12",
        total: 1788700,
        paidAmount: 894350,
        status: "DUE",
        items: [
          {
            productId: 5,
            productName: "Tea 250g",
            quantity: 33,
            unitCost: 23500,
          },
          {
            productId: 6,
            productName: "Sugar 1kg",
            quantity: 96,
            unitCost: 9500,
          },
          {
            productId: 7,
            productName: "Salt 1kg",
            quantity: 46,
            unitCost: 2200,
          },
        ],
      },
    ],
  },
  {
    id: 4,
    name: "Sagarmatha Stationers",
    contactName: "Sagarmatha Rep",
    phone: "9800000004",
    address: "Kathmandu",
    supplies: "Stationery",
    archived: false,
    invoices: [
      {
        id: 4,
        supplierId: 4,
        supplierName: "Sagarmatha Stationers",
        invoiceNo: "SS-207",
        invoiceDate: "2026-10-18",
        total: 741000,
        paidAmount: 0,
        status: "DUE",
        items: [
          {
            productId: 8,
            productName: "Notebook A4",
            quantity: 35,
            unitCost: 7200,
          },
          {
            productId: 9,
            productName: "Ballpoint Pen Pack",
            quantity: 50,
            unitCost: 4500,
          },
          {
            productId: 10,
            productName: "Marker Set",
            quantity: 22,
            unitCost: 12000,
          },
        ],
      },
    ],
  },
  {
    id: 5,
    name: "Mechi Household Supplies",
    contactName: "Mechi Rep",
    phone: "9800000005",
    address: "Jhapa",
    supplies: "Soap, cleaning",
    archived: false,
    invoices: [
      {
        id: 5,
        supplierId: 5,
        supplierName: "Mechi Household Supplies",
        invoiceNo: "MH-118",
        invoiceDate: "2026-10-22",
        total: 659800,
        paidAmount: 659800,
        status: "PAID",
        items: [
          {
            productId: 11,
            productName: "Soap Bar",
            quantity: 93,
            unitCost: 3600,
          },
          {
            productId: 12,
            productName: "Detergent Powder 1kg",
            quantity: 25,
            unitCost: 13000,
          },
        ],
      },
    ],
  },
];

let nextSupplierId = 6;
let nextInvoiceId = 7;

function calculateDue(s: MockSupplierData): number {
  return s.invoices.reduce((acc, inv) => acc + (inv.total - inv.paidAmount), 0);
}

function getLastInvoiceDate(s: MockSupplierData): string | null {
  if (s.invoices.length === 0) return null;
  const sorted = [...s.invoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  return sorted[0]?.invoiceDate ?? null;
}

function getSupplierDetailInternal(id: number): SupplierDetailDto {
  const s = mockSuppliers.find((x) => x.id === id && !x.archived);
  if (!s) {
    throw { code: "NOT_FOUND", message: "Supplier not found." };
  }
  return {
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    address: s.address,
    supplies: s.supplies,
    due: calculateDue(s),
    invoices: [...s.invoices].sort((a, b) => {
      const d = b.invoiceDate.localeCompare(a.invoiceDate);
      return d !== 0 ? d : b.id - a.id;
    }),
  };
}

const suppliersMock: MockModule = {
  "suppliers:listActive": () => {
    return mockSuppliers
      .filter((s) => !s.archived)
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  "suppliers:productOptions": () => {
    return mockProducts;
  },

  "suppliers:list": (payload: unknown) => {
    const input = payload as { search?: string } | undefined;
    let list = mockSuppliers.filter((s) => !s.archived);
    if (input?.search && input.search.trim()) {
      const q = input.search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.supplies && s.supplies.toLowerCase().includes(q))
      );
    }
    const summaries: SupplierSummaryDto[] = list.map((s) => ({
      id: s.id,
      name: s.name,
      supplies: s.supplies,
      lastInvoiceDate: getLastInvoiceDate(s),
      due: calculateDue(s),
    }));
    summaries.sort((a, b) => a.name.localeCompare(b.name));
    const totalDue = summaries.reduce((acc, s) => acc + s.due, 0);
    return { suppliers: summaries, totalDue };
  },

  "suppliers:get": (payload: unknown) => {
    const input = payload as { id: number };
    return getSupplierDetailInternal(input.id);
  },

  "suppliers:save": (payload: unknown) => {
    const input = payload as SupplierInput;
    const name = input.name?.trim() ?? "";
    if (!name) {
      throw {
        code: "VALIDATION",
        message: "Name is required.",
        fields: { name: "Name is required." },
      };
    }
    const dup = mockSuppliers.find(
      (s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      throw {
        code: "CONFLICT",
        message: "A supplier with that name already exists.",
        fields: { name: "A supplier with that name already exists." },
      };
    }

    if (input.id) {
      const s = mockSuppliers.find((x) => x.id === input.id && !x.archived);
      if (!s) throw { code: "NOT_FOUND", message: "Supplier not found." };
      s.name = name;
      s.contactName = input.contactName?.trim() || null;
      s.phone = input.phone?.trim() || null;
      s.address = input.address?.trim() || null;
      s.supplies = input.supplies?.trim() || null;
      return getSupplierDetailInternal(s.id);
    } else {
      const newS: MockSupplierData = {
        id: nextSupplierId++,
        name,
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        supplies: input.supplies?.trim() || null,
        archived: false,
        invoices: [],
      };
      mockSuppliers.push(newS);
      return getSupplierDetailInternal(newS.id);
    }
  },

  "suppliers:delete": (payload: unknown) => {
    const input = payload as { id: number };
    const s = mockSuppliers.find((x) => x.id === input.id && !x.archived);
    if (!s) throw { code: "NOT_FOUND", message: "Supplier not found." };
    if (s.invoices.length > 0) {
      s.archived = true;
      return { result: "archived" };
    } else {
      mockSuppliers = mockSuppliers.filter((x) => x.id !== input.id);
      return { result: "deleted" };
    }
  },

  "invoices:create": (payload: unknown) => {
    const input = payload as InvoiceInput;
    const s = mockSuppliers.find((x) => x.id === input.supplierId && !x.archived);
    if (!s) throw { code: "NOT_FOUND", message: "Supplier not found." };
    const invNo = input.invoiceNo?.trim() ?? "";
    if (!invNo) {
      throw {
        code: "VALIDATION",
        message: "Invoice number is required.",
        fields: { invoiceNo: "Invoice number is required." },
      };
    }
    if (s.invoices.some((i) => i.invoiceNo === invNo)) {
      throw {
        code: "CONFLICT",
        message: "This supplier already has an invoice with that number.",
        fields: { invoiceNo: "This supplier already has an invoice with that number." },
      };
    }
    if (!input.items || input.items.length === 0) {
      throw {
        code: "VALIDATION",
        message: "Add at least one item.",
        fields: { items: "Add at least one item." },
      };
    }
    let total = 0;
    for (const item of input.items) {
      total += item.quantity * item.unitCost;
    }
    if (input.paidNow > total) {
      throw {
        code: "VALIDATION",
        message: "Amount paid cannot be more than the invoice total.",
        fields: { paidNow: "Amount paid cannot be more than the invoice total." },
      };
    }
    const newInvoice: InvoiceDto = {
      id: nextInvoiceId++,
      supplierId: s.id,
      supplierName: s.name,
      invoiceNo: invNo,
      invoiceDate: input.invoiceDate,
      total,
      paidAmount: input.paidNow,
      status: input.paidNow >= total ? "PAID" : "DUE",
      items: input.items.map((it) => {
        const prod = mockProducts.find((p) => p.id === it.productId);
        return {
          productId: it.productId,
          productName: prod?.name ?? "Unknown",
          quantity: it.quantity,
          unitCost: it.unitCost,
        };
      }),
    };
    s.invoices.unshift(newInvoice);

    applyMockInvoiceItems(input.items);

    for (const it of input.items) {
      const prod = mockProducts.find((p) => p.id === it.productId);
      if (prod) {
        prod.cost = it.unitCost;
      }
    }

    return newInvoice;
  },

  "payments:record": (payload: unknown) => {
    const input = payload as { supplierId: number; amount: number };
    if (input.amount <= 0) {
      throw {
        code: "VALIDATION",
        message: "Enter an amount greater than 0.",
        fields: { amount: "Enter an amount greater than 0." },
      };
    }
    const s = mockSuppliers.find((x) => x.id === input.supplierId && !x.archived);
    if (!s) throw { code: "NOT_FOUND", message: "Supplier not found." };
    const due = calculateDue(s);
    if (input.amount > due) {
      const formattedDue = (due / 100).toLocaleString("en-IN", {
        minimumFractionDigits: due % 100 !== 0 ? 2 : 0,
      });
      throw {
        code: "RULE",
        message: `Payment is more than the balance due (Rs. ${formattedDue}).`,
      };
    }
    const unpaid = [...s.invoices]
      .filter((i) => i.paidAmount < i.total)
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id);
    let remaining = input.amount;
    for (const inv of unpaid) {
      if (remaining <= 0) break;
      const invDue = inv.total - inv.paidAmount;
      const pay = Math.min(remaining, invDue);
      inv.paidAmount += pay;
      inv.status = inv.paidAmount >= inv.total ? "PAID" : "DUE";
      remaining -= pay;
    }
    return getSupplierDetailInternal(s.id);
  },
};

export default suppliersMock;
