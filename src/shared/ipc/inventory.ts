import type { ProductStatus } from "./common";

export interface ProductDto {
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
  status: ProductStatus;
}

export interface ProductInput {
  id?: number;
  name: string;
  code: string | null;
  category: string;
  supplierId: number | null;
  cost: number;
  price: number;
  quantity: number;
  reorderLevel: number;
}

export interface InventoryChannels {
  "inventory:list": {
    in: { search?: string; category?: string | null; lowOnly?: boolean };
    out: ProductDto[];
  };
  "inventory:categories": { in: void; out: string[] };
  "inventory:save": { in: ProductInput; out: { product: ProductDto; warnings: string[] } };
  "inventory:delete": { in: { id: number }; out: { result: "deleted" | "archived" } };
}
