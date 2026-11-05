export interface SalePickerProductDto {
  id: number;
  name: string;
  code: string | null;
  category: string;
  quantity: number;
  price: number;
}

export interface SaleLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SaleRowDto {
  id: number;
  soldAt: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  profit: number;
}

export interface DaySalesDto {
  date: string;
  total: number;
  profit: number;
  count: number;
  /** 24 entries, index = hour 0 to 23, value = sales in paisa */
  hourly: number[];
  rows: SaleRowDto[];
}

export interface SalesChannels {
  "sales:picker": {
    in: { search?: string; category?: string | null };
    out: { products: SalePickerProductDto[]; categories: string[] };
  };
  "sales:save": { in: { soldAt: string; lines: SaleLineInput[] }; out: DaySalesDto };
  "sales:day": { in: { date: string }; out: DaySalesDto };
  "sales:update": { in: { id: number; quantity: number; unitPrice: number; soldAt: string }; out: void };
  "sales:delete": { in: { id: number }; out: void };
}
