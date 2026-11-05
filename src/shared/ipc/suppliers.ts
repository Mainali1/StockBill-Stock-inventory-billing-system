import type { InvoiceStatus } from "./common";

export interface SupplierSummaryDto {
  id: number;
  name: string;
  supplies: string | null;
  lastInvoiceDate: string | null;
  due: number;
}

export interface InvoiceItemDto {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface InvoiceDto {
  id: number;
  supplierId: number;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  items: InvoiceItemDto[];
}

export interface SupplierDetailDto {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
  due: number;
  invoices: InvoiceDto[];
}

export interface SupplierInput {
  id?: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
}

export interface InvoiceInput {
  supplierId: number;
  invoiceNo: string;
  invoiceDate: string;
  items: { productId: number; quantity: number; unitCost: number }[];
  paidNow: number;
}

export interface SuppliersChannels {
  "suppliers:listActive": { in: void; out: { id: number; name: string }[] };
  "suppliers:productOptions": { in: void; out: { id: number; name: string; code: string | null; cost: number }[] };
  "suppliers:list": { in: { search?: string }; out: { suppliers: SupplierSummaryDto[]; totalDue: number } };
  "suppliers:get": { in: { id: number }; out: SupplierDetailDto };
  "suppliers:save": { in: SupplierInput; out: SupplierDetailDto };
  "suppliers:delete": { in: { id: number }; out: { result: "deleted" | "archived" } };
  "invoices:create": { in: InvoiceInput; out: InvoiceDto };
  "payments:record": { in: { supplierId: number; amount: number }; out: SupplierDetailDto };
}
