import type { ProductStatus } from "@shared/ipc/common";

export function productStatus(quantity: number, reorderLevel: number): ProductStatus {
  if (quantity <= 0) {
    return "OUT";
  }
  if (quantity <= reorderLevel) {
    return "LOW";
  }
  return "IN_STOCK";
}
