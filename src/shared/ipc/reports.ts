import type { InvoiceStatus, ProductStatus } from "./common";

export interface WeekBarDto { date: string; label: string; sales: number; profit: number }

export interface DashboardDto {
  date: string;
  isToday: boolean;
  sales: number;
  profit: number;
  lowStockCount: number;
  supplierDue: number;
  week: WeekBarDto[];
  restock: { productId: number; name: string; quantity: number }[];
  recentInvoices: {
    id: number; supplierId: number; invoiceNo: string; supplierName: string; total: number; status: InvoiceStatus;
  }[];
}

export type ReportTab = "sales" | "profit" | "stock" | "dues";

export interface DayBucketDto { date: string; sales: number; profit: number; count: number }

export interface SalesReportDto {
  tab: "sales";
  total: number;
  count: number;
  byDay: DayBucketDto[];
  /** present only when from === to, 24 entries */
  byHour: number[] | null;
}

export interface ProfitReportDto {
  tab: "profit";
  totalSales: number;
  costOfGoods: number;
  grossProfit: number;
  count: number;
  byDay: DayBucketDto[];
  top: { productId: number; name: string; sold: number; sales: number; profit: number }[];
}

export interface StockReportDto {
  tab: "stock";
  valuation: number;
  productCount: number;
  low: { id: number; name: string; quantity: number; reorderLevel: number; status: ProductStatus }[];
}

export interface DuesReportDto {
  tab: "dues";
  suppliers: { id: number; name: string; due: number }[];
  totalDue: number;
}

export type ReportDto = SalesReportDto | ProfitReportDto | StockReportDto | DuesReportDto;

export interface ReportsChannels {
  "dashboard:get": { in: { date: string }; out: DashboardDto };
  "reports:get": { in: { tab: ReportTab; from: string; to: string }; out: ReportDto };
  "reports:exportCsv": {
    in: { tab: ReportTab; from: string; to: string };
    out: { saved: boolean; path: string | null };
  };
}
